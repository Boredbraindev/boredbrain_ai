import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Bored Brain Signals - Automated Search Monitoring',
  description:
    'Schedule automated searches and get notified when they complete. Monitor trends, track developments, and stay informed with intelligent signals.',
  keywords: 'automated search, monitoring, scheduled queries, AI signals, search automation, trend tracking',
  openGraph: {
    title: 'Bored Brain Signals - Automated Search Monitoring',
    description:
      'Schedule automated searches and get notified when they complete. Monitor trends, track developments, and stay informed with intelligent signals.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bored Brain Signals - Automated Search Monitoring',
    description:
      'Schedule automated searches and get notified when they complete. Monitor trends, track developments, and stay informed with intelligent signals.',
  },
};

interface SignalLayoutProps {
  children: React.ReactNode;
}

export default function SignalLayout({ children }: SignalLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <div className="flex flex-col min-h-screen">
        <main className="flex-1" role="main" aria-label="Signal management">
          {children}
        </main>
      </div>
    </div>
  );
}
