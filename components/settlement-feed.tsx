'use client';

import { useEffect, useState, useRef } from 'react';
import { Badge } from '@/components/ui/badge';

interface Settlement {
  id: string;
  debateId: string;
  topic: string;
  status: string;
  winningOutcome: string | null;
  totalPool: number;
  participantCount: number;
  txHash: string | null;
  settledBy: string | null;
  settledAt: string | null;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; dotColor: string }> = {
  pending: {
    label: 'Pending',
    color: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20',
    dotColor: 'bg-zinc-400',
  },
  scoring: {
    label: 'Scoring',
    color: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    dotColor: 'bg-amber-400 animate-pulse',
  },
  settled: {
    label: 'Settled',
    color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    dotColor: 'bg-emerald-400',
  },
  recorded: {
    label: 'On-chain',
    color: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
    dotColor: 'bg-blue-400',
  },
};

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function truncateHash(hash: string): string {
  if (hash.length <= 14) return hash;
  return hash.slice(0, 6) + '...' + hash.slice(-4);
}

function OutcomeIcon({ outcome }: { outcome: string | null }) {
  if (!outcome) return null;
  const lower = (outcome ?? '').toLowerCase();
  if (lower === 'yes' || lower === 'for' || lower === 'true') {
    return (
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold shrink-0">
        Y
      </span>
    );
  }
  if (lower === 'no' || lower === 'against' || lower === 'false') {
    return (
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold shrink-0">
        N
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-violet-500/20 text-violet-400 text-[10px] font-bold shrink-0">
      ?
    </span>
  );
}

export default function SettlementFeed() {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const prevIdsRef = useRef<Set<string>>(new Set());

  async function fetchSettlements() {
    try {
      const res = await fetch('/api/settlements?limit=10');
      if (!res.ok) return;
      const data = await res.json();
      const items: Settlement[] = data.settlements ?? [];

      // Detect newly appeared items
      const currentIds = new Set(items.map((s) => s.id));
      const fresh = new Set<string>();
      currentIds.forEach((id) => {
        if (prevIdsRef.current.size > 0 && !prevIdsRef.current.has(id)) {
          fresh.add(id);
        }
      });
      prevIdsRef.current = currentIds;

      if (fresh.size > 0) {
        setNewIds(fresh);
        setTimeout(() => setNewIds(new Set()), 1500);
      }

      setSettlements(items);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSettlements();
    const interval = setInterval(fetchSettlements, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-zinc-800/30 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (settlements.length === 0) {
    return (
      <div className="text-center py-10">
        <div className="text-zinc-600 text-3xl mb-2">--</div>
        <p className="text-zinc-500 text-sm">No settlements recorded yet</p>
        <p className="text-zinc-600 text-xs mt-1">
          Settlements appear when debates close and outcomes are resolved
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 max-h-[480px] overflow-y-auto pr-1">
      {settlements.map((s) => {
        const cfg = STATUS_CONFIG[s.status] ?? STATUS_CONFIG.pending;
        const isNew = newIds.has(s.id);

        return (
          <div
            key={s.id}
            className={`
              p-3 rounded-lg bg-zinc-800/30 hover:bg-zinc-800/60 transition-all duration-500
              border border-transparent
              ${isNew ? 'border-amber-500/40 bg-amber-500/5 animate-[fadeIn_0.5s_ease-out]' : ''}
            `}
          >
            <div className="flex items-start gap-2.5">
              {/* Status dot */}
              <div className="mt-1.5">
                <div className={`w-2 h-2 rounded-full ${cfg.dotColor}`} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {/* Topic line */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-200 truncate">
                    {s.topic.length > 80 ? s.topic.slice(0, 80) + '...' : s.topic}
                  </span>
                </div>

                {/* Details row */}
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <Badge className={`text-[9px] px-1.5 py-0 ${cfg.color}`}>
                    {cfg.label}
                  </Badge>

                  {s.winningOutcome && (
                    <div className="flex items-center gap-1">
                      <OutcomeIcon outcome={s.winningOutcome} />
                      <span className="text-[10px] text-zinc-400 font-medium">
                        {s.winningOutcome}
                      </span>
                    </div>
                  )}

                  {s.totalPool > 0 && (
                    <span className="text-[10px] text-emerald-400 font-semibold tabular-nums">
                      {Math.round(s.totalPool).toLocaleString()} BBAI
                    </span>
                  )}

                  {s.participantCount > 0 && (
                    <span className="text-[10px] text-zinc-500">
                      {s.participantCount} participant{s.participantCount !== 1 ? 's' : ''}
                    </span>
                  )}

                  {s.txHash && (
                    <a
                      href={`https://bscscan.com/tx/${s.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-blue-400 hover:text-blue-300 font-mono transition-colors"
                    >
                      {truncateHash(s.txHash)}
                    </a>
                  )}

                  <span className="text-[10px] text-zinc-600">
                    {timeAgo(s.settledAt ?? s.createdAt)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
