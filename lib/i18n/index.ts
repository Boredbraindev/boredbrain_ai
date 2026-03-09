'use client';

import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { translations, type Locale, type TranslationKeys } from './translations';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const STORAGE_KEY = 'boredbrain-locale';
const DEFAULT_LOCALE: Locale = 'en';
const SUPPORTED_LOCALES: Locale[] = ['en', 'ko'];

// ---------------------------------------------------------------------------
// Internal store (singleton so every hook shares the same state)
// ---------------------------------------------------------------------------
let currentLocale: Locale = DEFAULT_LOCALE;
const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

function getSnapshot(): Locale {
  return currentLocale;
}

function getServerSnapshot(): Locale {
  return DEFAULT_LOCALE;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ---------------------------------------------------------------------------
// Detect locale from browser or localStorage
// ---------------------------------------------------------------------------
function detectLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;

  // 1. Check localStorage
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED_LOCALES.includes(stored as Locale)) {
      return stored as Locale;
    }
  } catch {
    // localStorage not available
  }

  // 2. Check browser language
  const browserLang = navigator.language?.toLowerCase() ?? '';
  if (browserLang.startsWith('ko')) return 'ko';

  return DEFAULT_LOCALE;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Set the active locale and persist to localStorage. */
export function setLocale(locale: Locale): void {
  if (!SUPPORTED_LOCALES.includes(locale)) return;
  currentLocale = locale;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // ignore
  }
  emitChange();
}

/** Get a translated string by key. */
export function t(key: TranslationKeys): string {
  return translations[currentLocale]?.[key] ?? translations[DEFAULT_LOCALE][key] ?? key;
}

/** Get the current locale value (non-reactive). */
export function getLocale(): Locale {
  return currentLocale;
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * useTranslation() - React hook for i18n.
 *
 * @returns { t, locale, setLocale }
 *
 * Usage:
 * ```tsx
 * const { t, locale, setLocale } = useTranslation();
 * return <h1>{t('page.home.title')}</h1>;
 * ```
 */
export function useTranslation() {
  const locale = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Initialise locale from browser/localStorage on first mount
  useEffect(() => {
    const detected = detectLocale();
    if (detected !== currentLocale) {
      currentLocale = detected;
      emitChange();
    }
  }, []);

  const translate = useCallback(
    (key: TranslationKeys): string => {
      return translations[locale]?.[key] ?? translations[DEFAULT_LOCALE][key] ?? key;
    },
    [locale],
  );

  return {
    t: translate,
    locale,
    setLocale,
  } as const;
}

export type { Locale, TranslationKeys };
