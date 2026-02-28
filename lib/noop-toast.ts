import React from 'react';

type ToastPayload = string | number | undefined;

type ToastFn = (message: string, options?: Record<string, any>) => ToastPayload;

const noop: ToastFn = (_message, options) => options?.id ?? '';

const toastHandler = Object.assign(
  (message: string, options?: Record<string, any>) => noop(message, options),
  {
    success: noop,
    error: noop,
    info: noop,
    message: noop,
    loading: noop,
    warning: noop,
    dismiss: (_id?: ToastPayload) => {},
  },
);

export const toast = toastHandler;

// ToasterProps type to match sonner API
export type ToasterProps = {
  theme?: 'light' | 'dark' | 'system';
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';
  expand?: boolean;
  richColors?: boolean;
  duration?: number;
  closeButton?: boolean;
  className?: string;
  style?: React.CSSProperties;
  [key: string]: any; // Allow any other props
};

export const Toaster = (_props?: ToasterProps) => null;

export type Toast = typeof toastHandler;
