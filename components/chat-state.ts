export interface ChatBanner {
  type: 'info' | 'error' | 'success';
  message: string;
}

export interface Attachment {
  name: string;
  contentType?: string;
  mediaType?: string;
  url: string;
  size: number;
}

export interface ChatState {
  hasSubmitted: boolean;
  hasManuallyScrolled: boolean;
  suggestedQuestions: string[];
  attachments: Attachment[];
  selectedVisibilityType: 'public' | 'private';
  banner: ChatBanner | null;
}

export type ChatAction =
  | { type: 'SET_HAS_SUBMITTED'; payload: boolean }
  | { type: 'SET_HAS_MANUALLY_SCROLLED'; payload: boolean }
  | { type: 'SET_SUGGESTED_QUESTIONS'; payload: string[] }
  | { type: 'RESET_SUGGESTED_QUESTIONS' }
  | { type: 'SET_ATTACHMENTS'; payload: Attachment[] }
  | { type: 'SET_VISIBILITY_TYPE'; payload: 'public' | 'private' }
  | { type: 'SET_BANNER'; payload: ChatBanner | null };

export const chatReducer = (state: ChatState, action: ChatAction): ChatState => {
  switch (action.type) {
    case 'SET_HAS_SUBMITTED':
      return { ...state, hasSubmitted: action.payload };
    case 'SET_HAS_MANUALLY_SCROLLED':
      return { ...state, hasManuallyScrolled: action.payload };
    case 'SET_SUGGESTED_QUESTIONS':
      return { ...state, suggestedQuestions: action.payload };
    case 'RESET_SUGGESTED_QUESTIONS':
      return { ...state, suggestedQuestions: [] };
    case 'SET_ATTACHMENTS':
      return { ...state, attachments: action.payload };
    case 'SET_VISIBILITY_TYPE':
      return { ...state, selectedVisibilityType: action.payload };
    case 'SET_BANNER':
      return { ...state, banner: action.payload };
    default:
      return state;
  }
};

export const createInitialState = (initialVisibility: 'public' | 'private' = 'private'): ChatState => ({
  hasSubmitted: false,
  hasManuallyScrolled: false,
  suggestedQuestions: [],
  attachments: [],
  selectedVisibilityType: initialVisibility,
  banner: null,
});
