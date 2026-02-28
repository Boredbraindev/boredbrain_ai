import { customProvider } from 'ai';

import { xai } from '@ai-sdk/xai';
import { google } from '@ai-sdk/google';

// Removed unused middleware and providers - using only Grok and Gemini models

export const boredbrain = customProvider({
  languageModels: {
    // Grok models (xAI) - differentiated routing
    'boredbrain-default': xai('grok-4-fast-non-reasoning'),
    'boredbrain-grok-3': xai('grok-3-latest'),
    'boredbrain-grok-4': xai('grok-4'),
    'boredbrain-grok-4-fast': xai('grok-4-fast-non-reasoning'),
    'boredbrain-grok-4-fast-think': xai('grok-4-fast'),
    'boredbrain-code': xai('grok-4-fast'),
    'boredbrain-enhance': xai('grok-4-fast-non-reasoning'), // For prompt enhancement
    // Google Gemini models
    'boredbrain-google-lite': google('gemini-2.5-flash-lite'),
    'boredbrain-google': google('gemini-2.5-flash'),
    'boredbrain-google-pro': google('gemini-2.5-pro'),
  },
});

interface ModelParameters {
  temperature?: number;
  topP?: number;
  topK?: number;
  minP?: number;
  frequencyPenalty?: number;
}

interface Model {
  value: string;
  label: string;
  description: string;
  vision: boolean;
  reasoning: boolean;
  experimental: boolean;
  category: string;
  pdf: boolean;
  pro: boolean;
  requiresAuth: boolean;
  freeUnlimited: boolean;
  maxOutputTokens: number;
  // Tags
  fast?: boolean;
  isNew?: boolean;
  parameters?: ModelParameters;
}

export const models: Model[] = [
  // Grok models (xAI)
  {
    value: 'boredbrain-grok-3',
    label: 'Grok 3',
    description: "xAI's recent smartest LLM",
    vision: false,
    reasoning: false,
    experimental: false,
    category: 'Pro',
    pdf: false,
    pro: true,
    requiresAuth: true,
    freeUnlimited: false,
    maxOutputTokens: 16000,
  },
  {
    value: 'boredbrain-grok-4',
    label: 'Grok 4',
    description: "xAI's most intelligent LLM",
    vision: true,
    reasoning: true,
    experimental: false,
    category: 'Pro',
    pdf: false,
    pro: true,
    requiresAuth: true,
    freeUnlimited: false,
    maxOutputTokens: 16000,
  },
  {
    value: 'boredbrain-default',
    label: 'Grok 4 Fast',
    description: "xAI's fastest multimodel LLM",
    vision: true,
    reasoning: false,
    experimental: false,
    category: 'Free',
    pdf: false,
    pro: false,
    requiresAuth: false,
    freeUnlimited: false,
    maxOutputTokens: 16000,
    fast: true,
  },
  {
    value: 'boredbrain-grok-4-fast-think',
    label: 'Grok 4 Fast Thinking',
    description: "xAI's fastest multimodel reasoning LLM",
    vision: true,
    reasoning: true,
    experimental: false,
    category: 'Pro',
    pdf: false,
    pro: true,
    requiresAuth: true,
    freeUnlimited: false,
    maxOutputTokens: 16000,
    fast: true,
  },
  {
    value: 'boredbrain-code',
    label: 'Grok Code',
    description: "xAI's advanced coding LLM",
    vision: false,
    reasoning: true,
    experimental: false,
    category: 'Pro',
    pdf: false,
    pro: true,
    requiresAuth: true,
    freeUnlimited: false,
    maxOutputTokens: 16000,
    fast: true,
  },
  // Google Gemini models
  {
    value: 'boredbrain-google-lite',
    label: 'Gemini 2.5 Flash Lite',
    description: "Google's advanced small LLM",
    vision: true,
    reasoning: false,
    experimental: false,
    category: 'Free',
    pdf: true,
    pro: false,
    requiresAuth: true,
    freeUnlimited: false,
    maxOutputTokens: 10000,
  },
  {
    value: 'boredbrain-google',
    label: 'Gemini 2.5 Flash',
    description: "Google's advanced small LLM",
    vision: true,
    reasoning: false,
    experimental: false,
    category: 'Pro',
    pdf: true,
    pro: true,
    requiresAuth: true,
    freeUnlimited: false,
    maxOutputTokens: 10000,
  },
  {
    value: 'boredbrain-google-pro',
    label: 'Gemini 2.5 Pro',
    description: "Google's most advanced LLM",
    vision: true,
    reasoning: false,
    experimental: false,
    category: 'Pro',
    pdf: true,
    pro: true,
    requiresAuth: true,
    freeUnlimited: false,
    maxOutputTokens: 10000,
  },
];

// Helper functions for model access checks
export function getModelConfig(modelValue: string) {
  return models.find((model) => model.value === modelValue);
}

export function requiresAuthentication(modelValue: string): boolean {
  const model = getModelConfig(modelValue);
  return model?.requiresAuth || false;
}

export function requiresProSubscription(modelValue: string): boolean {
  const model = getModelConfig(modelValue);
  return model?.pro || false;
}

export function isFreeUnlimited(modelValue: string): boolean {
  const model = getModelConfig(modelValue);
  return model?.freeUnlimited || false;
}

export function hasVisionSupport(modelValue: string): boolean {
  const model = getModelConfig(modelValue);
  return model?.vision || false;
}

export function hasPdfSupport(modelValue: string): boolean {
  const model = getModelConfig(modelValue);
  return model?.pdf || false;
}

export function hasReasoningSupport(modelValue: string): boolean {
  const model = getModelConfig(modelValue);
  return model?.reasoning || false;
}

export function isExperimentalModel(modelValue: string): boolean {
  const model = getModelConfig(modelValue);
  return model?.experimental || false;
}

export function getMaxOutputTokens(modelValue: string): number {
  const model = getModelConfig(modelValue);
  return model?.maxOutputTokens || 8000;
}

export function getModelParameters(modelValue: string): ModelParameters {
  const model = getModelConfig(modelValue);
  return model?.parameters || {};
}

// Access control helper
export function canUseModel(modelValue: string, user: any, isProUser: boolean): { canUse: boolean; reason?: string } {
  const model = getModelConfig(modelValue);

  if (!model) {
    return { canUse: false, reason: 'Model not found' };
  }

  // Check if model requires authentication
  if (model.requiresAuth && !user) {
    return { canUse: false, reason: 'authentication_required' };
  }

  // Check if model requires Pro subscription
  if (model.pro && !isProUser) {
    return { canUse: false, reason: 'pro_subscription_required' };
  }

  return { canUse: true };
}

// Helper to check if user should bypass rate limits
export function shouldBypassRateLimits(modelValue: string, user: any): boolean {
  const model = getModelConfig(modelValue);
  return Boolean(user && model?.freeUnlimited);
}

// Get acceptable file types for a model
export function getAcceptedFileTypes(modelValue: string, isProUser: boolean): string {
  const model = getModelConfig(modelValue);
  if (model?.pdf && isProUser) {
    return 'image/*,.pdf';
  }
  return 'image/*';
}

// Legacy arrays for backward compatibility (deprecated - use helper functions instead)
export const authRequiredModels = models.filter((m) => m.requiresAuth).map((m) => m.value);
export const proRequiredModels = models.filter((m) => m.pro).map((m) => m.value);
export const freeUnlimitedModels = models.filter((m) => m.freeUnlimited).map((m) => m.value);
