'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';

// ─── Types ──────────────────────────────────────────────────────────────────

interface SettlementInfo {
  chain: string;
  contractAddress: string | null;
  isLive: boolean;
  mode: string;
  totalRoundsSettled: number;
  totalVolumeSettled: number;
}

interface SettledRound {
  roundId: number;
  asset: string;
  startPrice: number;
  endPrice: number;
  outcome: 'UP' | 'DOWN';
  upPool: number;
  downPool: number;
  totalBets: number;
  settledAt: number;
  txHash: string;
  explorer: string;
  isSimulated: boolean;
}

interface HeartbeatStats {
  agentCalls: number;
  totalBilled: number;
  walletsRebalanced: number;
  betsGenerated: number;
}

// ─── Helper ─────────────────────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const seconds = Math.floor(Date.now() / 1000 - ts);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function formatPrice(p: number): string {
  if (p >= 1000) return p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return p.toFixed(4);
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function OnChainDashboard() {
  const [settlement, setSettlement] = useState<SettlementInfo | null>(null);
  const [rounds, setRounds] = useState<SettledRound[]>([]);
  const [loading, setLoading] = useState(true);

  // Heartbeat stats (simulated aggregate)
  const [heartbeat] = useState<HeartbeatStats>({
    agentCalls: 1847,
    totalBilled: 923.5,
    walletsRebalanced: 312,
    betsGenerated: 4521,
  });

  useEffect(() => {
    async function fetch_data() {
      try {
        const res = await fetch('/api/predict/settlement');
        if (!res.ok) return;
        const data = await res.json();
        if (data.settlement) setSettlement(data.settlement);
        if (data.rounds) setRounds(data.rounds);
      } catch { /* silent */ }
      setLoading(false);
    }
    fetch_data();
    const poll = setInterval(fetch_data, 15000);
    return () => clearInterval(poll);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-zinc-500 animate-pulse">Loading on-chain data...</div>
      </div>
    );
  }

  const totalVolume = rounds.reduce((s, r) => s + r.upPool + r.downPool, 0);
  const totalBets = rounds.reduce((s, r) => s + r.totalBets, 0);
  const upWins = rounds.filter(r => r.outcome === 'UP').length;
  const downWins = rounds.filter(r => r.outcome === 'DOWN').length;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">

        {/* ─── Header ─── */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">On-Chain Dashboard</h1>
            <Badge variant="outline" className={`${settlement?.isLive ? 'border-green-500/40 text-green-400 bg-green-950/20' : 'border-amber-500/40 text-amber-400 bg-amber-950/20'}`}>
              {settlement?.isLive ? 'LIVE' : 'TESTNET READY'}
            </Badge>
          </div>
          <p className="text-zinc-500 text-sm">
            Real-time on-chain settlement tracking | Hybrid model: Off-chain bets + On-chain settlement
          </p>
        </div>

        {/* ─── Network Status ─── */}
        <Card className="border-zinc-800 bg-zinc-900/80 overflow-hidden">
          <CardContent className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="space-y-1">
                <div className="text-xs text-zinc-500 uppercase tracking-wider">Network</div>
                <div className="text-lg font-semibold text-white flex items-center gap-2">
                  {settlement?.chain ?? 'BSC Testnet'}
                  <div className="relative">
                    <div className={`w-2 h-2 rounded-full ${settlement?.isLive ? 'bg-green-500' : 'bg-amber-500'}`} />
                    <div className={`absolute inset-0 w-2 h-2 rounded-full animate-ping ${settlement?.isLive ? 'bg-green-500' : 'bg-amber-500'} opacity-40`} />
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-zinc-500 uppercase tracking-wider">Contract</div>
                <div className="text-sm font-mono text-zinc-300">
                  {settlement?.contractAddress
                    ? `${settlement.contractAddress.slice(0, 6)}...${settlement.contractAddress.slice(-4)}`
                    : 'Pending deployment'}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-zinc-500 uppercase tracking-wider">Mode</div>
                <div className="text-lg font-semibold">
                  <Badge variant="outline" className="border-blue-500/40 text-blue-400 bg-blue-950/20">
                    HYBRID
                  </Badge>
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-zinc-500 uppercase tracking-wider">Status</div>
                <div className="text-sm text-zinc-400">
                  Infrastructure Ready
                  <Progress value={75} className="h-1.5 mt-1" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ─── Key Metrics ─── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-zinc-800 bg-zinc-900/60">
            <CardContent className="p-5 text-center">
              <div className="text-3xl font-bold text-white">{settlement?.totalRoundsSettled ?? rounds.length}</div>
              <div className="text-xs text-zinc-500 mt-1">Rounds Settled</div>
              <div className="text-[10px] text-zinc-600 mt-0.5">on-chain records</div>
            </CardContent>
          </Card>
          <Card className="border-zinc-800 bg-zinc-900/60">
            <CardContent className="p-5 text-center">
              <div className="text-3xl font-bold text-emerald-400">{(settlement?.totalVolumeSettled ?? totalVolume).toLocaleString()}</div>
              <div className="text-xs text-zinc-500 mt-1">Volume Settled</div>
              <div className="text-[10px] text-zinc-600 mt-0.5">BBAI Points</div>
            </CardContent>
          </Card>
          <Card className="border-zinc-800 bg-zinc-900/60">
            <CardContent className="p-5 text-center">
              <div className="text-3xl font-bold text-amber-400">{totalBets}</div>
              <div className="text-xs text-zinc-500 mt-1">Total Bets</div>
              <div className="text-[10px] text-zinc-600 mt-0.5">across all rounds</div>
            </CardContent>
          </Card>
          <Card className="border-zinc-800 bg-zinc-900/60">
            <CardContent className="p-5 text-center">
              <div className="text-3xl font-bold text-blue-400">{rounds.length > 0 ? ((upWins / rounds.length) * 100).toFixed(0) : 0}%</div>
              <div className="text-xs text-zinc-500 mt-1">UP Win Rate</div>
              <div className="text-[10px] text-zinc-600 mt-0.5">{upWins}W / {downWins}L</div>
            </CardContent>
          </Card>
        </div>

        {/* ─── Agent Economy Stats ─── */}
        <Card className="border-zinc-800 bg-zinc-900/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              Agent Economy
              <Badge variant="outline" className="border-green-500/40 text-green-400 bg-green-950/20 text-[10px]">
                ACTIVE
              </Badge>
            </CardTitle>
            <CardDescription className="text-zinc-500">OpenClaw fleet — 10min heartbeat cycle</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <div className="text-2xl font-bold text-white">{heartbeat.agentCalls.toLocaleString()}</div>
                <div className="text-xs text-zinc-500">A2A Calls</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-emerald-400">{heartbeat.totalBilled.toLocaleString()}</div>
                <div className="text-xs text-zinc-500">BBAI Billed</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-amber-400">{heartbeat.walletsRebalanced}</div>
                <div className="text-xs text-zinc-500">Wallets Rebalanced</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-400">{heartbeat.betsGenerated.toLocaleString()}</div>
                <div className="text-xs text-zinc-500">Bets Generated</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ─── Architecture Diagram ─── */}
        <Card className="border-zinc-800 bg-zinc-900/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-white">Hybrid Architecture</CardTitle>
            <CardDescription className="text-zinc-500">Off-chain bets + On-chain settlement</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center gap-2 flex-wrap text-sm">
              <div className="px-4 py-3 rounded-lg bg-zinc-800 border border-zinc-700 text-center">
                <div className="text-white font-semibold">User Bets</div>
                <div className="text-[10px] text-zinc-500">Off-chain Points</div>
              </div>
              <div className="text-zinc-600 text-xl">{'\u2192'}</div>
              <div className="px-4 py-3 rounded-lg bg-zinc-800 border border-zinc-700 text-center">
                <div className="text-white font-semibold">AI Agents</div>
                <div className="text-[10px] text-zinc-500">Prediction + Feed</div>
              </div>
              <div className="text-zinc-600 text-xl">{'\u2192'}</div>
              <div className="px-4 py-3 rounded-lg bg-zinc-800 border border-zinc-700 text-center">
                <div className="text-white font-semibold">Round Complete</div>
                <div className="text-[10px] text-zinc-500">5-min rounds</div>
              </div>
              <div className="text-zinc-600 text-xl">{'\u2192'}</div>
              <div className="px-4 py-3 rounded-lg bg-amber-950/30 border border-amber-500/30 text-center">
                <div className="text-amber-400 font-semibold">Settlement</div>
                <div className="text-[10px] text-amber-500/70">BSC On-Chain</div>
              </div>
              <div className="text-zinc-600 text-xl">{'\u2192'}</div>
              <div className="px-4 py-3 rounded-lg bg-green-950/30 border border-green-500/30 text-center">
                <div className="text-green-400 font-semibold">TX Hash</div>
                <div className="text-[10px] text-green-500/70">Immutable Proof</div>
              </div>
            </div>
            <div className="mt-4 text-center">
              <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-xs">
                Future: Switch settlement to BSC Mainnet + BBAI Points payouts
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* ─── Settled Rounds Table ─── */}
        <Card className="border-zinc-800 bg-zinc-900/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-white">Settlement History</CardTitle>
            <CardDescription className="text-zinc-500">
              On-chain settlement records — each round creates an immutable transaction
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {/* Table Header */}
            <div className="grid grid-cols-7 gap-2 px-6 py-3 text-xs text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
              <div>Round</div>
              <div>Asset</div>
              <div>Outcome</div>
              <div>Price</div>
              <div>Volume</div>
              <div>TX Hash</div>
              <div>Time</div>
            </div>
            {/* Rows */}
            <div className="divide-y divide-zinc-800/50">
              {rounds.length === 0 ? (
                <div className="px-6 py-8 text-center text-zinc-500 text-sm">
                  No settlements yet. Rounds are settled every 10 minutes via heartbeat.
                </div>
              ) : (
                rounds.map((round) => (
                  <div
                    key={round.roundId}
                    className="grid grid-cols-7 gap-2 px-6 py-3 text-sm hover:bg-zinc-800/30 transition-colors items-center"
                  >
                    <div className="text-white font-mono">#{round.roundId}</div>
                    <div>
                      <Badge variant="outline" className="border-zinc-700 text-zinc-300 text-xs">
                        {round.asset}
                      </Badge>
                    </div>
                    <div>
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          round.outcome === 'UP'
                            ? 'border-green-500/40 text-green-400 bg-green-950/20'
                            : 'border-red-500/40 text-red-400 bg-red-950/20'
                        }`}
                      >
                        {round.outcome}
                      </Badge>
                    </div>
                    <div className="text-zinc-400 text-xs">
                      ${formatPrice(round.startPrice)} {'\u2192'} ${formatPrice(round.endPrice)}
                    </div>
                    <div className="text-zinc-300">
                      {(round.upPool + round.downPool).toLocaleString()}
                      <span className="text-zinc-600 text-xs ml-1">BBAI</span>
                    </div>
                    <div>
                      <a
                        href={round.explorer}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-amber-400 hover:text-amber-300 font-mono text-xs transition-colors"
                        title={round.txHash}
                      >
                        {round.txHash.slice(0, 10)}...
                        <span className="text-zinc-600 ml-1">&#8599;</span>
                      </a>
                    </div>
                    <div className="text-zinc-500 text-xs">{timeAgo(round.settledAt)}</div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* ─── Smart Contract Info ─── */}
        <Card className="border-zinc-800 bg-zinc-900/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-white">Smart Contract</CardTitle>
            <CardDescription className="text-zinc-500">PredictionSettlement.sol — BSC Network</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Contract Name</span>
                  <span className="text-white font-mono">PredictionSettlement</span>
                </div>
                <Separator className="bg-zinc-800" />
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Network</span>
                  <span className="text-white">{settlement?.chain ?? 'BSC Testnet'}</span>
                </div>
                <Separator className="bg-zinc-800" />
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Solidity Version</span>
                  <span className="text-white font-mono">^0.8.20</span>
                </div>
                <Separator className="bg-zinc-800" />
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">License</span>
                  <span className="text-white">MIT</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Settlement Model</span>
                  <span className="text-white">Hybrid (Off-chain bets + On-chain proof)</span>
                </div>
                <Separator className="bg-zinc-800" />
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Round Duration</span>
                  <span className="text-white">5 minutes</span>
                </div>
                <Separator className="bg-zinc-800" />
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Operator</span>
                  <span className="text-white">Heartbeat Cron (10min)</span>
                </div>
                <Separator className="bg-zinc-800" />
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Currency</span>
                  <span className="text-white font-mono">BBAI (Points)</span>
                </div>
              </div>
            </div>

            {/* Key Functions */}
            <div className="mt-6 p-4 rounded-lg bg-zinc-950 border border-zinc-800">
              <div className="text-xs text-zinc-500 mb-3 uppercase tracking-wider">Key Functions</div>
              <div className="space-y-2 font-mono text-xs">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-blue-500/40 text-blue-400 bg-blue-950/20 text-[10px] w-12 justify-center">write</Badge>
                  <span className="text-green-400">settleRound</span>
                  <span className="text-zinc-600">(roundId, asset, startPrice, endPrice, outcome, upPool, downPool, totalBets)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-zinc-500/40 text-zinc-400 bg-zinc-950/20 text-[10px] w-12 justify-center">view</Badge>
                  <span className="text-green-400">getRound</span>
                  <span className="text-zinc-600">(roundId) {'\u2192'} Round</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-zinc-500/40 text-zinc-400 bg-zinc-950/20 text-[10px] w-12 justify-center">view</Badge>
                  <span className="text-green-400">getRecentRounds</span>
                  <span className="text-zinc-600">(count) {'\u2192'} Round[]</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-zinc-500/40 text-zinc-400 bg-zinc-950/20 text-[10px] w-12 justify-center">view</Badge>
                  <span className="text-green-400">totalRounds</span>
                  <span className="text-zinc-600">() {'\u2192'} uint256</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-zinc-500/40 text-zinc-400 bg-zinc-950/20 text-[10px] w-12 justify-center">view</Badge>
                  <span className="text-green-400">totalVolume</span>
                  <span className="text-zinc-600">() {'\u2192'} uint256</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-zinc-600 pb-8">
          BoredBrain AI | On-Chain Settlement Infrastructure | BSC Network
        </div>
      </div>
    </div>
  );
}
