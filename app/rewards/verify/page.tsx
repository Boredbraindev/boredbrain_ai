'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// ── Types ──────────────────────────────────────────────────────────────────────

interface VerificationItem {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  reward: number;
  order: number;
}

type VerificationStatus = 'locked' | 'available' | 'verifying' | 'completed';

interface VerifyEarnState {
  completedIds: string[];
  totalEarned: number;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'bbai-verify-earn';
const MAX_EARNABLE = 2700;

const VERIFICATION_ITEMS: VerificationItem[] = [
  {
    id: 'wallet',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-6">
        <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
        <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
        <path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z" />
      </svg>
    ),
    title: 'Wallet Verification',
    description: 'Connect your Web3 wallet to verify on-chain ownership and establish your identity in the agent economy.',
    reward: 200,
    order: 0,
  },
  {
    id: 'twitter',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="size-6">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
    title: 'Twitter/X Verification',
    description: 'Link your Twitter/X account and verify your handle to build social trust and community credibility.',
    reward: 300,
    order: 1,
  },
  {
    id: 'github',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="size-6">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
      </svg>
    ),
    title: 'GitHub Verification',
    description: 'Link your GitHub account to verify developer identity and prove technical credibility on the platform.',
    reward: 400,
    order: 2,
  },
  {
    id: 'agent',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-6">
        <rect x="3" y="11" width="18" height="10" rx="2" />
        <circle cx="12" cy="5" r="3" />
        <path d="M12 8v3" />
        <circle cx="8" cy="16" r="1" fill="currentColor" />
        <circle cx="16" cy="16" r="1" fill="currentColor" />
      </svg>
    ),
    title: 'Agent Registration',
    description: 'Register an AI agent on the BoredBrain platform to participate in the decentralized agent economy.',
    reward: 500,
    order: 3,
  },
  {
    id: 'onchain',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-6">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    ),
    title: 'On-Chain Activity',
    description: 'Verify your on-chain transaction history to prove active participation across supported networks.',
    reward: 600,
    order: 4,
  },
  {
    id: 'zk_identity',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-6">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
    title: 'iden3 ZK Proof',
    description: 'Complete a zero-knowledge identity proof using iden3 protocol for maximum trust without revealing private data.',
    reward: 700,
    order: 5,
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function loadState(): VerifyEarnState {
  if (typeof window === 'undefined') return { completedIds: [], totalEarned: 0 };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { completedIds: [], totalEarned: 0 };
    return JSON.parse(raw) as VerifyEarnState;
  } catch {
    return { completedIds: [], totalEarned: 0 };
  }
}

function saveState(state: VerifyEarnState): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getTrustScore(completedCount: number): number {
  // Each verification adds weight toward 100%
  return Math.round((completedCount / VERIFICATION_ITEMS.length) * 100);
}

function getItemStatus(
  item: VerificationItem,
  completedIds: string[],
  verifyingId: string | null,
): VerificationStatus {
  if (completedIds.includes(item.id)) return 'completed';
  if (verifyingId === item.id) return 'verifying';
  // First item is always available; others require previous completion
  if (item.order === 0) return 'available';
  const prevItem = VERIFICATION_ITEMS.find((v) => v.order === item.order - 1);
  if (prevItem && completedIds.includes(prevItem.id)) return 'available';
  return 'locked';
}

// ── SVG Icons ──────────────────────────────────────────────────────────────────

function ShieldCheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function CoinsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6" />
      <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
      <path d="M7 6h1v4" />
      <path d="m16.71 13.88.7.71-2.82 2.82" />
    </svg>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function VerifyEarnPage() {
  const [state, setState] = useState<VerifyEarnState>({ completedIds: [], totalEarned: 0 });
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [claimPulse, setClaimPulse] = useState(false);

  // Load from localStorage
  useEffect(() => {
    setState(loadState());
    setMounted(true);
  }, []);

  // Persist to localStorage
  useEffect(() => {
    if (!mounted) return;
    saveState(state);
  }, [state, mounted]);

  const trustScore = getTrustScore(state.completedIds.length);
  const totalRemaining = MAX_EARNABLE - state.totalEarned;

  const handleVerify = useCallback(
    (item: VerificationItem) => {
      const status = getItemStatus(item, state.completedIds, verifyingId);
      if (status !== 'available' || verifyingId) return;

      setVerifyingId(item.id);

      // Mock 2-second verification
      setTimeout(() => {
        setState((prev) => ({
          completedIds: [...prev.completedIds, item.id],
          totalEarned: prev.totalEarned + item.reward,
        }));
        setVerifyingId(null);
      }, 2000);
    },
    [state.completedIds, verifyingId],
  );

  const handleClaim = useCallback(() => {
    if (state.totalEarned === 0) return;
    setClaimPulse(true);
    setTimeout(() => setClaimPulse(false), 1500);
  }, [state.totalEarned]);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </div>
    );
  }

  // Trust score arc calculations
  const radius = 68;
  const circumference = Math.PI * radius * 2;
  const arcLength = circumference * 0.75; // 270 degrees
  const filledArc = arcLength * (trustScore / 100);

  return (
    <div className="min-h-screen px-4 py-12 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-10">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <section className="text-center space-y-4">
        <div className="flex justify-center mb-3">
          <div className="relative">
            <div className="absolute inset-0 bg-amber-500/20 blur-3xl rounded-full" />
            <Image src="/footer-logo.png" alt="BoredBrain AI" width={64} height={64} className="relative opacity-90 invert dark:invert-0 drop-shadow-[0_0_20px_rgba(245,158,11,0.3)]" />
          </div>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/[0.06] px-4 py-1.5 mb-2">
          <ShieldCheckIcon className="size-4 text-amber-500" />
          <span className="font-mono-wide text-xs text-amber-400 tracking-wider uppercase">
            Identity Verification
          </span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 bg-clip-text text-transparent">
          Verify &amp; Earn BBAI
        </h1>
        <p className="text-white/50 text-lg max-w-2xl mx-auto leading-relaxed">
          Complete identity verifications to earn up to{' '}
          <span className="text-amber-500 font-semibold">{MAX_EARNABLE.toLocaleString()} BBAI</span>{' '}
          tokens and build trust in the agent economy.
        </p>
      </section>

      {/* ── Trust Score Meter ───────────────────────────────────────────────── */}
      <Card className="bg-white/[0.02] backdrop-blur-xl border-white/[0.06] rounded-2xl">
        <CardContent className="flex flex-col sm:flex-row items-center gap-8 py-8">
          {/* Circular meter */}
          <div className="relative h-40 w-40 shrink-0">
            <svg viewBox="0 0 160 160" className="h-full w-full -rotate-[135deg]">
              {/* Background arc */}
              <circle
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${arcLength} ${circumference - arcLength}`}
              />
              {/* Filled arc */}
              <circle
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke="url(#trust-gradient)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${filledArc} ${circumference - filledArc}`}
                className="transition-all duration-1000 ease-out"
              />
              <defs>
                <linearGradient id="trust-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#f97316" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-bold text-white">{trustScore}%</span>
              <span className="font-mono-wide text-[10px] text-white/30 tracking-wider uppercase mt-0.5">
                Trust Score
              </span>
            </div>
          </div>

          {/* Score details */}
          <div className="flex-1 space-y-4 text-center sm:text-left">
            <div>
              <h3 className="text-white font-semibold text-lg">Overall Trust Score</h3>
              <p className="text-white/40 text-sm mt-1">
                {state.completedIds.length} of {VERIFICATION_ITEMS.length} verifications completed
              </p>
            </div>
            <div className="flex flex-wrap gap-3 justify-center sm:justify-start">
              <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-2.5">
                <p className="font-mono-wide text-[10px] text-white/30 tracking-wider uppercase">Earned</p>
                <p className="text-amber-500 font-bold text-lg">{state.totalEarned.toLocaleString()} BBAI</p>
              </div>
              <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-2.5">
                <p className="font-mono-wide text-[10px] text-white/30 tracking-wider uppercase">Remaining</p>
                <p className="text-white/60 font-bold text-lg">{totalRemaining.toLocaleString()} BBAI</p>
              </div>
              <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-2.5">
                <p className="font-mono-wide text-[10px] text-white/30 tracking-wider uppercase">Max Earnable</p>
                <p className="text-white/60 font-bold text-lg">{MAX_EARNABLE.toLocaleString()} BBAI</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Verification Cards Grid ────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-6">
          <ShieldCheckIcon className="size-5 text-amber-500" />
          <h2 className="text-xl font-semibold text-white">Verification Steps</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {VERIFICATION_ITEMS.map((item) => {
            const status = getItemStatus(item, state.completedIds, verifyingId);
            const isVerifying = status === 'verifying';
            const isCompleted = status === 'completed';
            const isLocked = status === 'locked';

            return (
              <Card
                key={item.id}
                className={`bg-white/[0.02] backdrop-blur-xl border-white/[0.06] rounded-2xl transition-all duration-300 relative overflow-hidden ${
                  isCompleted
                    ? 'border-amber-500/30 shadow-[0_0_24px_-6px_rgba(245,158,11,0.15)]'
                    : isLocked
                      ? 'opacity-60'
                      : 'hover:border-white/[0.12]'
                }`}
              >
                {/* Completed shimmer */}
                {isCompleted && (
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-500/[0.04] to-transparent pointer-events-none" />
                )}

                <CardHeader className="pb-3 relative">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex items-center justify-center size-10 rounded-xl border transition-colors ${
                          isCompleted
                            ? 'bg-amber-500/10 border-amber-500/20 text-amber-500'
                            : isLocked
                              ? 'bg-white/[0.02] border-white/[0.06] text-white/20'
                              : 'bg-white/[0.04] border-white/[0.08] text-white/70'
                        }`}
                      >
                        {isLocked ? <LockIcon className="size-4" /> : item.icon}
                      </div>
                      <div>
                        <CardTitle className="text-white text-base">{item.title}</CardTitle>
                        <span className="font-mono-wide text-[10px] text-white/25 tracking-wider uppercase">
                          {isCompleted ? 'Completed' : isLocked ? 'Locked' : 'Available'}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 relative">
                  <p className="text-white/40 text-sm leading-relaxed">{item.description}</p>

                  <div className="flex items-center justify-between">
                    {/* Reward badge */}
                    <span
                      className={`font-mono-wide text-sm font-semibold px-2.5 py-1 rounded-lg border ${
                        isCompleted
                          ? 'bg-green-500/10 text-green-400 border-green-500/20'
                          : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                      }`}
                    >
                      {isCompleted ? (
                        <span className="flex items-center gap-1">
                          <CheckCircleIcon className="size-3.5" />
                          +{item.reward} BBAI
                        </span>
                      ) : (
                        `+${item.reward} BBAI`
                      )}
                    </span>

                    {/* Status / button */}
                    {isCompleted ? (
                      <Badge className="bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/10">
                        Verified
                      </Badge>
                    ) : isVerifying ? (
                      <Button
                        size="sm"
                        disabled
                        className="rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 cursor-wait"
                      >
                        <span className="flex items-center gap-2">
                          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-400/30 border-t-amber-400" />
                          Verifying
                        </span>
                      </Button>
                    ) : isLocked ? (
                      <Button
                        size="sm"
                        disabled
                        className="rounded-xl bg-white/[0.03] text-white/20 border border-white/[0.06]"
                      >
                        <LockIcon className="size-3.5 mr-1" />
                        Locked
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleVerify(item)}
                        className="rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-medium transition-all hover:shadow-[0_0_16px_rgba(245,158,11,0.3)]"
                      >
                        Verify
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* ── Rewards Summary ─────────────────────────────────────────────────── */}
      <Card className="bg-white/[0.02] backdrop-blur-xl border-white/[0.06] rounded-2xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CoinsIcon className="size-5 text-amber-500" />
            <CardTitle className="text-white text-lg">Rewards Summary</CardTitle>
          </div>
          <CardDescription className="text-white/40">
            Track your verification earnings and claim your BBAI tokens
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 text-center">
              <p className="font-mono-wide text-[10px] text-white/30 tracking-wider uppercase mb-1">Total Earned</p>
              <p className="text-amber-500 font-bold text-2xl">{state.totalEarned.toLocaleString()}</p>
              <p className="font-mono-wide text-[10px] text-white/25 tracking-wider uppercase">BBAI</p>
            </div>
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 text-center">
              <p className="font-mono-wide text-[10px] text-white/30 tracking-wider uppercase mb-1">Remaining</p>
              <p className="text-white/60 font-bold text-2xl">{totalRemaining.toLocaleString()}</p>
              <p className="font-mono-wide text-[10px] text-white/25 tracking-wider uppercase">BBAI</p>
            </div>
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 text-center">
              <p className="font-mono-wide text-[10px] text-white/30 tracking-wider uppercase mb-1">Trust Score</p>
              <p className="text-white font-bold text-2xl">{trustScore}%</p>
              <p className="font-mono-wide text-[10px] text-white/25 tracking-wider uppercase">of 100</p>
            </div>
          </div>

          {/* Completion breakdown */}
          <div className="flex items-center gap-2 flex-wrap">
            {VERIFICATION_ITEMS.map((item) => {
              const done = state.completedIds.includes(item.id);
              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs border transition-colors ${
                    done
                      ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                      : 'bg-white/[0.02] border-white/[0.06] text-white/25'
                  }`}
                >
                  {done ? (
                    <CheckCircleIcon className="size-3" />
                  ) : (
                    <span className="size-3 rounded-full border border-current opacity-50" />
                  )}
                  <span className="font-mono-wide text-[10px] tracking-wider uppercase">
                    {item.title.split(' ')[0]}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono-wide text-white/30 tracking-wider uppercase">Progress</span>
              <span className="text-white/50">
                {state.completedIds.length}/{VERIFICATION_ITEMS.length} completed
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-1000 ease-out"
                style={{ width: `${(state.completedIds.length / VERIFICATION_ITEMS.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Claim button */}
          <div className="flex justify-center pt-2">
            <Button
              onClick={handleClaim}
              disabled={state.totalEarned === 0}
              className={`min-w-[220px] rounded-xl font-semibold text-base transition-all ${
                state.totalEarned > 0
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:from-amber-400 hover:to-orange-400 shadow-[0_0_24px_rgba(245,158,11,0.2)] hover:shadow-[0_0_32px_rgba(245,158,11,0.35)]'
                  : 'bg-white/[0.04] text-white/20 border border-white/[0.06]'
              } ${claimPulse ? 'scale-95' : ''}`}
            >
              <CoinsIcon className="size-5 mr-2" />
              {state.totalEarned > 0
                ? `Claim ${state.totalEarned.toLocaleString()} BBAI`
                : 'No Rewards to Claim'}
            </Button>
          </div>

          {claimPulse && (
            <p className="text-center text-sm text-amber-400 animate-pulse">
              Claim submitted! Tokens will appear in your wallet shortly.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── OpenClaw Partnership Banner ────────────────────────────────────── */}
      <Card className="bg-gradient-to-r from-amber-500/[0.06] to-orange-500/[0.04] backdrop-blur-xl border-amber-500/[0.12] rounded-2xl">
        <CardContent className="flex flex-col sm:flex-row items-center gap-5 py-6">
          <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 shrink-0">
            <ShieldCheckIcon className="size-7 text-amber-500" />
          </div>
          <div className="text-center sm:text-left space-y-1.5">
            <h3 className="text-white font-semibold text-base">
              Powered by OpenClaw Protocol
            </h3>
            <p className="text-white/40 text-sm leading-relaxed max-w-xl">
              BoredBrain leverages OpenClaw&apos;s decentralized identity verification framework and
              iden3 zero-knowledge proofs to build trustless, privacy-preserving identity layers for
              AI agents. Your verification data is never shared &mdash; only cryptographic proofs
              are stored on-chain.
            </p>
          </div>
          <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/10 shrink-0 px-3 py-1">
            iden3 &middot; ZK
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
}
