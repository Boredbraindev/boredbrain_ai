// app/actions.ts
'use server';

import { geolocation } from '@vercel/functions';
import { serverEnv } from '@/env/server';
import { generateObject, UIMessage, generateText } from 'ai';
import type { ModelMessage } from 'ai';
import { z } from 'zod';
import { getUser } from '@/lib/auth-utils';
import { boredbrain } from '@/ai/providers';
import { logger } from '@/lib/logger';
import {
  getChatsByUserId,
  deleteChatById,
  updateChatVisibilityById,
  getChatById,
  getMessageById,
  deleteMessagesByChatIdAfterTimestamp,
  updateChatTitleById,
  getExtremeSearchCount,
  incrementMessageUsage,
  getMessageCount,
  getHistoricalUsageData,
  getPaymentsByUserId,
  createSignal,
  getSignalsByUserId,
  getSignalById,
  updateSignal,
  updateSignalStatus,
  deleteSignal,
} from '@/lib/db/queries';
import { db } from '@/lib/db';
import { user, referral } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { generateReferralCode as generateReferralCodeUtil } from '@/lib/referral-utils';
import { getDiscountConfig } from '@/lib/discount';
import { get } from '@vercel/edge-config';
import { groq } from '@ai-sdk/groq';
import { Client } from '@upstash/qstash';
import { experimental_generateSpeech as generateVoice } from 'ai';
import { elevenlabs } from '@ai-sdk/elevenlabs';
import { usageCountCache, createMessageCountKey, createExtremeCountKey } from '@/lib/performance-cache';
import { CronExpressionParser } from 'cron-parser';
import { getComprehensiveUserData } from '@/lib/user-data-server';
import { type ConnectorProvider } from '@/lib/connectors';

import {
  groupTools,
  groupInstructions,
  requiresAuth,
  requiresPro,
  DEFAULT_GROUP_ID,
  isKnownGroup,
  type LegacyGroupId,
} from '@/lib/assistant-groups';

// Server action to get the current user with Pro status - UNIFIED VERSION
export async function getCurrentUser() {
  'use server';

  return await getComprehensiveUserData();
}

export async function suggestQuestions(history: any[]) {
  'use server';

  logger.debug('suggestQuestions invoked', { messageCount: history.length });

  const { object } = await generateObject({
    model: boredbrain.languageModel('boredbrain-grok-3'),
    system: `You are a search engine follow up query/questions generator. You MUST create EXACTLY 3 questions for the search engine based on the conversation history.

### Question Generation Guidelines:
- Create exactly 3 questions that are open-ended and encourage further discussion
- Questions must be concise (5-10 words each) but specific and contextually relevant
- Each question must contain specific nouns, entities, or clear context markers
- NEVER use pronouns (he, she, him, his, her, etc.) - always use proper nouns from the context
- Questions must be related to tools available in the system
- Questions should flow naturally from previous conversation
- You are here to generate questions for the search engine not to use tools or run tools!!

### Tool-Specific Question Types:
- Web search: Focus on factual information, current events, or general knowledge
- Academic: Focus on scholarly topics, research questions, or educational content
- YouTube: Focus on tutorials, how-to questions, or content discovery
- Social media (X/Twitter): Focus on trends, opinions, or social conversations
- Code/Analysis: Focus on programming, data analysis, or technical problem-solving
- Weather: Redirect to news, sports, or other non-weather topics
- Location: Focus on culture, history, landmarks, or local information
- Finance: Focus on market analysis, investment strategies, or economic topics

### Context Transformation Rules:
- For weather conversations → Generate questions about news, sports, or other non-weather topics
- For programming conversations → Generate questions about algorithms, data structures, or code optimization
- For location-based conversations → Generate questions about culture, history, or local attractions
- For mathematical queries → Generate questions about related applications or theoretical concepts
- For current events → Generate questions that explore implications, background, or related topics

### Formatting Requirements:
- No bullet points, numbering, or prefixes
- No quotation marks around questions
- Each question must be grammatically complete
- Each question must end with a question mark
- Questions must be diverse and not redundant
- Do not include instructions or meta-commentary in the questions`,
    messages: history,
    schema: z.object({
      questions: z.array(z.string().max(150)).describe('The generated questions based on the message history.').max(3),
    }),
  });

  return {
    questions: object.questions,
  };
}

export async function checkImageModeration(images: string[]) {
  const messages: ModelMessage[] = images.map((image) => ({
    role: 'user',
    content: [{ type: 'image', image: image }],
  }));

  const { text } = await generateText({
    model: groq('meta-llama/llama-guard-4-12b'),
    messages,
    providerOptions: {
      groq: {
        service_tier: 'flex',
      },
    },
  });
  return text;
}

export async function generateTitleFromUserMessage({ message }: { message: UIMessage }) {
  const { text: title } = await generateText({
    model: boredbrain.languageModel('boredbrain-default'),
    system: `You are an expert title generator. You are given a message and you need to generate a short title based on it.

    - you will generate a short title based on the first message a user begins a conversation with
    - ensure it is not more than 80 characters long
    - the title should be a summary of the user's message
    - the title should creative and unique
    - do not write anything other than the title
    - do not use quotes or colons`,
    prompt: JSON.stringify(message),
    providerOptions: {
      groq: {
        service_tier: 'flex',
      },
    },
  });

  return title;
}

export async function enhancePrompt(raw: string) {
  try {
    const user = await getComprehensiveUserData();
    if (!user || !user.isProUser) {
      return { success: false, error: 'Pro subscription required' };
    }

    const system = `You are an expert prompt engineer. You are given a prompt and you need to enhance it.

Today's Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit', weekday: 'short' })}.

Guidelines (MANDATORY):
- Preserve the user's original intent and constraints
- Make the prompt specific, unambiguous, and actionable
- Add missing context: entities, timeframe, location, format/constraints if implied
- Remove fluff, pronouns, and vague language; use proper nouns when possible
- Keep it concise (1-2 sentences extra max) but information-dense
- Do NOT ask follow-up questions
- Make sure it gives the best and comprehensive results for the user's query
- Make sure to maintain the Point of View of the User
- Your job is to enhance the prompt, not to answer the prompt!!
- Make sure the prompt is not an answer to the user's query!!
- Return ONLY the improved prompt text, with no quotes or commentary or answer to the user's query!!
- Just return the improved prompt text in plain text format, no other text or commentary or markdown or anything else!!`;

    const { text } = await generateText({
      model: boredbrain.languageModel('boredbrain-enhance'),
      temperature: 0.6,
      topP: 0.95,
      maxOutputTokens: 1024,
      system,
      prompt: raw,
    });

    return { success: true, enhanced: text.trim() };
  } catch (error) {
    logger.error('Error enhancing prompt', error);
    return { success: false, error: 'Failed to enhance prompt' };
  }
}

export async function generateSpeech(text: string) {
  const result = await generateVoice({
    model: elevenlabs.speech('eleven_v3'),
    text,
    voice: 'TX3LPaxmHKxFdv7VOQHJ',
  });

  return {
    audio: `data:audio/mp3;base64,${result.audio.base64}`,
  };
}

// Map deprecated 'buddy' group ID to 'memory' for backward compatibility

export async function getGroupConfig(requestedGroupId: LegacyGroupId = DEFAULT_GROUP_ID) {
  'use server';

  let groupId: LegacyGroupId = isKnownGroup(requestedGroupId) ? requestedGroupId : DEFAULT_GROUP_ID;

  if (requiresAuth(groupId) || requiresPro(groupId)) {
    const user = await getCurrentUser();

    if (!user || (requiresPro(groupId) && !user.isProUser)) {
      groupId = DEFAULT_GROUP_ID;
    }
  }

  if (!isKnownGroup(groupId)) {
    groupId = DEFAULT_GROUP_ID;
  }

  const tools = groupTools[groupId];
  const instructions = groupInstructions[groupId];

  return {
    tools,
    instructions,
  };
}

// Add functions to fetch user chats
export async function getUserChats(
  userId: string,
  limit: number = 20,
  startingAfter?: string,
  endingBefore?: string,
): Promise<{ chats: any[]; hasMore: boolean }> {
  'use server';

  if (!userId) return { chats: [], hasMore: false };

  try {
    return await getChatsByUserId({
      id: userId,
      limit,
      startingAfter: startingAfter || null,
      endingBefore: endingBefore || null,
    });
  } catch (error) {
    logger.error('Error fetching user chats:', error);
    return { chats: [], hasMore: false };
  }
}

// Add function to load more chats for infinite scroll
export async function loadMoreChats(
  userId: string,
  lastChatId: string,
  limit: number = 20,
): Promise<{ chats: any[]; hasMore: boolean }> {
  'use server';

  if (!userId || !lastChatId) return { chats: [], hasMore: false };

  try {
    return await getChatsByUserId({
      id: userId,
      limit,
      startingAfter: null,
      endingBefore: lastChatId,
    });
  } catch (error) {
    logger.error('Error loading more chats:', error);
    return { chats: [], hasMore: false };
  }
}

// Add function to delete a chat
export async function deleteChat(chatId: string) {
  'use server';

  if (!chatId) return null;

  try {
    return await deleteChatById({ id: chatId });
  } catch (error) {
    logger.error('Error deleting chat:', error);
    return null;
  }
}

// Add function to update chat visibility
export async function updateChatVisibility(chatId: string, visibility: 'private' | 'public') {
  'use server';

  logger.debug('updateChatVisibility called', { chatId, visibility });

  if (!chatId) {
    logger.error('❌ updateChatVisibility: No chatId provided');
    throw new Error('Chat ID is required');
  }

  try {
    logger.debug('Calling updateChatVisibilityById', { chatId, visibility });
    const result = await updateChatVisibilityById({ chatId, visibility });
    logger.debug('updateChatVisibilityById succeeded', { chatId, visibility, rowCount: result?.rowCount ?? 0 });

    // Return a serializable plain object instead of raw database result
    return {
      success: true,
      chatId,
      visibility,
      rowCount: result?.rowCount || 0,
    };
  } catch (error) {
    logger.error('❌ Error in updateChatVisibility', {
      chatId,
      visibility,
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

// Add function to get chat info
export async function getChatInfo(chatId: string) {
  'use server';

  if (!chatId) return null;

  try {
    return await getChatById({ id: chatId });
  } catch (error) {
    logger.error('Error getting chat info:', error);
    return null;
  }
}

export async function deleteTrailingMessages({ id }: { id: string }) {
  'use server';
  try {
    const [message] = await getMessageById({ id });
    logger.debug('deleteTrailingMessages fetched message', { messageId: message?.id });

    if (!message) {
      logger.error(`No message found with id: ${id}`);
      return;
    }

    await deleteMessagesByChatIdAfterTimestamp({
      chatId: message.chatId,
      timestamp: message.createdAt,
    });

    logger.debug('deleteTrailingMessages succeeded', { messageId: id });
  } catch (error) {
    logger.error('Error deleting trailing messages', error);
    throw error; // Re-throw to allow caller to handle
  }
}

// Add function to update chat title
export async function updateChatTitle(chatId: string, title: string) {
  'use server';

  if (!chatId || !title.trim()) return null;

  try {
    return await updateChatTitleById({ chatId, title: title.trim() });
  } catch (error) {
    logger.error('Error updating chat title:', error);
    return null;
  }
}

export async function getSubDetails() {
  'use server';

  // Import here to avoid issues with SSR
  const { getComprehensiveUserData } = await import('@/lib/user-data-server');
  const userData = await getComprehensiveUserData();

  if (!userData) return { hasSubscription: false };

  return userData.polarSubscription
    ? {
        hasSubscription: true,
        subscription: userData.polarSubscription,
      }
    : { hasSubscription: false };
}

export async function getUserMessageCount(providedUser?: any) {
  'use server';

  try {
    const user = providedUser || (await getUser());
    if (!user) {
      return { count: 0, error: 'User not found' };
    }

    // Check cache first
    const cacheKey = createMessageCountKey(user.id);
    const cached = usageCountCache.get(cacheKey);
    if (cached !== null) {
      return { count: cached, error: null };
    }

    const count = await getMessageCount({
      userId: user.id,
    });

    // Cache the result
    usageCountCache.set(cacheKey, count);

    return { count, error: null };
  } catch (error) {
    logger.error('Error getting user message count:', error);
    return { count: 0, error: 'Failed to get message count' };
  }
}

export async function incrementUserMessageCount() {
  'use server';

  try {
    const user = await getUser();
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    await incrementMessageUsage({
      userId: user.id,
    });

    // Invalidate cache
    const cacheKey = createMessageCountKey(user.id);
    usageCountCache.delete(cacheKey);

    return { success: true, error: null };
  } catch (error) {
    logger.error('Error incrementing user message count:', error);
    return { success: false, error: 'Failed to increment message count' };
  }
}

export async function getExtremeSearchUsageCount(providedUser?: any) {
  'use server';

  try {
    const user = providedUser || (await getUser());
    if (!user) {
      return { count: 0, error: 'User not found' };
    }

    // Check cache first
    const cacheKey = createExtremeCountKey(user.id);
    const cached = usageCountCache.get(cacheKey);
    if (cached !== null) {
      return { count: cached, error: null };
    }

    const count = await getExtremeSearchCount({
      userId: user.id,
    });

    // Cache the result
    usageCountCache.set(cacheKey, count);

    return { count, error: null };
  } catch (error) {
    logger.error('Error getting extreme search usage count:', error);
    return { count: 0, error: 'Failed to get extreme search count' };
  }
}

export async function getDiscountConfigAction() {
  'use server';

  try {
    const user = await getCurrentUser();
    const userEmail = user?.email;
    return await getDiscountConfig(userEmail);
  } catch (error) {
    logger.error('Error getting discount configuration:', error);
    return {
      enabled: false,
    };
  }
}

export async function getHistoricalUsage(providedUser?: any, months: number = 9) {
  'use server';

  try {
    const user = providedUser || (await getUser());
    if (!user) {
      return [];
    }

    const historicalData = await getHistoricalUsageData({ userId: user.id, months });

    // Calculate days based on months (approximately 30 days per month)
    const totalDays = months * 30;
    const futureDays = Math.min(15, Math.floor(totalDays * 0.08)); // ~8% future days, max 15
    const pastDays = totalDays - futureDays - 1; // -1 for today

    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + futureDays);

    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - pastDays);

    // Create a map of existing data for quick lookup
    const dataMap = new Map<string, number>();
    historicalData.forEach((record) => {
      const dateKey = record.date.toISOString().split('T')[0];
      dataMap.set(dateKey, record.messageCount || 0);
    });

    // Generate complete dataset for all days
    const completeData = [];
    for (let i = 0; i < totalDays; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      const dateKey = currentDate.toISOString().split('T')[0];

      const count = dataMap.get(dateKey) || 0;
      let level: 0 | 1 | 2 | 3 | 4;

      // Define usage levels based on message count
      if (count === 0) level = 0;
      else if (count <= 3) level = 1;
      else if (count <= 7) level = 2;
      else if (count <= 12) level = 3;
      else level = 4;

      completeData.push({
        date: dateKey,
        count,
        level,
      });
    }

    return completeData;
  } catch (error) {
    logger.error('Error getting historical usage:', error);
    return [];
  }
}

// Custom Instructions Server Actions
export async function getCustomInstructions(_: any = undefined) {
  'use server';
  logger.warn('Custom instructions are not available.');
  return null;
}

export async function saveCustomInstructions(_: string) {
  'use server';
  logger.warn('Attempted to save custom instructions, but the feature is disabled.');
  return { success: false, error: 'Custom instructions are not available.' };
}

export async function deleteCustomInstructionsAction() {
  'use server';
  logger.warn('Attempted to delete custom instructions, but the feature is disabled.');
  return { success: false, error: 'Custom instructions are not available.' };
}

// Fast pro user status check - UNIFIED VERSION
export async function getProUserStatusOnly(): Promise<boolean> {
  'use server';

  // Import here to avoid issues with SSR
  const { isUserPro } = await import('@/lib/user-data-server');
  return await isUserPro();
}

export async function getPaymentHistory() {
  try {
    const user = await getUser();
    if (!user) return null;

    const payments = await getPaymentsByUserId({ userId: user.id });
    return payments;
  } catch (error) {
    logger.error('Error getting payment history:', error);
    return null;
  }
}

export async function getDodoPaymentsProStatus() {
  'use server';

  // Import here to avoid issues with SSR
  const { getComprehensiveUserData } = await import('@/lib/user-data-server');
  const userData = await getComprehensiveUserData();

  if (!userData) return { isProUser: false, hasPayments: false };

  const isDodoProUser = userData.proSource === 'dodo' && userData.isProUser;

  return {
    isProUser: isDodoProUser,
    hasPayments: Boolean(userData.dodoPayments?.hasPayments),
    expiresAt: userData.dodoPayments?.expiresAt,
    source: userData.proSource,
    daysUntilExpiration: userData.dodoPayments?.daysUntilExpiration,
    isExpired: userData.dodoPayments?.isExpired,
    isExpiringSoon: userData.dodoPayments?.isExpiringSoon,
  };
}

export async function getDodoExpirationDate() {
  'use server';

  // Import here to avoid issues with SSR
  const { getComprehensiveUserData } = await import('@/lib/user-data-server');
  const userData = await getComprehensiveUserData();

  return userData?.dodoPayments?.expiresAt || null;
}

// Initialize QStash client
const qstash = new Client({ token: serverEnv.QSTASH_TOKEN });

// Helper function to convert frequency to cron schedule with timezone
function frequencyToCron(frequency: string, time: string, timezone: string, dayOfWeek?: string): string {
  const [hours, minutes] = time.split(':').map(Number);

  let cronExpression = '';
  switch (frequency) {
    case 'once':
      // For 'once', we'll handle it differently - no cron schedule needed
      return '';
    case 'daily':
      cronExpression = `${minutes} ${hours} * * *`;
      break;
    case 'weekly':
      // Use the day of week if provided, otherwise default to Sunday (0)
      const day = dayOfWeek || '0';
      cronExpression = `${minutes} ${hours} * * ${day}`;
      break;
    case 'monthly':
      // Run on the 1st of each month
      cronExpression = `${minutes} ${hours} 1 * *`;
      break;
    case 'yearly':
      // Run on January 1st
      cronExpression = `${minutes} ${hours} 1 1 *`;
      break;
    default:
      cronExpression = `${minutes} ${hours} * * *`; // Default to daily
  }

  // Prepend timezone to cron expression for QStash
  return `CRON_TZ=${timezone} ${cronExpression}`;
}

// Helper function to calculate next run time using cron-parser
function calculateNextRun(cronSchedule: string, timezone: string): Date {
  try {
    // Extract the actual cron expression from the timezone-prefixed format
    // Format: "CRON_TZ=timezone 0 9 * * *" -> "0 9 * * *"
    const actualCronExpression = cronSchedule.startsWith('CRON_TZ=')
      ? cronSchedule.split(' ').slice(1).join(' ')
      : cronSchedule;

    const options = {
      currentDate: new Date(),
      tz: timezone,
    };

    const interval = CronExpressionParser.parse(actualCronExpression, options);
    return interval.next().toDate();
  } catch (error) {
    logger.error('Error parsing cron expression', { cronSchedule, error });
    // Fallback to simple calculation
    const now = new Date();
    const nextRun = new Date(now);
    nextRun.setDate(nextRun.getDate() + 1);
    return nextRun;
  }
}

// Helper function to calculate next run for 'once' frequency
function calculateOnceNextRun(time: string, timezone: string, date?: string): Date {
  const [hours, minutes] = time.split(':').map(Number);

  if (date) {
    // If a specific date is provided, use it
    const targetDate = new Date(date);
    targetDate.setHours(hours, minutes, 0, 0);
    return targetDate;
  }

  // Otherwise, use today or tomorrow
  const now = new Date();
  const targetDate = new Date(now);
  targetDate.setHours(hours, minutes, 0, 0);

  // If the time has already passed today, schedule for tomorrow
  if (targetDate <= now) {
    targetDate.setDate(targetDate.getDate() + 1);
  }

  return targetDate;
}

export async function createScheduledSignal({
  title,
  prompt,
  frequency,
  time,
  timezone = 'UTC',
  date,
}: {
  title: string;
  prompt: string;
  frequency: 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  time: string; // Format: "HH:MM" or "HH:MM:dayOfWeek" for weekly
  timezone?: string;
  date?: string; // For 'once' frequency
}) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('Authentication required');
    }

    // Check if user is Pro
    if (!user.isProUser) {
      throw new Error('Pro subscription required for scheduled searches');
    }

    // Check signal limits
    const existingSignals = await getSignalsByUserId({ userId: user.id });
    if (existingSignals.length >= 10) {
      throw new Error('You have reached the maximum limit of 10 lookouts');
    }

    // Check daily signal limit specifically
    if (frequency === 'daily') {
      const activeDailySignals = existingSignals.filter(
        (signal: any) => signal.frequency === 'daily' && signal.status === 'active',
      );
      if (activeDailySignals.length >= 5) {
        throw new Error('You have reached the maximum limit of 5 active daily signals');
      }
    }

    let cronSchedule = '';
    let nextRunAt: Date;
    let actualTime = time;
    let dayOfWeek: string | undefined;

    // Extract day of week for weekly frequency
    if (frequency === 'weekly' && time.includes(':')) {
      const parts = time.split(':');
      if (parts.length === 3) {
        actualTime = `${parts[0]}:${parts[1]}`;
        dayOfWeek = parts[2];
      }
    }

    if (frequency === 'once') {
      // For 'once', calculate the next run time without cron
      nextRunAt = calculateOnceNextRun(actualTime, timezone, date);
    } else {
      // Generate cron schedule for recurring frequencies
      cronSchedule = frequencyToCron(frequency, actualTime, timezone, dayOfWeek);
      nextRunAt = calculateNextRun(cronSchedule, timezone);
    }

    // Create signal in database first
    const signal = await createSignal({
      userId: user.id,
      title,
      prompt,
      frequency,
      cronSchedule,
      timezone,
      nextRunAt,
      qstashScheduleId: undefined, // Will be updated if needed
    });

    logger.debug('Signal created, scheduling with QStash', { signalId: signal.id });

    // Small delay to ensure database transaction is committed
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Create QStash schedule for all frequencies (recurring and once)
    if (signal.id) {
      try {
        if (frequency === 'once') {
          logger.debug('Creating QStash one-time execution', { signalId: signal.id });
          logger.debug('Scheduled time for one-time execution', {
            signalId: signal.id,
            isoTime: nextRunAt.toISOString(),
          });

          const delay = Math.floor((nextRunAt.getTime() - Date.now()) / 1000); // Delay in seconds
          const minimumDelay = Math.max(delay, 5); // At least 5 seconds to ensure DB consistency

          if (delay > 0) {
            // Skip QStash publish in development - just create the signal without scheduling
            if (process.env.NODE_ENV === 'development') {
              logger.debug(
                '🔧 Development mode: Skipping QStash one-time execution, lookout created without external scheduling',
              );
              // In development, the signal exists but won't be externally scheduled
            } else {
              // Use environment variable for base URL or fallback to default
              const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://boredbrain-omega.vercel.app';

              await qstash.publish({
                url: `${baseUrl}/api/signals`,
                body: JSON.stringify({
                  signalId: signal.id,
                  prompt,
                  userId: user.id,
                }),
                headers: {
                  'Content-Type': 'application/json',
                },
                delay: minimumDelay,
              });

              logger.debug('QStash one-time execution scheduled', {
                signalId: signal.id,
                delaySeconds: minimumDelay,
              });
            }

            // For consistency, we don't store a qstashScheduleId for one-time executions
            // since they use the publish API instead of schedules API
          } else {
            throw new Error('Cannot schedule for a time in the past');
          }
        } else {
          logger.debug('Creating QStash recurring schedule', { signalId: signal.id });
          logger.debug('Cron schedule with timezone', { signalId: signal.id, cronSchedule });

          // Skip QStash scheduling in development - just create the signal without scheduling
          if (process.env.NODE_ENV === 'development') {
            logger.debug(
              '🔧 Development mode: Skipping QStash scheduling, lookout created without external scheduling',
            );
            // In development, the signal exists but won't be externally scheduled
          } else {
            // Use environment variable for base URL or fallback to default
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://boredbrain-omega.vercel.app';

            const scheduleResponse = await qstash.schedules.create({
              destination: `${baseUrl}/api/signals`,
              method: 'POST',
              cron: cronSchedule,
              body: JSON.stringify({
                signalId: signal.id,
                prompt,
                userId: user.id,
              }),
              headers: {
                'Content-Type': 'application/json',
              },
            });

            logger.debug('QStash recurring schedule created', {
              scheduleId: scheduleResponse.scheduleId,
              signalId: signal.id,
            });

            // Update signal with QStash schedule ID
            await updateSignal({
              id: signal.id,
              qstashScheduleId: scheduleResponse.scheduleId,
            });

            signal.qstashScheduleId = scheduleResponse.scheduleId;
          }
        }
      } catch (qstashError) {
        logger.error('Error creating QStash schedule:', qstashError);
        // Delete the lookout if QStash creation fails
        await deleteSignal({ id: signal.id });
        throw new Error(
          `Failed to ${frequency === 'once' ? 'schedule one-time search' : 'create recurring schedule'}. Please try again.`,
        );
      }
    }

    return { success: true, signal };
  } catch (error) {
    logger.error('Error creating scheduled signal:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function getUserSignals() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('Authentication required');
    }

    const lookouts = await getSignalsByUserId({ userId: user.id });

    // Update next run times for active lookouts
    const updatedSignals = lookouts.map((signal: any) => {
      if (signal.status === 'active' && signal.cronSchedule && signal.frequency !== 'once') {
        try {
          const nextRunAt = calculateNextRun(signal.cronSchedule, signal.timezone);
          return { ...signal, nextRunAt };
        } catch (error) {
          logger.error('Error calculating next run for signal', { signalId: signal.id, error });
          return signal;
        }
      }
      return signal;
    });

    return { success: true, signals: updatedSignals };
  } catch (error) {
    logger.error('Error getting user lookouts:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function updateSignalStatusAction({
  id,
  status,
}: {
  id: string;
  status: 'active' | 'paused' | 'archived' | 'running';
}) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('Authentication required');
    }

    // Get signal to verify ownership
    const signal = await getSignalById({ id });
    if (!signal || signal.userId !== user.id) {
      throw new Error('Signal not found or access denied');
    }

    // Update QStash schedule status if it exists
    if (signal.qstashScheduleId) {
      try {
        if (status === 'paused') {
          await qstash.schedules.pause({ schedule: signal.qstashScheduleId });
        } else if (status === 'active') {
          await qstash.schedules.resume({ schedule: signal.qstashScheduleId });
          // Update next run time when resuming
          if (signal.cronSchedule) {
            const nextRunAt = calculateNextRun(signal.cronSchedule, signal.timezone);
            await updateSignal({ id, nextRunAt });
          }
        } else if (status === 'archived') {
          await qstash.schedules.delete(signal.qstashScheduleId);
        }
      } catch (qstashError) {
        logger.error('Error updating QStash schedule:', qstashError);
        // Continue with database update even if QStash fails
      }
    }

    // Update database
    const updatedSignal = await updateSignalStatus({ id, status });
    return { success: true, signal: updatedSignal };
  } catch (error) {
    logger.error('Error updating signal.status:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function updateSignalAction({
  id,
  title,
  prompt,
  frequency,
  time,
  timezone,
  dayOfWeek,
}: {
  id: string;
  title: string;
  prompt: string;
  frequency: 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  time: string;
  timezone: string;
  dayOfWeek?: string;
}) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('Authentication required');
    }

    // Get signal to verify ownership
    const signal = await getSignalById({ id });
    if (!signal || signal.userId !== user.id) {
      throw new Error('Signal not found or access denied');
    }

    // Check daily lookout limit if changing to daily frequency
    if (frequency === 'daily' && signal.frequency !== 'daily') {
      const existingSignals = await getSignalsByUserId({ userId: user.id });
      const activeDailySignals = existingSignals.filter(
        (existingLookout: any) =>
          existingLookout.frequency === 'daily' && existingLookout.status === 'active' && existingLookout.id !== id,
      );
      if (activeDailySignals.length >= 5) {
        throw new Error('You have reached the maximum limit of 5 active daily lookouts');
      }
    }

    // Handle weekly day selection
    let adjustedTime = time;
    if (frequency === 'weekly' && dayOfWeek) {
      adjustedTime = `${time}:${dayOfWeek}`;
    }

    // Generate new cron schedule if frequency changed
    let cronSchedule = '';
    let nextRunAt: Date;

    if (frequency === 'once') {
      // For 'once', set next run to today/tomorrow at specified time
      const [hours, minutes] = time.split(':').map(Number);
      const now = new Date();
      nextRunAt = new Date(now);
      nextRunAt.setHours(hours, minutes, 0, 0);

      if (nextRunAt <= now) {
        nextRunAt.setDate(nextRunAt.getDate() + 1);
      }
    } else {
      cronSchedule = frequencyToCron(frequency, time, timezone, dayOfWeek);
      nextRunAt = calculateNextRun(cronSchedule, timezone);
    }

    // Update QStash schedule if it exists and frequency/time changed
    if (signal.qstashScheduleId && frequency !== 'once') {
      try {
        // Delete old schedule
        await qstash.schedules.delete(signal.qstashScheduleId);

        logger.debug('Recreating QStash schedule', { signalId: id });
        logger.debug('Updated cron schedule with timezone', { signalId: id, cronSchedule });

        // Skip QStash scheduling in development - just update the lookout without scheduling
        if (process.env.NODE_ENV === 'development') {
          logger.debug(
            '🔧 Development mode: Skipping QStash schedule update, lookout updated without external scheduling',
          );
          // In development, just update the database
        } else {
          // Create new schedule with updated cron
          const scheduleResponse = await qstash.schedules.create({
            destination: `https://boredbrain.ai/api/signals`,
            method: 'POST',
            cron: cronSchedule,
            body: JSON.stringify({
              signalId: id,
              prompt: prompt.trim(),
              userId: user.id,
            }),
            headers: {
              'Content-Type': 'application/json',
            },
          });

          // Update database with new details including QStash schedule ID
          const updatedSignal = await updateSignal({
            id,
            title: title.trim(),
            prompt: prompt.trim(),
            frequency,
            cronSchedule,
            timezone,
            nextRunAt,
            qstashScheduleId: scheduleResponse.scheduleId,
          });

          return { success: true, signal: updatedSignal };
        }

        // For development mode, update database without QStash schedule ID
        const updatedSignal = await updateSignal({
          id,
          title: title.trim(),
          prompt: prompt.trim(),
          frequency,
          cronSchedule,
          timezone,
          nextRunAt,
          qstashScheduleId: undefined, // No QStash schedule in development
        });

        return { success: true, signal: updatedSignal };
      } catch (qstashError) {
        logger.error('Error updating QStash schedule:', qstashError);
        throw new Error('Failed to update schedule. Please try again.');
      }
    } else {
      // Update database only
      const updatedSignal = await updateSignal({
        id,
        title: title.trim(),
        prompt: prompt.trim(),
        frequency,
        cronSchedule,
        timezone,
        nextRunAt,
      });

      return { success: true, signal: updatedSignal };
    }
  } catch (error) {
    logger.error('Error updating signal:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function deleteSignalAction({ id }: { id: string }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('Authentication required');
    }

    // Get signal to verify ownership
    const signal = await getSignalById({ id });
    if (!signal || signal.userId !== user.id) {
      throw new Error('Signal not found or access denied');
    }

    // Delete QStash schedule if it exists
    if (signal.qstashScheduleId) {
      try {
        await qstash.schedules.delete(signal.qstashScheduleId);
      } catch (error) {
        logger.error('Error deleting QStash schedule:', error);
        // Continue with database deletion even if QStash deletion fails
      }
    }

    // Delete from database
    const deletedSignal = await deleteSignal({ id });
    return { success: true, signal: deletedSignal };
  } catch (error) {
    logger.error('Error deleting signal:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function testSignalAction({ id }: { id: string }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('Authentication required');
    }

    // Get signal to verify ownership
    const signal = await getSignalById({ id });
    if (!signal || signal.userId !== user.id) {
      throw new Error('Signal not found or access denied');
    }

    // Only allow testing of active or paused lookouts
    if (signal.status === 'archived' || signal.status === 'running') {
      throw new Error(`Cannot test lookout with status: ${signal.status}`);
    }

    // Make a POST request to the lookout API endpoint to trigger the run
    const response = await fetch(
      process.env.NODE_ENV === 'development'
        ? `http://localhost:3009/api/signals`
        : `https://boredbrain.ai/api/signals`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          signalId: signal.id,
          prompt: signal.prompt,
          userId: user.id,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to trigger lookout test: ${response.statusText}`);
    }

    return { success: true, message: 'Lookout test started successfully' };
  } catch (error) {
    logger.error('Error testing signal:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Server action to get user's geolocation using Vercel
export async function getUserLocation() {
  'use server';

  try {
    const { headers } = await import('next/headers');
    const headersList = await headers();

    // Create a mock request object with headers for geolocation
    const request = {
      headers: headersList,
    } as any;

    const locationData = geolocation(request);

    return {
      country: locationData.country || '',
      countryCode: locationData.country || '',
      city: locationData.city || '',
      region: locationData.region || '',
      isIndia: locationData.country === 'IN',
      loading: false,
    };
  } catch (error) {
    logger.error('Failed to get location from Vercel:', error);
    return {
      country: 'Unknown',
      countryCode: '',
      city: '',
      region: '',
      isIndia: false,
      loading: false,
    };
  }
}

// Connector management actions
export async function createConnectorAction(provider: ConnectorProvider) {
  'use server';

  logger.warn(`Connector creation attempted for ${provider}, but connectors are not available.`);
  return { success: false, error: 'Connectors are not available.' };
}

export async function listUserConnectorsAction(): Promise<{
  success: boolean;
  error?: string;
  connections: Array<{ provider: ConnectorProvider; [key: string]: any }>;
}> {
  'use server';

  logger.warn('Connector listing requested, but connectors are not available.');
  return { success: false, error: 'Connectors are not available.', connections: [] };
}

export async function deleteConnectorAction(connectionId: string) {
  'use server';

  logger.warn(`Connector delete attempted for ${connectionId}, but connectors are not available.`);
  return { success: false, error: 'Connectors are not available.' };
}

export async function manualSyncConnectorAction(provider: ConnectorProvider) {
  'use server';

  logger.warn(`Manual connector sync attempted for ${provider}, but connectors are not available.`);
  return { success: false, error: 'Connectors are not available.' };
}

export async function getConnectorSyncStatusAction(provider: ConnectorProvider) {
  'use server';

  logger.warn(`Connector sync status requested for ${provider}, but connectors are not available.`);
  return { success: false, error: 'Connectors are not available.', status: null };
}

// Server action to get supported student domains from Edge Config
export async function getStudentDomainsAction() {
  'use server';

  try {
    const studentDomainsConfig = await get('student_domains');
    if (studentDomainsConfig && typeof studentDomainsConfig === 'string') {
      // Parse CSV string to array, trim whitespace, and sort alphabetically
      const domains = studentDomainsConfig
        .split(',')
        .map((domain) => domain.trim())
        .filter((domain) => domain.length > 0)
        .sort();

      return {
        success: true,
        domains,
        count: domains.length,
      };
    }

    // Fallback to hardcoded domains if Edge Config fails
    const fallbackDomains = ['.edu', '.ac.in'].sort();
    return {
      success: true,
      domains: fallbackDomains,
      count: fallbackDomains.length,
      fallback: true,
    };
  } catch (error) {
    logger.error('Failed to fetch student domains from Edge Config:', error);

    // Return fallback domains on error
    const fallbackDomains = ['.edu', '.ac.in'].sort();
    return {
      success: false,
      domains: fallbackDomains,
      count: fallbackDomains.length,
      fallback: true,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Referral system actions
export async function generateReferralCode(
  userId: string,
): Promise<{ success: boolean; referralCode?: string; error?: string }> {
  try {
    const currentUser = await getUser();
    if (!currentUser || currentUser.id !== userId) {
      return { success: false, error: 'Unauthorized' };
    }

    // Check if user already has a referral code
    const existingUser = await db.query.user.findFirst({
      where: eq(user.id, userId),
      columns: { referralCode: true },
    });

    if (existingUser?.referralCode) {
      return {
        success: true,
        referralCode: existingUser.referralCode,
      };
    }

    // Generate new referral code
    const referralCode: string = generateReferralCodeUtil();

    // Update user with referral code
    await db
      .update(user)
      .set({
        referralCode,
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));

    return {
      success: true,
      referralCode,
    };
  } catch (error) {
    logger.error('Failed to generate referral code:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function getReferralStats(userId: string): Promise<{
  success: boolean;
  referralCode?: string;
  totalReferrals?: number;
  referrals?: Array<{ id: string; createdAt: Date }>;
  error?: string;
}> {
  try {
    const currentUser = await getUser();
    if (!currentUser || currentUser.id !== userId) {
      return { success: false, error: 'Unauthorized' };
    }

    // Get referral count
    const referrals = await db.query.referral.findMany({
      where: eq(referral.referrerId, userId),
      columns: { id: true, createdAt: true },
    });

    // Get user's referral code
    const userData = await db.query.user.findFirst({
      where: eq(user.id, userId),
      columns: { referralCode: true },
    });

    return {
      success: true,
      referralCode: userData?.referralCode || undefined,
      totalReferrals: referrals.length,
      referrals: referrals.map((r: any) => ({
        id: r.id,
        createdAt: r.createdAt,
      })),
    };
  } catch (error) {
    logger.error('Failed to get referral stats:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function useReferralCode(
  referralCode: string,
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const currentUser = await getUser();
    if (!currentUser) {
      return { success: false, error: 'Not authenticated' };
    }

    // Check if user already used a referral code
    const existingReferral = await db.query.referral.findFirst({
      where: eq(referral.refereeId, currentUser.id),
    });

    if (existingReferral) {
      return { success: false, error: 'You have already used a referral code' };
    }

    // Find the referrer by referral code
    const referrer = await db.query.user.findFirst({
      where: eq(user.referralCode, referralCode),
    });

    if (!referrer) {
      return { success: false, error: 'Invalid referral code' };
    }

    if (referrer.id === currentUser.id) {
      return { success: false, error: 'You cannot use your own referral code' };
    }

    // Create referral record
    await db.insert(referral).values({
      referrerId: referrer.id,
      refereeId: currentUser.id,
      referralCode: referralCode,
    });

    // Update current user's referredBy field
    await db
      .update(user)
      .set({
        referredBy: referrer.id,
        updatedAt: new Date(),
      })
      .where(eq(user.id, currentUser.id));

    return {
      success: true,
      message: 'Referral code applied successfully',
    };
  } catch (error) {
    logger.error('Failed to use referral code:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function updateWalletAddress(
  walletAddress: string,
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const currentUser = await getUser();
    if (!currentUser) {
      return { success: false, error: 'Not authenticated' };
    }

    // Update user's wallet address
    await db
      .update(user)
      .set({
        walletAddress,
        updatedAt: new Date(),
      })
      .where(eq(user.id, currentUser.id));

    return {
      success: true,
      message: 'Wallet address updated successfully',
    };
  } catch (error) {
    logger.error('Failed to update wallet address:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
