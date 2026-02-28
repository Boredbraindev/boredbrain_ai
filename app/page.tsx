import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { ChatInterface } from '@/components/chat-interface';

export default async function HomePage() {
  // Check if guest access is enabled
  const allowGuestAccess =
    (process.env.NEXT_PUBLIC_ALLOW_GUEST_ACCESS ?? process.env.ALLOW_GUEST_ACCESS ?? 'false') !== 'false';

  if (allowGuestAccess) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-background" />}>
        <ChatInterface />
      </Suspense>
    );
  }

  // Browser users: redirect to sign-in
  redirect('/sign-in');
}
