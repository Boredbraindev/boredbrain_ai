'use client';

import { DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MemoryIcon } from '@phosphor-icons/react';

export function MemoryDialog() {
  return (
    <DialogContent className="sm:max-w-[500px] p-6">
      <DialogHeader className="pb-2">
        <DialogTitle className="flex items-center gap-2 text-xl">
          <MemoryIcon className="h-5 w-5" />
          Memories Unavailable
        </DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          The Telegram mini app focuses on real-time search. Memory storage and recall are not available in this
          streamlined experience.
        </DialogDescription>
      </DialogHeader>
      <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
        Switch to the full Bored Brain web app to access saved memories and knowledge base functionality.
      </div>
    </DialogContent>
  );
}
