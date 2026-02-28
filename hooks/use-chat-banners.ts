
import { useReducer, useRef, useEffect, useCallback } from 'react';
import { chatReducer, createInitialState } from '@/components/chat-state';

type BannerType = 'info' | 'error' | 'success';

export function useChatBanners(initialVisibility: 'public' | 'private' = 'private') {
  const [chatState, dispatch] = useReducer(chatReducer, createInitialState(initialVisibility));
  const bannerTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showBanner = useCallback(
    (type: BannerType, message: string, timeout = 3500) => {
      if (bannerTimeoutRef.current) {
        clearTimeout(bannerTimeoutRef.current);
      }

      dispatch({ type: 'SET_BANNER', payload: { type, message } });

      bannerTimeoutRef.current = setTimeout(() => {
        dispatch({ type: 'SET_BANNER', payload: null });
      }, timeout);
    },
    [dispatch],
  );

  useEffect(() => {
    return () => {
      if (bannerTimeoutRef.current) {
        clearTimeout(bannerTimeoutRef.current);
      }
    };
  }, []);

  return { banner: chatState.banner, showBanner, dispatch };
}
