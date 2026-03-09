'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface SellPromptModalProps {
  chatId?: string;
  messages: Array<{ role: string; content?: string; parts?: any }>;
  onClose: () => void;
}

const CATEGORIES = [
  { value: 'general', label: 'General', icon: '🧠' },
  { value: 'coding', label: 'Coding', icon: '💻' },
  { value: 'research', label: 'Research', icon: '🔬' },
  { value: 'finance', label: 'Finance', icon: '📊' },
  { value: 'creative', label: 'Creative', icon: '✨' },
  { value: 'marketing', label: 'Marketing', icon: '📈' },
];

export function SellPromptModal({ chatId, messages, onClose }: SellPromptModalProps) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [category, setCategory] = useState('general');
  const [tags, setTags] = useState('');
  const [price, setPrice] = useState('50');
  const [creating, setCreating] = useState(false);

  // Extract preview messages from the conversation
  const previewMessages = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(0, 4)
    .map((m) => {
      let content = '';
      if (typeof m.content === 'string') {
        content = m.content;
      } else if (m.parts) {
        const textPart = (m.parts as any[]).find((p: any) => p.type === 'text');
        content = textPart?.text || '';
      }
      return { role: m.role, content: content.slice(0, 200) };
    });

  async function handleCreate() {
    if (!title.trim() || !systemPrompt.trim()) return;

    setCreating(true);
    try {
      const res = await fetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          systemPrompt: systemPrompt.trim(),
          category,
          tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
          previewMessages,
          price,
          sourceChatId: chatId,
        }),
      });
      const data = await res.json();
      if (data.prompt?.id) {
        router.push(`/prompts/${data.prompt.id}`);
      }
    } catch (error) {
      console.error('Failed to create prompt:', error);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border/60 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/30">
          <div>
            <h2 className="text-lg font-bold">Sell as AI Prompt</h2>
            <p className="text-xs text-muted-foreground">Package this conversation into a sellable prompt agent</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>

        {/* Form */}
        <div className="p-4 space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Prompt Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Expert Crypto Analyst"
              className="w-full px-3 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What makes this prompt special?"
              rows={2}
              className="w-full px-3 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">System Prompt</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="The AI system instructions that buyers will get..."
              rows={5}
              className="w-full px-3 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none font-mono"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              This is the core product. Write detailed, battle-tested instructions for the AI.
            </p>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setCategory(cat.value)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition-all ${
                    category === cat.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/40'
                  }`}
                >
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Tags (comma separated)</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g., crypto, defi, trading"
              className="w-full px-3 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Price (BBAI)</label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              min="1"
              className="w-full px-3 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Preview */}
          {previewMessages.length > 0 && (
            <div>
              <label className="text-sm font-medium mb-1.5 block">Preview Conversation</label>
              <div className="bg-muted/30 rounded-lg p-3 border border-border/30 space-y-2">
                {previewMessages.slice(0, 2).map((msg, i) => (
                  <div key={i} className="text-[11px]">
                    <span className={`font-semibold ${msg.role === 'user' ? 'text-blue-400' : 'text-amber-400'}`}>
                      {msg.role === 'user' ? 'User' : 'AI'}:
                    </span>{' '}
                    <span className="text-muted-foreground">{msg.content?.slice(0, 100)}...</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                First messages from this chat will be shown as a preview to buyers.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-border/30">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              Listing Fee: Free
            </Badge>
            <Badge variant="secondary" className="text-xs text-amber-500">
              Earn {price} BBAI per sale
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={!title.trim() || !systemPrompt.trim() || creating}
              className="holographic-button text-white border-0"
            >
              {creating ? 'Publishing...' : 'Publish Prompt'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
