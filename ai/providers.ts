import { customProvider } from 'ai';

import { openai } from '@ai-sdk/openai';

// BoredBrain AI — Single unified model for all interactions
// No model selection UI — clean, focused experience

export const boredbrain = customProvider({
  languageModels: {
    'boredbrain-default': openai('gpt-5-mini'),
  },
});

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
  fast?: boolean;
  isNew?: boolean;
}

// Single model — no selection needed
export const models: Model[] = [
  {
    value: 'boredbrain-default',
    label: 'BoredBrain AI',
    description: 'BoredBrain unified AI model',
    vision: true,
    reasoning: false,
    experimental: false,
    category: 'Free',
    pdf: true,
    pro: false,
    requiresAuth: false,
    freeUnlimited: false,
    maxOutputTokens: 16000,
    fast: true,
  },
];

// Helper functions
export function getModelConfig(modelValue: string) {
  return models.find((model) => model.value === modelValue) || models[0];
}

export function requiresAuthentication(_modelValue: string): boolean {
  return false;
}

export function requiresProSubscription(_modelValue: string): boolean {
  return false;
}

export function isFreeUnlimited(_modelValue: string): boolean {
  return false;
}

export function hasVisionSupport(_modelValue: string): boolean {
  return true;
}

export function hasPdfSupport(_modelValue: string): boolean {
  return true;
}

export function hasReasoningSupport(_modelValue: string): boolean {
  return false;
}

export function isExperimentalModel(_modelValue: string): boolean {
  return false;
}

export function getMaxOutputTokens(_modelValue: string): number {
  return 16000;
}

export function getModelParameters(_modelValue: string): Record<string, unknown> {
  return {};
}

// Access control — always allow
export function canUseModel(_modelValue: string, _user: any, _isProUser: boolean): { canUse: boolean; reason?: string } {
  return { canUse: true };
}

export function shouldBypassRateLimits(_modelValue: string, _user: any): boolean {
  return false;
}

export function getAcceptedFileTypes(_modelValue: string, _isProUser: boolean): string {
  return 'image/*,.pdf';
}

// Legacy arrays (empty — no restrictions)
export const authRequiredModels: string[] = [];
export const proRequiredModels: string[] = [];
export const freeUnlimitedModels: string[] = [];
