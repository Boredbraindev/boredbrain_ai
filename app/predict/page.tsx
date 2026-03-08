'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

// ─── Types ───────────────────────────────────────────────────────────────────

type Direction = 'UP' | 'DOWN';

interface AIAgent {
  id: string;
  name: string;
  avatar: string;
  prediction: Direction;
  confidence: number;
  accuracy: number;
  winStreak: number;
  totalEarnings: number;
  totalPredictions: number;
}

interface RoundResult {
  id: number;
  asset: string;
  startPrice: number;
  endPrice: number;
  outcome: Direction;
  timestamp: number;
  upPool: number;
  downPool: number;
  winningAgents: string[];
}

interface UserBet {
  direction: Direction;
  amount: number;
}

interface UserStats {
  wins: number;
  losses: number;
  totalEarnings: number;
}

// ─── Constants & Data ────────────────────────────────────────────────────────

const ROUND_DURATION = 300; // 5 minutes in seconds

const ASSETS = [
  { symbol: 'BTC', name: 'Bitcoin', basePrice: 97_432.18, color: '#F7931A' },
  { symbol: 'ETH', name: 'Ethereum', basePrice: 3_841.55, color: '#627EEA' },
  { symbol: 'SOL', name: 'Solana', basePrice: 198.73, color: '#9945FF' },
];

const AI_AGENTS: AIAgent[] = [
  { id: 'defi-oracle', name: 'DeFi Oracle', avatar: '🔮', prediction: 'UP', confidence: 78, accuracy: 72, winStreak: 5, totalEarnings: 14_820, totalPredictions: 312 },
  { id: 'alpha-hunter', name: 'Alpha Hunter', avatar: '🎯', prediction: 'DOWN', confidence: 65, accuracy: 68, winStreak: 2, totalEarnings: 11_340, totalPredictions: 287 },
  { id: 'whale-tracker', name: 'Whale Tracker', avatar: '🐋', prediction: 'UP', confidence: 82, accuracy: 75, winStreak: 8, totalEarnings: 18_950, totalPredictions: 341 },
  { id: 'neural-trader', name: 'Neural Trader', avatar: '🧠', prediction: 'UP', confidence: 71, accuracy: 70, winStreak: 3, totalEarnings: 12_670, totalPredictions: 298 },
  { id: 'momentum-bot', name: 'Momentum Bot', avatar: '⚡', prediction: 'DOWN', confidence: 59, accuracy: 63, winStreak: 0, totalEarnings: 8_420, totalPredictions: 265 },
  { id: 'sentiment-ai', name: 'Sentiment AI', avatar: '📊', prediction: 'UP', confidence: 74, accuracy: 71, winStreak: 4, totalEarnings: 13_210, totalPredictions: 305 },
  { id: 'quant-engine', name: 'Quant Engine', avatar: '🔢', prediction: 'DOWN', confidence: 68, accuracy: 69, winStreak: 1, totalEarnings: 10_890, totalPredictions: 278 },
  { id: 'chain-prophet', name: 'Chain Prophet', avatar: '⛓️', prediction: 'UP', confidence: 85, accuracy: 77, winStreak: 11, totalEarnings: 21_400, totalPredictions: 356 },
  { id: 'volatility-sage', name: 'Volatility Sage', avatar: '🌊', prediction: 'DOWN', confidence: 62, accuracy: 66, winStreak: 0, totalEarnings: 9_150, totalPredictions: 271 },
  { id: 'onchain-scout', name: 'On-Chain Scout', avatar: '🔍', prediction: 'UP', confidence: 76, accuracy: 73, winStreak: 6, totalEarnings: 15_780, totalPredictions: 324 },
];

const INITIAL_RESULTS: RoundResult[] = [
  { id: 1001, asset: 'BTC', startPrice: 97_102.44, endPrice: 97_432.18, outcome: 'UP', timestamp: Date.now() - 600_000, upPool: 3200, downPool: 2100, winningAgents: ['DeFi Oracle', 'Whale Tracker', 'Chain Prophet'] },
  { id: 1002, asset: 'ETH', startPrice: 3_867.30, endPrice: 3_841.55, outcome: 'DOWN', timestamp: Date.now() - 1_200_000, upPool: 1800, downPool: 2900, winningAgents: ['Alpha Hunter', 'Momentum Bot', 'Quant Engine'] },
  { id: 1003, asset: 'SOL', startPrice: 195.12, endPrice: 198.73, outcome: 'UP', timestamp: Date.now() - 1_800_000, upPool: 2600, downPool: 1400, winningAgents: ['Neural Trader', 'Sentiment AI', 'On-Chain Scout'] },
  { id: 1004, asset: 'BTC', startPrice: 96_850.00, endPrice: 97_102.44, outcome: 'UP', timestamp: Date.now() - 2_400_000, upPool: 2800, downPool: 2200, winningAgents: ['DeFi Oracle', 'Chain Prophet', 'Whale Tracker'] },
  { id: 1005, asset: 'ETH', startPrice: 3_891.20, endPrice: 3_867.30, outcome: 'DOWN', timestamp: Date.now() - 3_000_000, upPool: 1500, downPool: 3100, winningAgents: ['Volatility Sage', 'Alpha Hunter'] },
  { id: 1006, asset: 'SOL', startPrice: 192.45, endPrice: 195.12, outcome: 'UP', timestamp: Date.now() - 3_600_000, upPool: 2400, downPool: 1600, winningAgents: ['Sentiment AI', 'Neural Trader', 'Chain Prophet'] },
  { id: 1007, asset: 'BTC', startPrice: 97_200.00, endPrice: 96_850.00, outcome: 'DOWN', timestamp: Date.now() - 4_200_000, upPool: 1900, downPool: 2700, winningAgents: ['Momentum Bot', 'Quant Engine', 'Volatility Sage'] },
  { id: 1008, asset: 'ETH', startPrice: 3_855.80, endPrice: 3_891.20, outcome: 'UP', timestamp: Date.now() - 4_800_000, upPool: 2700, downPool: 1800, winningAgents: ['DeFi Oracle', 'Whale Tracker'] },
  { id: 1009, asset: 'SOL', startPrice: 189.90, endPrice: 192.45, outcome: 'UP', timestamp: Date.now() - 5_400_000, upPool: 2100, downPool: 1900, winningAgents: ['On-Chain Scout', 'Chain Prophet', 'Sentiment AI'] },
  { id: 1010, asset: 'BTC', startPrice: 97_500.50, endPrice: 97_200.00, outcome: 'DOWN', timestamp: Date.now() - 6_000_000, upPool: 1700, downPool: 2500, winningAgents: ['Alpha Hunter', 'Volatility Sage', 'Momentum Bot'] },
];

// ─── Helper Functions ────────────────────────────────────────────────────────

function formatPrice(price: number): string {
  return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function loadUserStats(): UserStats {
  if (typeof window === 'undefined') return { wins: 0, losses: 0, totalEarnings: 0 };
  try {
    const saved = localStorage.getItem('bbai-predict-stats');
    if (saved) return JSON.parse(saved);
  } catch {
    // ignore
  }
  return { wins: 0, losses: 0, totalEarnings: 0 };
}

function saveUserStats(stats: UserStats): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('bbai-predict-stats', JSON.stringify(stats));
  } catch {
    // ignore
  }
}

// ─── Page Component ──────────────────────────────────────────────────────────

export default function PredictPage() {
  // Round state
  const [assetIndex, setAssetIndex] = useState(0);
  const [currentPrice, setCurrentPrice] = useState(ASSETS[0].basePrice);
  const [roundStartPrice, setRoundStartPrice] = useState(ASSETS[0].basePrice);
  const [timeLeft, setTimeLeft] = useState(ROUND_DURATION);
  const [roundId, setRoundId] = useState(1011);
  const [isResolving, setIsResolving] = useState(false);

  // Pool state
  const [upPool, setUpPool] = useState(2_450);
  const [downPool, setDownPool] = useState(1_890);

  // User state
  const [userBet, setUserBet] = useState<UserBet | null>(null);
  const [betAmount, setBetAmount] = useState('100');
  const [userStats, setUserStats] = useState<UserStats>({ wins: 0, losses: 0, totalEarnings: 0 });
  const [followedAgent, setFollowedAgent] = useState<string | null>(null);
  const [roundResult, setRoundResult] = useState<{ outcome: Direction; won: boolean; payout: number } | null>(null);

  // Agents state - randomized each round
  const [agents, setAgents] = useState<AIAgent[]>(AI_AGENTS);

  // Results
  const [results, setResults] = useState<RoundResult[]>(INITIAL_RESULTS);

  // Refs for timer/price intervals
  const priceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentAsset = ASSETS[assetIndex];
  const priceChange = currentPrice - roundStartPrice;
  const priceChangePercent = (priceChange / roundStartPrice) * 100;

  // Load stats from localStorage
  useEffect(() => {
    setUserStats(loadUserStats());
  }, []);

  // Randomize agent predictions each round
  const randomizeAgents = useCallback(() => {
    setAgents(prev =>
      prev.map(agent => ({
        ...agent,
        prediction: Math.random() > 0.45 ? 'UP' as Direction : 'DOWN' as Direction,
        confidence: Math.floor(Math.random() * 30) + 55,
      }))
    );
  }, []);

  // Price random walk
  useEffect(() => {
    priceIntervalRef.current = setInterval(() => {
      setCurrentPrice(prev => {
        const volatility = currentAsset.symbol === 'BTC' ? 15 : currentAsset.symbol === 'ETH' ? 2 : 0.15;
        const delta = (Math.random() - 0.48) * volatility; // slight upward bias
        return Math.max(prev * 0.995, prev + delta);
      });
    }, 1_000);

    return () => {
      if (priceIntervalRef.current) clearInterval(priceIntervalRef.current);
    };
  }, [currentAsset.symbol]);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          resolveRound();
          return 0;
        }
        return prev - 1;
      });
    }, 1_000);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundId]);

  // Resolve round
  const resolveRound = useCallback(() => {
    setIsResolving(true);

    setTimeout(() => {
      setCurrentPrice(prev => {
        const outcome: Direction = prev >= roundStartPrice ? 'UP' : 'DOWN';
        // If price barely moved, randomize
        const finalOutcome: Direction =
          Math.abs(prev - roundStartPrice) < 0.01
            ? (Math.random() > 0.5 ? 'UP' : 'DOWN')
            : outcome;

        const winningAgentNames = agents
          .filter(a => a.prediction === finalOutcome)
          .map(a => a.name);

        // Add result
        const newResult: RoundResult = {
          id: roundId,
          asset: ASSETS[assetIndex].symbol,
          startPrice: roundStartPrice,
          endPrice: prev,
          outcome: finalOutcome,
          timestamp: Date.now(),
          upPool,
          downPool,
          winningAgents: winningAgentNames,
        };

        setResults(r => [newResult, ...r].slice(0, 10));

        // Resolve user bet
        if (userBet) {
          const won = userBet.direction === finalOutcome;
          const totalPool = upPool + downPool;
          const winningPool = finalOutcome === 'UP' ? upPool : downPool;
          const payout = won ? Math.floor((userBet.amount / winningPool) * totalPool) : 0;

          setRoundResult({ outcome: finalOutcome, won, payout });

          setUserStats(prev => {
            const updated = {
              wins: prev.wins + (won ? 1 : 0),
              losses: prev.losses + (won ? 0 : 1),
              totalEarnings: prev.totalEarnings + (won ? payout - userBet.amount : -userBet.amount),
            };
            saveUserStats(updated);
            return updated;
          });
        } else {
          setRoundResult({ outcome: finalOutcome, won: false, payout: 0 });
        }

        return prev;
      });

      // Auto-start new round after 5 seconds
      setTimeout(() => {
        startNewRound();
      }, 5_000);
    }, 1_500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundId, roundStartPrice, assetIndex, agents, upPool, downPool, userBet]);

  // Start new round
  const startNewRound = useCallback(() => {
    const nextAssetIndex = (assetIndex + 1) % ASSETS.length;
    const nextAsset = ASSETS[nextAssetIndex];
    const jitter = (Math.random() - 0.5) * nextAsset.basePrice * 0.01;
    const newPrice = nextAsset.basePrice + jitter;

    setAssetIndex(nextAssetIndex);
    setCurrentPrice(newPrice);
    setRoundStartPrice(newPrice);
    setTimeLeft(ROUND_DURATION);
    setRoundId(prev => prev + 1);
    setUserBet(null);
    setRoundResult(null);
    setFollowedAgent(null);
    setIsResolving(false);
    setUpPool(Math.floor(Math.random() * 2000) + 1500);
    setDownPool(Math.floor(Math.random() * 2000) + 1200);
    randomizeAgents();
  }, [assetIndex, randomizeAgents]);

  // Place bet
  const placeBet = (direction: Direction) => {
    if (userBet || isResolving || timeLeft <= 0) return;
    const amount = Math.min(1000, Math.max(10, parseInt(betAmount) || 100));
    setUserBet({ direction, amount });
    if (direction === 'UP') {
      setUpPool(prev => prev + amount);
    } else {
      setDownPool(prev => prev + amount);
    }
  };

  // Follow agent
  const handleFollow = (agent: AIAgent) => {
    if (userBet || isResolving || timeLeft <= 0) return;
    setFollowedAgent(agent.id);
    const amount = Math.min(1000, Math.max(10, parseInt(betAmount) || 100));
    placeBet(agent.prediction);
  };

  // Leaderboard sorted by accuracy
  const leaderboard = [...agents].sort((a, b) => b.accuracy - a.accuracy);

  const timerUrgent = timeLeft <= 30;
  const timerWarning = timeLeft <= 60 && timeLeft > 30;

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 text-white">
      {/* ─── Inline Styles for animations ─── */}
      <style>{`
        @keyframes pulse-glow-green {
          0%, 100% { box-shadow: 0 0 20px rgba(34, 197, 94, 0.3); }
          50% { box-shadow: 0 0 40px rgba(34, 197, 94, 0.6); }
        }
        @keyframes pulse-glow-red {
          0%, 100% { box-shadow: 0 0 20px rgba(239, 68, 68, 0.3); }
          50% { box-shadow: 0 0 40px rgba(239, 68, 68, 0.6); }
        }
        @keyframes timer-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.8; }
        }
        @keyframes float-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes result-pop {
          0% { transform: scale(0.8); opacity: 0; }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
        .glow-green { animation: pulse-glow-green 2s ease-in-out infinite; }
        .glow-red { animation: pulse-glow-red 2s ease-in-out infinite; }
        .timer-pulse { animation: timer-pulse 1s ease-in-out infinite; }
        .float-in { animation: float-in 0.5s ease-out forwards; }
        .result-pop { animation: result-pop 0.4s ease-out forwards; }
        .shimmer-bg {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent);
          background-size: 200% 100%;
          animation: shimmer 3s linear infinite;
        }
      `}</style>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* ─── Page Header ─── */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-green-400 via-emerald-300 to-green-500 bg-clip-text text-transparent">
            Price Prediction Arena
          </h1>
          <p className="text-zinc-400 text-lg">
            AI Agents predict. You bet. Winner takes all.
          </p>
          <div className="flex items-center justify-center gap-4 mt-3">
            <Badge variant="outline" className="border-green-500/50 text-green-400">
              W: {userStats.wins}
            </Badge>
            <Badge variant="outline" className="border-red-500/50 text-red-400">
              L: {userStats.losses}
            </Badge>
            <Badge variant="outline" className={`${userStats.totalEarnings >= 0 ? 'border-green-500/50 text-green-400' : 'border-red-500/50 text-red-400'}`}>
              {userStats.totalEarnings >= 0 ? '+' : ''}{userStats.totalEarnings.toLocaleString()} BBAI
            </Badge>
          </div>
        </div>

        {/* ─── Hero: Active Prediction Round ─── */}
        <Card className="border-zinc-800 bg-zinc-900/80 backdrop-blur-sm overflow-hidden relative">
          <div className="absolute inset-0 shimmer-bg pointer-events-none" />
          <CardHeader className="text-center pb-2 relative z-10">
            <div className="flex items-center justify-center gap-3 mb-2">
              {ASSETS.map((a, i) => (
                <Badge
                  key={a.symbol}
                  className={`text-sm px-3 py-1 transition-all ${
                    i === assetIndex
                      ? 'bg-white/10 text-white border-white/30 scale-110'
                      : 'bg-zinc-800/50 text-zinc-500 border-zinc-700'
                  }`}
                  variant="outline"
                >
                  {a.symbol}
                </Badge>
              ))}
            </div>
            <CardTitle className="text-2xl">
              Round #{roundId} — {currentAsset.name} ({currentAsset.symbol})
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Will the price go UP or DOWN in the next 5 minutes?
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 relative z-10">
            {/* Price Display */}
            <div className="text-center space-y-1">
              <div className="text-5xl md:text-6xl font-mono font-bold tracking-tight">
                ${formatPrice(currentPrice)}
              </div>
              <div className={`text-lg font-semibold ${priceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {priceChange >= 0 ? '+' : ''}{formatPrice(priceChange)} ({priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(3)}%)
              </div>
            </div>

            {/* Countdown Timer */}
            <div className="flex flex-col items-center gap-2">
              <div
                className={`text-3xl font-mono font-bold px-6 py-2 rounded-xl border ${
                  timerUrgent
                    ? 'text-red-400 border-red-500/50 bg-red-950/30 timer-pulse'
                    : timerWarning
                    ? 'text-amber-400 border-amber-500/50 bg-amber-950/30'
                    : 'text-zinc-200 border-zinc-700 bg-zinc-800/50'
                }`}
              >
                {isResolving ? 'RESOLVING...' : formatTime(timeLeft)}
              </div>
              <Progress
                value={(timeLeft / ROUND_DURATION) * 100}
                className="w-64 h-2"
              />
            </div>

            {/* Result overlay */}
            {roundResult && (
              <div className="result-pop text-center p-6 rounded-xl border bg-zinc-900/90 border-zinc-700">
                <div className={`text-3xl font-bold mb-2 ${roundResult.outcome === 'UP' ? 'text-green-400' : 'text-red-400'}`}>
                  Price went {roundResult.outcome} {roundResult.outcome === 'UP' ? '⬆️' : '⬇️'}
                </div>
                {userBet ? (
                  <div className={`text-xl ${roundResult.won ? 'text-green-400' : 'text-red-400'}`}>
                    {roundResult.won
                      ? `YOU WON! +${roundResult.payout.toLocaleString()} BBAI`
                      : `You lost ${userBet.amount.toLocaleString()} BBAI`}
                  </div>
                ) : (
                  <div className="text-zinc-400">You did not place a bet this round</div>
                )}
                <p className="text-zinc-500 text-sm mt-2">Next round starting soon...</p>
              </div>
            )}

            {/* Betting Section */}
            {!roundResult && (
              <div className="space-y-4">
                {/* Bet Amount Input */}
                {!userBet && (
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-zinc-400 text-sm">Bet Amount:</span>
                    <Input
                      type="number"
                      min={10}
                      max={1000}
                      value={betAmount}
                      onChange={(e) => setBetAmount(e.target.value)}
                      className="w-28 bg-zinc-800 border-zinc-700 text-center text-white"
                      disabled={!!userBet || isResolving}
                    />
                    <span className="text-zinc-500 text-sm">BBAI</span>
                  </div>
                )}

                {/* UP / DOWN Buttons */}
                {!userBet ? (
                  <div className="flex justify-center gap-6">
                    <Button
                      size="lg"
                      disabled={isResolving || timeLeft <= 0}
                      onClick={() => placeBet('UP')}
                      className="glow-green w-40 h-16 text-xl font-bold bg-green-600 hover:bg-green-500 text-white border-none transition-all hover:scale-105"
                    >
                      UP ⬆️
                    </Button>
                    <Button
                      size="lg"
                      disabled={isResolving || timeLeft <= 0}
                      onClick={() => placeBet('DOWN')}
                      className="glow-red w-40 h-16 text-xl font-bold bg-red-600 hover:bg-red-500 text-white border-none transition-all hover:scale-105"
                    >
                      DOWN ⬇️
                    </Button>
                  </div>
                ) : (
                  <div className="float-in text-center p-4 rounded-xl border border-zinc-700 bg-zinc-800/50">
                    <span className="text-zinc-400">Your Pick: </span>
                    <span className={`font-bold text-lg ${userBet.direction === 'UP' ? 'text-green-400' : 'text-red-400'}`}>
                      {userBet.direction} {userBet.direction === 'UP' ? '⬆️' : '⬇️'}
                    </span>
                    <span className="text-zinc-400"> — </span>
                    <span className="text-white font-semibold">{userBet.amount.toLocaleString()} BBAI</span>
                    {followedAgent && (
                      <div className="text-zinc-500 text-sm mt-1">
                        Following {agents.find(a => a.id === followedAgent)?.name}
                      </div>
                    )}
                  </div>
                )}

                {/* Pool Display */}
                <div className="flex items-center justify-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="text-zinc-400">UP Pool:</span>
                    <span className="text-green-400 font-semibold">{upPool.toLocaleString()} BBAI</span>
                  </div>
                  <Separator orientation="vertical" className="h-4 bg-zinc-700" />
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-zinc-400">DOWN Pool:</span>
                    <span className="text-red-400 font-semibold">{downPool.toLocaleString()} BBAI</span>
                  </div>
                </div>

                {/* Pool ratio bar */}
                <div className="max-w-md mx-auto">
                  <div className="flex h-3 rounded-full overflow-hidden">
                    <div
                      className="bg-green-500 transition-all duration-500"
                      style={{ width: `${(upPool / (upPool + downPool)) * 100}%` }}
                    />
                    <div
                      className="bg-red-500 transition-all duration-500"
                      style={{ width: `${(downPool / (upPool + downPool)) * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-zinc-500 mt-1">
                    <span>{((upPool / (upPool + downPool)) * 100).toFixed(1)}% UP</span>
                    <span>{((downPool / (upPool + downPool)) * 100).toFixed(1)}% DOWN</span>
                  </div>
                </div>

                {/* AI Agents that already predicted (quick view) */}
                <div className="flex items-center justify-center gap-3 flex-wrap">
                  {agents.slice(0, 4).map((agent) => (
                    <Badge
                      key={agent.id}
                      variant="outline"
                      className={`text-sm px-3 py-1 ${
                        agent.prediction === 'UP'
                          ? 'border-green-500/40 text-green-400 bg-green-950/20'
                          : 'border-red-500/40 text-red-400 bg-red-950/20'
                      }`}
                    >
                      {agent.avatar} {agent.name}: {agent.prediction} {agent.prediction === 'UP' ? '⬆️' : '⬇️'}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─── Tabs: Agents / Results / Leaderboard ─── */}
        <Tabs defaultValue="agents" className="space-y-4">
          <TabsList className="bg-zinc-900 border border-zinc-800 w-full justify-start">
            <TabsTrigger value="agents" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white">
              AI Agent Predictions
            </TabsTrigger>
            <TabsTrigger value="results" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white">
              Recent Results
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white">
              Leaderboard
            </TabsTrigger>
          </TabsList>

          {/* ─── AI Agent Predictions Panel ─── */}
          <TabsContent value="agents" className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {agents.map((agent) => (
                <Card key={agent.id} className="border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900/90 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">{agent.avatar}</div>
                        <div>
                          <div className="font-semibold text-white">{agent.name}</div>
                          <div className="text-xs text-zinc-500">
                            {agent.totalPredictions} predictions
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <Badge
                            className={`text-sm font-bold ${
                              agent.prediction === 'UP'
                                ? 'bg-green-600/20 text-green-400 border-green-500/40'
                                : 'bg-red-600/20 text-red-400 border-red-500/40'
                            }`}
                            variant="outline"
                          >
                            {agent.prediction} {agent.prediction === 'UP' ? '⬆️' : '⬇️'}
                          </Badge>
                          <div className="text-xs text-zinc-400 mt-1">
                            {agent.confidence}% confidence
                          </div>
                        </div>
                      </div>
                    </div>
                    <Separator className="my-3 bg-zinc-800" />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-sm">
                        <div>
                          <span className="text-zinc-500">Accuracy: </span>
                          <span className={`font-semibold ${agent.accuracy >= 70 ? 'text-green-400' : agent.accuracy >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                            {agent.accuracy}%
                          </span>
                        </div>
                        <div>
                          <span className="text-zinc-500">Streak: </span>
                          <span className="text-white font-semibold">
                            {agent.winStreak > 0 ? `${agent.winStreak} W` : '0'}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!!userBet || isResolving || timeLeft <= 0}
                        onClick={() => handleFollow(agent)}
                        className={`text-xs h-7 ${
                          followedAgent === agent.id
                            ? 'bg-white/10 text-white border-white/30'
                            : 'border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500'
                        }`}
                      >
                        {followedAgent === agent.id ? 'Following' : 'Follow'}
                      </Button>
                    </div>
                    <div className="mt-2">
                      <Progress value={agent.accuracy} className="h-1.5" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* ─── Recent Results ─── */}
          <TabsContent value="results" className="space-y-3">
            {results.map((result, i) => (
              <Card key={result.id} className="border-zinc-800 bg-zinc-900/60" style={{ animationDelay: `${i * 50}ms` }}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-4">
                      <div className={`text-2xl font-bold w-12 h-12 rounded-xl flex items-center justify-center ${
                        result.outcome === 'UP' ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'
                      }`}>
                        {result.outcome === 'UP' ? '⬆️' : '⬇️'}
                      </div>
                      <div>
                        <div className="font-semibold text-white">
                          Round #{result.id} — {result.asset}
                        </div>
                        <div className="text-sm text-zinc-500">
                          ${formatPrice(result.startPrice)} → ${formatPrice(result.endPrice)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge
                        className={`${
                          result.outcome === 'UP'
                            ? 'bg-green-600/20 text-green-400 border-green-500/40'
                            : 'bg-red-600/20 text-red-400 border-red-500/40'
                        }`}
                        variant="outline"
                      >
                        {result.outcome}
                      </Badge>
                      <div className="text-xs text-zinc-500 mt-1">
                        Pool: {(result.upPool + result.downPool).toLocaleString()} BBAI
                      </div>
                    </div>
                  </div>
                  <Separator className="my-3 bg-zinc-800" />
                  <div>
                    <span className="text-xs text-zinc-500">Winning Agents: </span>
                    <span className="text-xs text-zinc-300">
                      {result.winningAgents.join(', ')}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* ─── Leaderboard ─── */}
          <TabsContent value="leaderboard" className="space-y-3">
            <Card className="border-zinc-800 bg-zinc-900/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-white">Top Prediction Agents</CardTitle>
                <CardDescription className="text-zinc-500">Ranked by prediction accuracy</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-zinc-800">
                  {leaderboard.map((agent, i) => (
                    <div
                      key={agent.id}
                      className="flex items-center justify-between px-6 py-4 hover:bg-zinc-800/40 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`text-lg font-bold w-8 text-center ${
                          i === 0 ? 'text-yellow-400' : i === 1 ? 'text-zinc-300' : i === 2 ? 'text-amber-600' : 'text-zinc-500'
                        }`}>
                          #{i + 1}
                        </div>
                        <div className="text-2xl">{agent.avatar}</div>
                        <div>
                          <div className="font-semibold text-white">{agent.name}</div>
                          <div className="text-xs text-zinc-500">
                            {agent.totalPredictions} predictions
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6 text-sm">
                        <div className="text-right">
                          <div className={`font-bold text-lg ${agent.accuracy >= 70 ? 'text-green-400' : agent.accuracy >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                            {agent.accuracy}%
                          </div>
                          <div className="text-xs text-zinc-500">accuracy</div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-white">
                            {agent.winStreak > 0 ? (
                              <span className="text-green-400">{agent.winStreak}W</span>
                            ) : (
                              <span className="text-zinc-500">0</span>
                            )}
                          </div>
                          <div className="text-xs text-zinc-500">streak</div>
                        </div>
                        <div className="text-right min-w-[80px]">
                          <div className="font-semibold text-emerald-400">
                            {agent.totalEarnings.toLocaleString()}
                          </div>
                          <div className="text-xs text-zinc-500">BBAI earned</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
