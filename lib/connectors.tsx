import type { SVGProps, JSX } from 'react';

export type ConnectorProvider = 'google-drive' | 'notion' | 'onedrive';

export interface ConnectorConfig {
  name: string;
  description: string;
  icon: string;
  documentLimit: number;
  syncTag: string;
  disabledMessage?: string;
}

// Simple placeholder icons to satisfy consumers that render connector logos.
const PlaceholderIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="1em" height="1em" xmlns="http://www.w3.org/2000/svg" {...props}>
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
    <path d="M8 12h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M12 8v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const CONNECTOR_ICONS: Record<string, (props: SVGProps<SVGSVGElement>) => JSX.Element> = {
  'google-drive': PlaceholderIcon,
  notion: PlaceholderIcon,
  onedrive: PlaceholderIcon,
};

export const CONNECTOR_CONFIGS: Record<ConnectorProvider, ConnectorConfig> = {
  'google-drive': {
    name: 'Google Drive',
    description: 'Disabled in Telegram mini app',
    icon: 'google-drive',
    documentLimit: 0,
    syncTag: 'gdrive-sync',
    disabledMessage: 'Google Drive connector is unavailable in the Telegram version.',
  },
  notion: {
    name: 'Notion',
    description: 'Disabled in Telegram mini app',
    icon: 'notion',
    documentLimit: 0,
    syncTag: 'notion-workspace',
    disabledMessage: 'Notion connector is unavailable in the Telegram version.',
  },
  onedrive: {
    name: 'OneDrive',
    description: 'Disabled in Telegram mini app',
    icon: 'onedrive',
    documentLimit: 0,
    syncTag: 'onedrive-sync',
    disabledMessage: 'OneDrive connector is unavailable in the Telegram version.',
  },
};

export async function createConnection(): Promise<never> {
  throw new Error('Connectors are disabled in the Telegram version.');
}

export async function listUserConnections(): Promise<never> {
  throw new Error('Connectors are disabled in the Telegram version.');
}

export async function deleteConnection(): Promise<never> {
  throw new Error('Connectors are disabled in the Telegram version.');
}

export async function manualSync(): Promise<never> {
  throw new Error('Connectors are disabled in the Telegram version.');
}

export async function getSyncStatus(): Promise<null> {
  return null;
}
