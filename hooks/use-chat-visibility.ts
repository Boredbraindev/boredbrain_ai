
import { useCallback, useReducer } from 'react';
import { updateChatVisibility } from '@/app/actions';
import { invalidateChatsCache } from '@/lib/utils';
import { chatReducer, createInitialState } from '@/components/chat-state';

type VisibilityType = 'public' | 'private';

interface UseChatVisibilityProps {
  chatId?: string;
  showBanner: (type: 'info' | 'error' | 'success', message: string, timeout?: number) => void;
  initialVisibility?: VisibilityType;
}

export function useChatVisibility({ chatId, showBanner, initialVisibility = 'private' }: UseChatVisibilityProps) {
  const [chatState, dispatch] = useReducer(chatReducer, createInitialState(initialVisibility));

  const handleVisibilityChange = useCallback(
    async (visibility: VisibilityType) => {
      if (!chatId) {
        return;
      }

      try {
        const result = await updateChatVisibility(chatId, visibility);
        if (result && result.success) {
          dispatch({ type: 'SET_VISIBILITY_TYPE', payload: visibility });
          invalidateChatsCache();
          showBanner('success', `Chat is now ${visibility}.`);
        } else {
          showBanner('error', 'Failed to update chat visibility.');
        }
      } catch (error) {
        console.error('Error updating chat visibility:', error);
        showBanner('error', 'Failed to update chat visibility.');
      }
    },
    [chatId, showBanner],
  );

  return {
    selectedVisibilityType: chatState.selectedVisibilityType,
    handleVisibilityChange,
    dispatch,
  };
}
