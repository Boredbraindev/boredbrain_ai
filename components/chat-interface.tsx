'use client';
/* eslint-disable @next/next/no-img-element */

// CSS imports
import 'katex/dist/katex.min.css';

// React and React-related imports
import React, { memo, useCallback, useEffect, useMemo, useRef, useReducer, useState } from 'react';

// Third-party library imports
import { useChat } from '@ai-sdk/react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Crown02Icon } from '@hugeicons/core-free-icons';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { parseAsString, useQueryState } from 'nuqs';
import { v4 as uuidv4 } from 'uuid';

// Internal app imports
import { suggestQuestions, updateChatVisibility } from '@/app/actions';
import { getRandomNFTSuggestions } from '@/components/nft-suggestions';

// Component imports
import Messages from '@/components/messages';
import { Navbar } from '@/components/navbar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import FormComponent from '@/components/ui/form-component';
import { ChatHistoryDrawer } from '@/components/chat-history-drawer';
import { VantaBackground } from '@/components/vanta-background';
import { SellPromptModal } from '@/components/sell-prompt-modal';

// Hook imports
import { useAutoResume } from '@/hooks/use-auto-resume';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { useUsageData } from '@/hooks/use-usage-data';
import { useUser } from '@/contexts/user-context';
import { useOptimizedScroll } from '@/hooks/use-optimized-scroll';

// Utility and type imports
import { SEARCH_LIMITS } from '@/lib/constants';
import { ChatSDKError } from '@/lib/errors';
import { cn, SearchGroupId, invalidateChatsCache } from '@/lib/utils';
import { requiresProSubscription } from '@/ai/providers';
import { ConnectorProvider } from '@/lib/connectors';

// State management imports
import { chatReducer, createInitialState } from '@/components/chat-state';
import { useDataStream } from './data-stream-provider';
import { DefaultChatTransport } from 'ai';
import { ChatMessage } from '@/lib/types';

interface ChatInterfaceProps {
  initialChatId?: string;
  initialMessages?: any[];
  initialVisibility?: 'public' | 'private';
  isOwner?: boolean;
}

function ChatInterfaceComponent({
  initialChatId,
  initialMessages,
  initialVisibility = 'private',
  isOwner = true,
}: ChatInterfaceProps): React.JSX.Element {
    const router = useRouter();
    const [query] = useQueryState('query', parseAsString.withDefault(''));
    const [q] = useQueryState('q', parseAsString.withDefault(''));
    const [input, setInput] = useState<string>('');

    const [selectedModel, setSelectedModel] = useLocalStorage('boredbrain-selected-model', 'boredbrain-default');
    const [selectedGroup, setSelectedGroup] = useLocalStorage<SearchGroupId>('boredbrain-selected-group', 'web');
    const [selectedConnectors, setSelectedConnectors] = useState<ConnectorProvider[]>([]);
    const [isCustomInstructionsEnabled, setIsCustomInstructionsEnabled] = useLocalStorage(
      'boredbrain-custom-instructions-enabled',
      true,
    );

    // Sell prompt modal state
    const [showSellPrompt, setShowSellPrompt] = useState(false);

    // Settings dialog state management with URL hash support
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [settingsInitialTab, setSettingsInitialTab] = useState<'account' | 'usage'>('account');

    // Function to open settings with a specific tab
    const handleOpenSettings = useCallback((tab?: string) => {
      const normalizedTab = tab === 'usage' ? 'usage' : 'account';
      setSettingsInitialTab(normalizedTab);
      setSettingsOpen(true);
    }, []);

    // URL hash detection for settings dialog
    useEffect(() => {
      const handleHashChange = () => {
        const hash = window.location.hash;
        if (hash === '#settings') {
          setSettingsOpen(true);
        }
      };

      // Check initial hash
      handleHashChange();

      // Listen for hash changes
      window.addEventListener('hashchange', handleHashChange);

      return () => {
        window.removeEventListener('hashchange', handleHashChange);
      };
    }, []);

    // Update URL hash when settings dialog opens/closes
    useEffect(() => {
      if (settingsOpen) {
        // Only update hash if it's not already #settings to prevent infinite loops
        if (window.location.hash !== '#settings') {
          window.history.pushState(null, '', '#settings');
        }
      } else {
        // Remove hash if settings is closed and hash is #settings
        if (window.location.hash === '#settings') {
          // Use replaceState to avoid adding to browser history
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
      }
    }, [settingsOpen]);

    const [searchProvider, _] = useLocalStorage<'exa' | 'parallel' | 'tavily' | 'firecrawl'>(
      'boredbrain-search-provider',
      'firecrawl',
    );

    // Use reducer for complex state management
    const [chatState, dispatch] = useReducer(chatReducer, createInitialState(initialVisibility));

    const {
      user,
      subscriptionData,
      isProUser: isUserPro,
      isLoading: proStatusLoading,
      shouldCheckLimits: shouldCheckUserLimits,
      shouldBypassLimitsForModel,
    } = useUser();

    const { setDataStream } = useDataStream();

    const initialState = useMemo(
      () => ({
        query: query || q,
      }),
      [query, q],
    );

    const lastSubmittedQueryRef = useRef(initialState.query);
    const bottomRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null!);
    const inputRef = useRef<HTMLTextAreaElement>(null!);
    const initializedRef = useRef(false);
    const bannerTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Use optimized scroll hook
    const { scrollToBottom, markManualScroll, resetManualScroll } = useOptimizedScroll(bottomRef);

    // Listen for manual scroll (wheel and touch)
    useEffect(() => {
      const handleManualScroll = () => markManualScroll();
      window.addEventListener('wheel', handleManualScroll);
      window.addEventListener('touchmove', handleManualScroll);
      return () => {
        window.removeEventListener('wheel', handleManualScroll);
        window.removeEventListener('touchmove', handleManualScroll);
      };
    }, [markManualScroll]);

    // Use clean React Query hooks for all data fetching
    const { data: usageData, refetch: refetchUsage } = useUsageData(user || null);

    // Generate a consistent ID for new chats
    const chatId = useMemo(() => initialChatId ?? uuidv4(), [initialChatId]);

    // Pro users bypass all limit checks - much cleaner!
    const shouldBypassLimits = shouldBypassLimitsForModel(selectedModel);
    const hasExceededLimit =
      shouldCheckUserLimits &&
      !proStatusLoading &&
      !shouldBypassLimits &&
      usageData &&
      usageData.count >= SEARCH_LIMITS.DAILY_SEARCH_LIMIT;
    const isLimitBlocked = Boolean(hasExceededLimit);

    const showBanner = useCallback(
      (type: 'info' | 'error' | 'success', message: string, timeout = 3500) => {
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

    const handleSubscriptionClick = useCallback(() => {
      showBanner('info', 'Subscriptions are paused while the Telegram mini-app is free for everyone.', 4500);
    }, [showBanner]);

    // Auto-switch away from pro models when user loses pro access
    useEffect(() => {
      if (proStatusLoading) return;

      const currentModelRequiresPro = requiresProSubscription(selectedModel);

      // If current model requires pro but user is not pro, switch to default
      // Also prevent infinite loops by ensuring we're not already on the default model
      if (currentModelRequiresPro && !isUserPro && selectedModel !== 'boredbrain-default') {
        console.log(`Auto-switching from pro model '${selectedModel}' to 'boredbrain-default' - user lost pro access`);
        setSelectedModel('boredbrain-default');
        showBanner('info', 'Switched to the default model — premium models require Pro access.');
      }
    }, [selectedModel, isUserPro, proStatusLoading, setSelectedModel, showBanner]);

    type VisibilityType = 'public' | 'private';

    // Create refs to store current values to avoid closure issues
    const selectedModelRef = useRef(selectedModel);
    const selectedGroupRef = useRef(selectedGroup);
    const isCustomInstructionsEnabledRef = useRef(isCustomInstructionsEnabled);
    const searchProviderRef = useRef(searchProvider);
    const selectedConnectorsRef = useRef(selectedConnectors);

    // Update refs whenever state changes - this ensures we always have current values
    selectedModelRef.current = selectedModel;
    selectedGroupRef.current = selectedGroup;
    isCustomInstructionsEnabledRef.current = isCustomInstructionsEnabled;
    selectedConnectorsRef.current = selectedConnectors;

    const { messages, sendMessage, setMessages, regenerate, stop, status, error, resumeStream } = useChat<ChatMessage>({
      id: chatId,
      transport: new DefaultChatTransport({
        api: '/api/search',
        prepareSendMessagesRequest({ messages, body }) {
          // Use ref values to get current state
          return {
            body: {
              id: chatId,
              messages,
              model: selectedModelRef.current,
              group: selectedGroupRef.current,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              isCustomInstructionsEnabled: isCustomInstructionsEnabledRef.current,
              searchProvider: searchProviderRef.current,
              selectedConnectors: selectedConnectorsRef.current,
              ...(initialChatId ? { chat_id: initialChatId } : {}),
              ...body,
            },
          };
        },
      }),
      experimental_throttle: 100,
      onData: (dataPart) => {
        console.log('onData<Client>', dataPart);
        setDataStream((ds) => (ds ? [...ds, dataPart] : []));
      },
      onFinish: async ({ message }) => {
        console.log('onFinish<Client>', message.parts);
        // Refresh usage data after message completion for authenticated users
        if (user) {
          refetchUsage();
        }

        // Only generate suggested questions if authenticated user or private chat
        if (message.parts && message.role === 'assistant' && (user || chatState.selectedVisibilityType === 'private')) {
          const lastPart = message.parts[message.parts.length - 1];
          const lastPartText = lastPart.type === 'text' ? lastPart.text : '';
          const newHistory = [
            { role: 'user', content: lastSubmittedQueryRef.current },
            { role: 'assistant', content: lastPartText },
          ];
          console.log('newHistory', newHistory);
          const { questions } = await suggestQuestions(newHistory);
          dispatch({ type: 'SET_SUGGESTED_QUESTIONS', payload: questions });
        }
      },
      onError: (error) => {
        if (error instanceof ChatSDKError) {
          console.log('ChatSDK Error:', error.type, error.surface, error.message);
          if (error.type === 'offline' || error.surface === 'stream') {
            showBanner('error', error.message || 'Connection error');
          }
        } else {
          console.error('Chat error:', error.cause, error.message);
          showBanner('error', `Oops! Something went wrong. ${error.cause || error.message}`.trim());
        }
      },
      messages: initialMessages || [],
    });

    // Handle text highlighting and quoting
    const handleHighlight = useCallback(
      (text: string) => {
        const quotedText = `> ${text.replace(/\n/g, '\n> ')}\n\n`;
        setInput((prev: string) => prev + quotedText);

        // Focus the input after adding the quote
        setTimeout(() => {
          const inputElement = document.querySelector('textarea[placeholder*="Ask"]') as HTMLTextAreaElement;
          if (inputElement) {
            inputElement.focus();
            // Move cursor to end
            inputElement.setSelectionRange(inputElement.value.length, inputElement.value.length);
          }
        }, 100);
      },
      [setInput],
    );

    // Debug error structure
    if (error) {
      console.log('[useChat error]:', error);
      console.log('[error type]:', typeof error);
      console.log('[error message]:', error.message);
      console.log('[error instance]:', error instanceof Error, error instanceof ChatSDKError);
    }

    useAutoResume({
      autoResume: true,
      initialMessages: initialMessages || [],
      resumeStream,
      setMessages,
    });

    useEffect(() => {
      if (status) {
        console.log('[status]:', status);
      }
    }, [status]);

    useEffect(() => {
      if (user && status === 'streaming' && messages.length > 0) {
        console.log('[chatId]:', chatId);
        // Invalidate chats cache to refresh the list
        invalidateChatsCache();
      }
    }, [user, status, router, chatId, initialChatId, messages.length]);

    useEffect(() => {
      if (!initializedRef.current && initialState.query && !messages.length && !initialChatId) {
        initializedRef.current = true;
        console.log('[initial query]:', initialState.query);
        sendMessage({
          parts: [{ type: 'text', text: initialState.query }],
          role: 'user',
        });
      }
    }, [initialState.query, sendMessage, setInput, messages.length, initialChatId]);

    // Generate suggested questions when opening a chat directly
    useEffect(() => {
      const generateSuggestionsForInitialMessages = async () => {
        // Only generate if we have initial messages, no suggested questions yet,
        // user is authenticated or chat is private, and status is not streaming
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
            // Extract content from parts similar to onFinish callback
            const getUserContent = (message: typeof lastUserMessage) => {
              if (message.parts && message.parts.length > 0) {
                const lastPart = message.parts[message.parts.length - 1];
                return lastPart.type === 'text' ? lastPart.text : '';
              }
              return message.content || '';
            };

            const getAssistantContent = (message: typeof lastAssistantMessage) => {
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
    }, [initialMessages, chatState.suggestedQuestions.length, status, user, chatState.selectedVisibilityType]);

    // Show NFT suggestions when chat is empty
    useEffect(() => {
      if (
        messages.length === 0 &&
        !chatState.suggestedQuestions.length &&
        status === 'ready' &&
        !initialState.query
      ) {
        // Set random NFT suggestions for empty state
        const nftSuggestions = getRandomNFTSuggestions(4);
        dispatch({ type: 'SET_SUGGESTED_QUESTIONS', payload: nftSuggestions });
      }
    }, [messages.length, chatState.suggestedQuestions.length, status, initialState.query]);

    // Reset suggested questions when status changes to streaming
    useEffect(() => {
      if (status === 'streaming') {
        // Clear suggested questions when a new message is being streamed
        dispatch({ type: 'RESET_SUGGESTED_QUESTIONS' });
      }
    }, [status]);

    const lastUserMessageIndex = useMemo(() => {
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'user') {
          return i;
        }
      }
      return -1;
    }, [messages]);

    useEffect(() => {
      // Reset manual scroll when streaming starts
      if (status === 'streaming') {
        resetManualScroll();
        scrollToBottom();
      }
    }, [status, resetManualScroll, scrollToBottom]);

    // Auto-scroll during streaming when messages change
    useEffect(() => {
      if (status === 'streaming') {
        scrollToBottom();
      }
    }, [messages, status, scrollToBottom]);

    // Define the model change handler
    const handleModelChange = useCallback(
      (model: string) => {
        setSelectedModel(model);
      },
      [setSelectedModel],
    );

    const resetSuggestedQuestions = useCallback(() => {
      dispatch({ type: 'RESET_SUGGESTED_QUESTIONS' });
    }, []);

    const showEmptyState = status === 'ready' && messages.length === 0;
    const bannerColors: Record<'info' | 'error' | 'success', string> = {
      info: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100',
      success:
        'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100',
      error: 'border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100',
    };

    // Handle visibility change
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

    return (
      <div className="flex min-h-[100dvh] w-full flex-col bg-background text-foreground relative">
        {/* WebGL Background — reacts to AI streaming state */}
        <VantaBackground isStreaming={status === 'streaming'} />
        <Navbar
          chatId={initialChatId || (messages.length > 0 ? chatId : null)}
          selectedVisibilityType={chatState.selectedVisibilityType}
          onVisibilityChange={handleVisibilityChange}
          user={user || null}
          isOwner={isOwner}
          subscriptionData={subscriptionData}
          isProUser={isUserPro}
          isProStatusLoading={proStatusLoading}
          isCustomInstructionsEnabled={isCustomInstructionsEnabled}
          setIsCustomInstructionsEnabled={setIsCustomInstructionsEnabled}
          settingsOpen={settingsOpen}
          setSettingsOpen={setSettingsOpen}
          settingsInitialTab={settingsInitialTab}
        />

        <main className="flex flex-1 flex-col pt-20">
          <div
            className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-3"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}
          >
            {chatState.banner && (
              <div
                className={cn(
                  'rounded-xl border px-4 py-3 text-sm font-medium transition-colors',
                  bannerColors[chatState.banner.type],
                )}
                role="status"
              >
                {chatState.banner.message}
              </div>
            )}

            <div className="flex-1 overflow-hidden rounded-3xl border border-border/60 bg-card/95 shadow-lg">
              <div className="flex h-full flex-col">
                <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
                  {showEmptyState ? (
                    isLimitBlocked ? (
                      <div className="mx-auto flex max-w-sm flex-col items-center justify-center gap-4 text-center">
                        <div className="flex size-16 items-center justify-center rounded-full bg-muted/40">
                          <HugeiconsIcon icon={Crown02Icon} size={26} className="text-muted-foreground" strokeWidth={1.5} />
                        </div>
                        <div className="space-y-2">
                          <h2 className="text-xl font-semibold">Daily limit reached</h2>
                          <p className="text-sm text-muted-foreground">
                            You&apos;ve used all {SEARCH_LIMITS.DAILY_SEARCH_LIMIT} searches for today. Please try again
                            tomorrow while open access continues.
                          </p>
                        </div>
                        <div className="flex w-full flex-col gap-2">
                          <Button className="w-full" onClick={handleSubscriptionClick}>
                            Subscriptions paused
                          </Button>
                          <Button variant="ghost" className="w-full" onClick={() => refetchUsage()}>
                            Try refreshing
                          </Button>
                        </div>
                      </div>
                    ) : (
                      /* ===== EMPTY STATE — app-style compact hero ===== */
                      <div className="hero-gradient-bg flex flex-col px-5 sm:px-8 py-8 sm:py-10 mx-2 sm:mx-4 mt-2 overflow-hidden">

                        {/* Hero — centered, compact */}
                        <div className="text-center max-w-2xl mx-auto space-y-4 mb-8 sm:mb-10">
                          <p className="font-mono-wide text-[10px] text-muted-foreground/40 tracking-[0.25em]">
                            BAYC-ROOTED MARKET INTELLIGENCE
                          </p>
                          <h1 className="font-mono-wide leading-[1.15] tracking-[0.06em]">
                            <span className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">TRADE THE MOVE </span>
                            <span className="text-2xl sm:text-3xl md:text-4xl font-bold text-gradient-warm">BEFORE THE TREND</span>
                          </h1>
                          <p className="text-xs sm:text-sm text-muted-foreground/50 max-w-md mx-auto leading-relaxed">
                            On-chain whispers, social swells, and floor volatility
                            distilled into decisive signals — powered by 27+ AI tools.
                          </p>
                        </div>

                        {/* Live signals — horizontal 3-col */}
                        <div className="max-w-3xl mx-auto w-full mb-8 sm:mb-10">
                          <div className="flex items-center justify-between mb-3 px-1">
                            <span className="font-mono-wide text-[9px] text-muted-foreground/30 tracking-[0.2em]">LIVE SIGNALS</span>
                            <span className="font-mono-wide text-[9px] text-muted-foreground/30 tracking-[0.2em] flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-live inline-block" />
                              REAL-TIME
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            {[
                              { label: 'WALLET SURGE', text: '7 whales accumulating $BNB', color: 'border-emerald-500/20', accent: 'text-emerald-400' },
                              { label: 'TOKEN PUMP', text: '$MXY tight consolidation breakout', color: 'border-amber-500/20', accent: 'text-amber-400' },
                              { label: 'SOCIAL SPIKE', text: '#BoredBrain trending in 18 groups', color: 'border-purple-500/20', accent: 'text-purple-400' },
                            ].map((s) => (
                              <div key={s.label} className={`signal-card ${s.color} p-3.5 sm:p-4`}>
                                <p className={`font-mono-wide text-[9px] tracking-[0.2em] mb-1.5 ${s.accent}`}>{s.label}</p>
                                <p className="text-xs sm:text-sm font-semibold text-white/90 leading-snug">{s.text}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Feature stats — 4-col grid */}
                        <div className="max-w-3xl mx-auto w-full mb-6">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                            {[
                              { name: 'WHALE TRACE', stat: '+18', unit: 'WALLETS', color: 'text-emerald-400', href: '/agents' },
                              { name: 'FLOOR WATCH', stat: '+6.2', unit: '%', color: 'text-amber-400', href: '/stats' },
                              { name: 'SOCIAL SURGE', stat: 'x3', unit: 'MENTIONS', color: 'text-purple-400', href: '/agents' },
                              { name: 'ALPHA FEED', stat: '21', unit: 'BRIEFS', color: 'text-cyan-400', href: '/dashboard' },
                            ].map((f) => (
                              <Link key={f.name} href={f.href}>
                                <div className="signal-card p-3.5 sm:p-4 text-center group cursor-pointer hover:scale-[1.02] transition-transform">
                                  <p className="font-mono-wide text-[8px] text-muted-foreground/30 tracking-[0.2em] mb-1.5">{f.name}</p>
                                  <p className={`text-xl sm:text-2xl font-bold ${f.color} leading-none`}>
                                    {f.stat}<span className="text-[10px] sm:text-xs ml-0.5 font-mono-wide opacity-70">{f.unit}</span>
                                  </p>
                                </div>
                              </Link>
                            ))}
                          </div>
                        </div>

                        {/* Bottom bar */}
                        <div className="max-w-3xl mx-auto w-full flex items-center justify-between pt-4 border-t border-white/5">
                          <div className="flex items-center gap-3 text-[9px] text-muted-foreground/25 font-mono-wide tracking-[0.15em]">
                            <span>27+ TOOLS</span>
                            <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/20" />
                            <span>BASE + BSC</span>
                            <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/20" />
                            <span>BBAI</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="inline-flex items-center gap-1 text-[9px] font-mono-wide text-emerald-400/60 tracking-widest">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              AUDITED
                            </span>
                            <span className="inline-flex items-center gap-1 text-[9px] font-mono-wide text-emerald-400/60 tracking-widest">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              LOCKED
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  ) : (
                    <Messages
                      messages={messages as ChatMessage[]}
                      lastUserMessageIndex={lastUserMessageIndex}
                      input={input}
                      setInput={setInput}
                      setMessages={(messages) => {
                        setMessages(messages as ChatMessage[]);
                      }}
                      sendMessage={sendMessage}
                      regenerate={regenerate}
                      suggestedQuestions={chatState.suggestedQuestions}
                      setSuggestedQuestions={(questions) =>
                        dispatch({ type: 'SET_SUGGESTED_QUESTIONS', payload: questions })
                      }
                      status={status}
                      error={error ?? null}
                      user={user}
                      selectedVisibilityType={chatState.selectedVisibilityType}
                      chatId={initialChatId || (messages.length > 0 ? chatId : undefined)}
                      onVisibilityChange={handleVisibilityChange}
                      initialMessages={initialMessages}
                      isOwner={isOwner}
                      onHighlight={handleHighlight}
                    />
                  )}
                  <div ref={bottomRef} />
                </div>
              </div>
            </div>

            {/* Sell as Prompt Button */}
            {user && messages.length >= 2 && status !== 'streaming' && (
              <div className="flex justify-end mb-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7 gap-1.5 text-amber-500 border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-400"
                  onClick={() => setShowSellPrompt(true)}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Sell as Prompt
                </Button>
              </div>
            )}

            {/* Sell Prompt Modal */}
            {showSellPrompt && (
              <SellPromptModal
                chatId={initialChatId || chatId}
                messages={messages as any[]}
                onClose={() => setShowSellPrompt(false)}
              />
            )}

            {((user && isOwner) || !initialChatId || (!user && chatState.selectedVisibilityType === 'private')) &&
              !isLimitBlocked && (
                <div className="rounded-3xl border border-border/60 bg-card/95 p-3 shadow-lg sm:p-4">
                  <FormComponent
                    chatId={chatId}
                    user={user!}
                    subscriptionData={subscriptionData}
                    input={input}
                    setInput={setInput}
                    attachments={chatState.attachments}
                    setAttachments={(attachments) => {
                      const newAttachments =
                        typeof attachments === 'function' ? attachments(chatState.attachments) : attachments;
                      dispatch({ type: 'SET_ATTACHMENTS', payload: newAttachments });
                    }}
                    fileInputRef={fileInputRef}
                    inputRef={inputRef}
                    stop={stop}
                    messages={messages as ChatMessage[]}
                    sendMessage={sendMessage}
                    selectedModel={selectedModel}
                    setSelectedModel={handleModelChange}
                    resetSuggestedQuestions={resetSuggestedQuestions}
                    lastSubmittedQueryRef={lastSubmittedQueryRef}
                    selectedGroup={selectedGroup}
                    setSelectedGroup={setSelectedGroup}
                    showExperimentalModels={messages.length === 0}
                    status={status}
                    setHasSubmitted={(hasSubmitted) => {
                      const newValue =
                        typeof hasSubmitted === 'function' ? hasSubmitted(chatState.hasSubmitted) : hasSubmitted;
                      dispatch({ type: 'SET_HAS_SUBMITTED', payload: newValue });
                    }}
                    isLimitBlocked={isLimitBlocked}
                    onOpenSettings={handleOpenSettings}
                    selectedConnectors={selectedConnectors}
                    setSelectedConnectors={setSelectedConnectors}
                  />
                </div>
              )}

            {isLimitBlocked && messages.length > 0 && (
              <div className="rounded-2xl border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground shadow-inner">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 font-medium text-foreground">
                    <HugeiconsIcon icon={Crown02Icon} size={16} strokeWidth={1.5} />
                    Daily limit reached ({SEARCH_LIMITS.DAILY_SEARCH_LIMIT} searches used)
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => refetchUsage()}>
                      Refresh
                    </Button>
                    <Button size="sm" onClick={handleSubscriptionClick}>
                      Subscriptions paused
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Chat History Drawer */}
        <ChatHistoryDrawer user={user || null} />
      </div>
    );
  }

const ChatInterface = memo(ChatInterfaceComponent);

// Add a display name for the memoized component for better debugging
ChatInterface.displayName = 'ChatInterface';

export { ChatInterface };
