'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash, Clock, Plus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { deleteChat, getUserChats } from '@/app/actions';
import { toast } from 'sonner';
import { User } from '@/lib/db/schema';
import { cn } from '@/lib/utils';

interface Chat {
  id: string;
  title: string;
  createdAt: Date;
  userId: string;
  visibility: 'public' | 'private';
}

interface ChatHistoryDrawerProps {
  user: User | null;
}

export function ChatHistoryDrawer({ user }: ChatHistoryDrawerProps) {
  const [open, setOpen] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const currentChatId = pathname?.startsWith('/search/') ? pathname.split('/')[2] : null;

  // Listen for toggle event from navbar
  useEffect(() => {
    const handleToggle = () => setOpen((prev) => !prev);
    window.addEventListener('toggle-history-drawer', handleToggle);
    return () => window.removeEventListener('toggle-history-drawer', handleToggle);
  }, []);

  const loadChats = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const result = await getUserChats(user.id, 50);
      setChats(result.chats);
    } catch (error) {
      console.error('Failed to load chats:', error);
      toast.error('Failed to load chat history');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Load chats when drawer opens
  useEffect(() => {
    if (open && user?.id) {
      loadChats();
    }
  }, [open, user?.id, loadChats]);

  const handleSelectChat = useCallback(
    (id: string) => {
      setOpen(false);
      router.push(`/search/${id}`);
    },
    [router],
  );

  const handleDeleteChat = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeletingId(id);
    try {
      await deleteChat(id);
      setChats((prev) => prev.filter((chat) => chat.id !== id));
      toast.success('Chat deleted');
      if (currentChatId === id) {
        router.push('/');
      }
    } catch (error) {
      console.error('Failed to delete chat:', error);
      toast.error('Failed to delete chat');
    } finally {
      setDeletingId(null);
    }
  };

  const handleNewChat = () => {
    setOpen(false);
    router.push('/');
  };

  if (!user) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="left" className="w-[280px] sm:w-[320px] p-0">
        <div className="flex flex-col h-full">
          {/* Header */}
          <SheetHeader className="px-4 py-3 border-b">
            <SheetTitle className="text-base font-semibold">Chat History</SheetTitle>
          </SheetHeader>

          {/* New Chat Button */}
          <div className="px-3 py-2 border-b">
            <Button onClick={handleNewChat} variant="outline" className="w-full justify-start gap-2 h-9">
              <Plus className="size-4" />
              <span className="text-sm">New Chat</span>
            </Button>
          </div>

          {/* Chat List */}
          <ScrollArea className="flex-1">
            <div className="px-2 py-2 space-y-1">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : chats.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                  <Clock className="size-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No chats yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Start a conversation to see it here</p>
                </div>
              ) : (
                chats.map((chat) => {
                  const isActive = currentChatId === chat.id;
                  const isDeleting = deletingId === chat.id;

                  return (
                    <div
                      key={chat.id}
                      onClick={() => !isDeleting && handleSelectChat(chat.id)}
                      className={cn(
                        'group relative flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors',
                        isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50',
                        isDeleting && 'opacity-50 pointer-events-none',
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{chat.title || 'Untitled Chat'}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(chat.createdAt), { addSuffix: true })}
                        </p>
                      </div>

                      {/* Delete button - shows on hover */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          'size-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity',
                          isActive && 'opacity-100',
                        )}
                        onClick={(e) => handleDeleteChat(e, chat.id)}
                        disabled={isDeleting}
                      >
                        {isDeleting ? (
                          <div className="size-4 animate-spin rounded-full border-2 border-destructive border-t-transparent" />
                        ) : (
                          <Trash className="size-4 text-muted-foreground hover:text-destructive" />
                        )}
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
