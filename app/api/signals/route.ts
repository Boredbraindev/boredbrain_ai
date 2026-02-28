// /app/api/signals/route.ts
import { generateTitleFromUserMessage } from '@/app/actions';
import { convertToModelMessages, streamText, createUIMessageStream, stepCountIs, JsonToSseTransformStream } from 'ai';
import { boredbrain } from '@/ai/providers';
import { xai } from '@ai-sdk/xai';
import {
  createStreamId,
  saveChat,
  saveMessages,
  incrementExtremeSearchUsage,
  updateChatTitleById,
  getSignalById,
  updateSignalLastRun,
  updateSignal,
  updateSignalStatus,
  getUserById,
} from '@/lib/db/queries';
import { createResumableStreamContext, type ResumableStreamContext } from 'resumable-stream';
import { after } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { CronExpressionParser } from 'cron-parser';
// Telegram notification removed
import { db } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';

// Import extreme search tool
import { extremeSearchTool } from '@/lib/tools';
import { ChatMessage } from '@/lib/types';

// Helper function to determine pro access in Telegram mini app
async function checkUserIsProById(_: string): Promise<boolean> {
  return true;
}

let globalStreamContext: ResumableStreamContext | null = null;

function getStreamContext() {
  if (!globalStreamContext) {
    try {
      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
      });
    } catch (error: any) {
      if (error.message.includes('REDIS_URL') || error.message.includes('Invalid protocol') || error.message.includes('Redis')) {
        logger.warn('Resumable streams disabled due to Redis configuration issue', { message: error.message });
      } else {
        logger.error('Error creating resumable stream context', error);
      }
    }
  }

  return globalStreamContext;
}

export async function POST(req: Request) {
  logger.debug('Signal API endpoint hit from QStash');

  const requestStartTime = Date.now();
  let runDuration = 0;
  let runError: string | undefined;

  try {
    const { signalId, prompt, userId } = await req.json();

    logger.debug('Signal invocation payload', {
      signalId,
      userId,
      promptPreview: typeof prompt === 'string' ? prompt.slice(0, 120) : '[non-string prompt]',
      promptLength: typeof prompt === 'string' ? prompt.length : undefined,
    });

    // Verify signal exists and get details with retry logic
    let lookout: any = null;
    let retryCount = 0;
    const maxRetries = 3;

    while (!lookout && retryCount < maxRetries) {
      lookout = await getSignalById({ id: signalId });
      if (!lookout) {
        retryCount++;
        if (retryCount < maxRetries) {
          logger.debug('Signal not found, retrying', { attempt: retryCount, delayMs: retryCount * 500 });
          await new Promise((resolve) => setTimeout(resolve, retryCount * 500)); // Exponential backoff
        }
      }
    }

    if (!lookout) {
      logger.error('Signal not found after retries', { signalId, retries: maxRetries });
      return new Response('Signal not found', { status: 404 });
    }

    // Get user details
    const userResult = await getUserById(userId);
    if (!userResult) {
      logger.error('User not found', { userId });
      return new Response('User not found', { status: 404 });
    }

    // Check if user is pro (signals are a pro feature)
    // Skip pro check in development mode for testing signals
    const isUserPro = process.env.NODE_ENV === 'development' ? true : await checkUserIsProById(userId);
    if (!isUserPro) {
      logger.error('User is not pro, cannot run signal', { userId });
      return new Response('Signals require a Pro subscription', { status: 403 });
    }

    // Generate a new chat ID for this scheduled search
    const chatId = uuidv4();
    const streamId = 'stream-' + uuidv4();

    // Create the chat
    await saveChat({
      id: chatId,
      userId: userResult.id,
      title: `Scheduled: ${lookout.title}`,
      visibility: 'private',
    });

    // Create user message
    const userMessage = {
      id: uuidv4(),
      role: 'user' as const,
      content: prompt,
      parts: [{ type: 'text' as const, text: prompt }],
      experimental_attachments: [],
    };

    // Save user message and create stream ID
    await Promise.all([
      saveMessages({
        messages: [
          {
            chatId,
            id: userMessage.id,
            role: 'user',
            parts: userMessage.parts,
            attachments: [],
            createdAt: new Date(),
            model: 'grok-4-fast',
            completionTime: null,
            inputTokens: null,
            outputTokens: null,
            totalTokens: null,
          },
        ],
      }),
      createStreamId({ streamId, chatId }),
    ]);

    // Check if signal was stopped or deleted before we start
    const preStartSignal = await getSignalById({ id: signalId });
    if (!preStartSignal || preStartSignal.status === 'archived') {
      logger.debug('🛑 Signal was stopped or deleted before execution started');
      return new Response('Signal was stopped', { status: 200 });
    }

    // Set signal status to running
    await updateSignalStatus({
      id: signalId,
      status: 'running',
    });

    // Create data stream with execute function
    const stream = createUIMessageStream<ChatMessage>({
      execute: async ({ writer: dataStream }) => {
        const streamStartTime = Date.now();

        // Start streaming - use Grok directly to avoid boredbrain provider payment issues
        const result = streamText({
          model: xai('grok-4-fast'),
          messages: convertToModelMessages([userMessage]),
          stopWhen: stepCountIs(2),
          maxRetries: 10,
          experimental_activeTools: ['extreme_search'],
          system: ` You are an advanced research assistant focused on deep analysis and comprehensive understanding with focus to be backed by citations in a research paper format.
  You objective is to always run the tool first and then write the response with citations!
  The current date is ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit', weekday: 'short' })}.

  ### CRITICAL INSTRUCTION: (MUST FOLLOW AT ALL COSTS!!!)
  - ⚠️ URGENT: Run extreme_search tool INSTANTLY when user sends ANY message - NO EXCEPTIONS
  - DO NOT WRITE A SINGLE WORD before running the tool
  - Run the tool with the exact user query immediately on receiving it
  - EVEN IF THE USER QUERY IS AMBIGUOUS OR UNCLEAR, YOU MUST STILL RUN THE TOOL IMMEDIATELY
  - DO NOT ASK FOR CLARIFICATION BEFORE RUNNING THE TOOL
  - If a query is ambiguous, make your best interpretation and run the appropriate tool right away
  - After getting results, you can then address any ambiguity in your response
  - DO NOT begin responses with statements like "I'm assuming you're looking for information about X" or "Based on your query, I think you want to know about Y"
  - NEVER preface your answer with your interpretation of the user's query
  - GO STRAIGHT TO ANSWERING the question after running the tool

  ### Tool Guidelines:
  #### Extreme Search Tool:
  - Your primary tool is extreme_search, which allows for:
    - Multi-step research planning
    - Parallel web and academic searches
    - Deep analysis of findings
    - Cross-referencing and validation
  - ⚠️ MANDATORY: You MUST immediately run the tool first as soon as the user asks for it and then write the response with citations!
  - ⚠️ MANDATORY: You MUST NOT write any analysis before running the tool!
  - ⚠️ MANDATORY: You should only run the tool 'once and only once' and then write the response with citations!

  ### Response Guidelines:
  - You MUST immediately run the tool first as soon as the user asks for it and then write the response with citations!
  - ⚠️ MANDATORY: Every claim must have an inline citation
  - ⚠️ MANDATORY: Citations MUST be placed immediately after the sentence containing the information
  - ⚠️ MANDATORY: You MUST write any equations in latex format
  - NEVER group citations at the end of paragraphs or the response
  - Citations are a MUST, do not skip them!
  - Citation format: [Source Title](URL) - use descriptive source titles
  - Give proper headings to the response
  - Provide extremely comprehensive, well-structured responses in markdown format and tables
  - Include both academic, web and x (Twitter) sources
  - Focus on analysis and synthesis of information
  - Do not use Heading 1 in the response, use Heading 2 and 3 only
  - Use proper citations and evidence-based reasoning
  - The response should be in paragraphs and not in bullet points
  - Make the response as long as possible, do not skip any important details
  - All citations must be inline, placed immediately after the relevant information. Do not group citations at the end or in any references/bibliography section.

  ### ⚠️ Latex and Currency Formatting: (MUST FOLLOW AT ALL COSTS!!!)
  - ⚠️ MANDATORY: Use '$' for ALL inline equations without exception
  - ⚠️ MANDATORY: Use '$$' for ALL block equations without exception
  - ⚠️ NEVER use '$' symbol for currency - Always use "USD", "EUR", etc.
  - ⚠️ MANDATORY: Make sure the latex is properly delimited at all times!!
  - Mathematical expressions must always be properly delimited
  - Tables must use plain text without any formatting
  - don't use the h1 heading in the markdown response

  ### Response Format:
  - ⚠️ MANDATORY: Always start your response with "Key Points" heading followed by a bulleted list of the main findings
  - After the key points, proceed with detailed sections and finally a conclusion
  - Keep it super detailed and long, do not skip any important details
  - It is very important to have citations for all facts provided
  - Be very specific, detailed and even technical in the response
  - Include equations and mathematical expressions in the response if needed
  - Present findings in a logical flow
  - Support claims with multiple sources
  - Each section should have 2-4 detailed paragraphs
  - CITATIONS SHOULD BE ON EVERYTHING YOU SAY
  - Include analysis of reliability and limitations
  - Maintain the language of the user's message and do not change it
  - Avoid referencing citations directly, make them part of statements`,
          toolChoice: 'auto',
          tools: {
            extreme_search: extremeSearchTool(dataStream),
          },
          onChunk(event) {
            if (event.chunk.type === 'tool-call') {
              logger.debug('Tool call event', { toolName: event.chunk.toolName });
            }
          },
          onStepFinish: async (event) => {
            if (event.warnings) {
              logger.debug('Tool warnings', { warnings: event.warnings });
            }
            
            // Check if signal has been stopped/archived/deleted during execution
            try {
              const currentSignal = await getSignalById({ id: signalId });
              if (!currentSignal || currentSignal.status === 'archived') {
                logger.debug('🛑 Signal has been stopped or deleted, terminating execution');
                throw new Error('Signal stopped by user');
              }
            } catch (error) {
              logger.debug('Signal status check failed or signal stopped', {
                message: error instanceof Error ? error.message : String(error),
              });
              throw error; // This will stop the streaming
            }
          },
          onFinish: async (event) => {
            logger.debug('Signal run summary', {
              finishReason: event.finishReason,
              stepCount: event.steps?.length ?? 0,
              usage: event.usage,
            });

            if (event.finishReason === 'stop') {
              try {
                // Generate title for the chat
                const title = await generateTitleFromUserMessage({
                  message: userMessage,
                });

                logger.debug('Generated title for scheduled chat', { title });

                // Update the chat with the generated title
                await updateChatTitleById({
                  chatId,
                  title: `Scheduled: ${title}`,
                });

                // Track extreme search usage
                const extremeSearchUsed = event.steps?.some((step) =>
                  step.toolCalls?.some((toolCall) => toolCall.toolName === 'extreme_search'),
                );

                if (extremeSearchUsed) {
                  logger.debug('Extreme search was used, incrementing count');
                  await incrementExtremeSearchUsage({ userId: userResult.id });
                }

                // Calculate run duration
                runDuration = Date.now() - requestStartTime;

                // Count searches performed (look for extreme_search tool calls)
                const searchesPerformed =
                  event.steps?.reduce((total, step) => {
                    return total + (step.toolCalls?.filter((call) => call.toolName === 'extreme_search').length || 0);
                  }, 0) || 0;

                // Update signal with last run info including metrics
                await updateSignalLastRun({
                  id: signalId,
                  lastRunAt: new Date(),
                  lastRunChatId: chatId,
                  runStatus: 'success',
                  duration: runDuration,
                  tokensUsed: event.usage?.totalTokens,
                  searchesPerformed,
                });

                // Calculate next run time for recurring lookouts
                if (lookout.frequency !== 'once' && lookout.cronSchedule) {
                  try {
                    const options = {
                      currentDate: new Date(),
                      tz: lookout.timezone,
                    };

                    // Strip CRON_TZ= prefix if present
                    const cleanCronSchedule = lookout.cronSchedule.startsWith('CRON_TZ=')
                      ? lookout.cronSchedule.split(' ').slice(1).join(' ')
                      : lookout.cronSchedule;

                    const interval = CronExpressionParser.parse(cleanCronSchedule, options);
                    const nextRunAt = interval.next().toDate();

                    await updateSignal({
                      id: signalId,
                      nextRunAt,
                    });
                  } catch (error) {
                    logger.error('Error calculating next run time', error);
                  }
                } else if (lookout.frequency === 'once') {
                  // Mark one-time lookouts as paused after running
                  await updateSignalStatus({
                    id: signalId,
                    status: 'paused',
                  });
                }

                logger.debug('Signal completed successfully', { chatId });

                // Set signal status back to active after successful completion
                await updateSignalStatus({
                  id: signalId,
                  status: 'active',
                });

                logger.debug('Scheduled search completed successfully');
              } catch (error) {
                logger.error('Error in onFinish', error);
              }
            }

            // Calculate and log overall request processing time
            const requestEndTime = Date.now();
            const processingTime = (requestEndTime - requestStartTime) / 1000;
            logger.debug('Request processing time', { seconds: Number(processingTime.toFixed(2)) });
          },
          onError: async (event) => {
            logger.debug('Stream error event received', { error: event.error });

            // Calculate run duration and capture error
            runDuration = Date.now() - requestStartTime;
            runError = (event.error as string) || 'Unknown error occurred';

            // Check if this error is due to user stopping the signal
            const isUserStop = runError.includes('Signal stopped by user') || runError.includes('stopped');

            // Update signal with failed run info
            try {
              await updateSignalLastRun({
                id: signalId,
                lastRunAt: new Date(),
                lastRunChatId: chatId,
                runStatus: 'error',
                error: isUserStop ? 'Stopped by user' : runError,
                duration: runDuration,
              });
            } catch (updateError) {
              logger.error('Failed to update lookout with error info', updateError);
            }

            // Set signal status appropriately
            try {
              if (isUserStop) {
                logger.debug('🛑 Signal was stopped by user, keeping archived status');
                // Don't change status - user archived it
              } else {
                // Only set back to active if it was a real error (not user stop)
                await updateSignalStatus({
                  id: signalId,
                  status: 'active',
                });
                logger.debug('Reset signal status to active after error');
              }
            } catch (statusError) {
              logger.error('Failed to reset lookout status after error', statusError);
            }

            const requestEndTime = Date.now();
            const processingTime = (requestEndTime - requestStartTime) / 1000;
            logger.debug('Request processing time (with error)', { seconds: Number(processingTime.toFixed(2)) });
          },
        });

        result.consumeStream();

        dataStream.merge(
          result.toUIMessageStream({
            sendReasoning: true,
            messageMetadata: ({ part }) => {
              if (part.type === 'finish') {
                const finishPart = part as unknown as {
                  finishReason?: string;
                  totalUsage?: { totalTokens?: number };
                };
                logger.debug('Finish part received', {
                  finishReason: finishPart.finishReason,
                  totalTokens: finishPart.totalUsage?.totalTokens,
                });
                const processingTime = (Date.now() - streamStartTime) / 1000;
                return {
                  model: 'grok-4-fast',
                  completionTime: processingTime,
                  createdAt: new Date().toISOString(),
                  totalTokens: part.totalUsage?.totalTokens ?? null,
                  inputTokens: part.totalUsage?.inputTokens ?? null,
                  outputTokens: part.totalUsage?.outputTokens ?? null,
                };
              }
            },
          }),
        );
      },
      onError(error) {
        logger.debug('Stream pipeline error', { error });
        return 'Oops, an error occurred in scheduled search!';
      },
      onFinish: async ({ messages }) => {
        if (userId) {
          // Validate user exists and is Pro user
          const user = await getUserById(userId);
          const isUserPro = user ? await checkUserIsProById(userId) : false;

          if (user && isUserPro) {
            await saveMessages({
              messages: messages.map((message) => ({
                id: message.id,
                role: message.role,
                parts: message.parts,
                createdAt: new Date(),
                attachments: [],
                chatId: chatId,
                model: 'grok-4-fast',
                completionTime: message.metadata?.completionTime ?? 0,
                inputTokens: message.metadata?.inputTokens ?? 0,
                outputTokens: message.metadata?.outputTokens ?? 0,
                totalTokens: message.metadata?.totalTokens ?? 0,
              })),
            });
          } else {
            logger.error('User validation failed in onFinish - user not found or not pro', { userId });
          }
        }
      },
    });

    const streamContext = getStreamContext();

    if (streamContext) {
      return new Response(
        await streamContext.resumableStream(streamId, () => stream.pipeThrough(new JsonToSseTransformStream())),
      );
    } else {
      return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
    }
  } catch (error) {
    logger.error('Error in lookout API', error);
    return new Response('Internal server error', { status: 500 });
  }
}
