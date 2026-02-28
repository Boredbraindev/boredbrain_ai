
import { useEffect, useReducer } from 'react';
import { chatReducer, createInitialState } from '@/components/chat-state';
import { suggestQuestions } from '@/app/actions';
import { getRandomNFTSuggestions } from '@/components/nft-suggestions';
import { ChatMessage } from '@/lib/types';

interface UseSuggestedQuestionsProps {
  messages: ChatMessage[];
  status: string;
  user: any;
  initialMessages?: any[];
  initialState: { query: string };
  lastSubmittedQueryRef: React.MutableRefObject<string>;
  chatState: ReturnType<typeof useReducer<any, any>>[0];
  dispatch: React.Dispatch<any>;
}

export function useSuggestedQuestions({
  messages,
  status,
  user,
  initialMessages,
  initialState,
  chatState,
  dispatch,
}: UseSuggestedQuestionsProps) {
  useEffect(() => {
    const generateSuggestionsForInitialMessages = async () => {
      if (
        initialMessages &&
        initialMessages.length >= 2 &&
        !chatState.suggestedQuestions.length &&
        (user || chatState.selectedVisibilityType === 'private') &&
        status === 'ready'
      ) {
        const lastUserMessage = initialMessages.filter((m) => m.role === 'user').pop();
        const lastAssistantMessage = initialMessages.filter((m) => m.role === 'assistant').pop();

        if (lastUserMessage && lastAssistantMessage) {
          const getUserContent = (message: any) => {
            if (message.parts && message.parts.length > 0) {
              const lastPart = message.parts[message.parts.length - 1];
              return lastPart.type === 'text' ? lastPart.text : '';
            }
            return message.content || '';
          };

          const getAssistantContent = (message: any) => {
            if (message.parts && message.parts.length > 0) {
              const lastPart = message.parts[message.parts.length - 1];
              return lastPart.type === 'text' ? lastPart.text : '';
            }
            return message.content || '';
          };

          const newHistory = [
            { role: 'user', content: getUserContent(lastUserMessage) },
            { role: 'assistant', content: getAssistantContent(lastAssistantMessage) },
          ];
          try {
            const { questions } = await suggestQuestions(newHistory);
            dispatch({ type: 'SET_SUGGESTED_QUESTIONS', payload: questions });
          } catch (error) {
            console.error('Error generating suggested questions:', error);
          }
        }
      }
    };

    generateSuggestionsForInitialMessages();
  }, [initialMessages, chatState.suggestedQuestions.length, status, user, chatState.selectedVisibilityType, dispatch]);

  useEffect(() => {
    if (
      messages.length === 0 &&
      !chatState.suggestedQuestions.length &&
      status === 'ready' &&
      !initialState.query
    ) {
      const nftSuggestions = getRandomNFTSuggestions(4);
      dispatch({ type: 'SET_SUGGESTED_QUESTIONS', payload: nftSuggestions });
    }
  }, [messages.length, chatState.suggestedQuestions.length, status, initialState.query, dispatch]);

  useEffect(() => {
    if (status === 'streaming') {
      dispatch({ type: 'RESET_SUGGESTED_QUESTIONS' });
    }
  }, [status, dispatch]);
}
