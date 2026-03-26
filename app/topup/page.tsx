'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Coins,
  Copy,
  Check,
  Loader2,
  Bot,
  Swords,
  TrendingUp,
  ExternalLink,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DepositInfo {
  depositAddress: string;
  network: string;
  token: string;
  minimumDeposit: string;
  rates: { range: string; bpPerUsdt: number; bonusPercent: number }[];
}

interface UserPointsInfo {
  totalBp: number;
  level: number;
  title: string;
  streakDays: number;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TopUpPage() {
  const { address, isConnected } = useAccount();

  const [depositInfo, setDepositInfo] = useState<DepositInfo | null>(null);
  const [userPoints, setUserPoints] = useState<UserPointsInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const [txHash, setTxHash] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    bpCredited?: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Fetch deposit info and user points
  useEffect(() => {
    async function load() {
      try {
        const [infoRes, pointsRes] = await Promise.all([
          fetch('/api/points/topup'),
          address ? fetch(`/api/points?wallet=${address}`) : null,
        ]);

        if (infoRes.ok) {
          const data = await infoRes.json();
          setDepositInfo(data);
        }

        if (pointsRes?.ok) {
          const data = await pointsRes.json();
          setUserPoints({
            totalBp: data.totalBp ?? 0,
            level: data.levelInfo?.level ?? 1,
            title: data.levelInfo?.title ?? 'Newbie',
            streakDays: data.streakDays ?? 0,
          });
        }
      } catch {
        // Fail silently
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [address]);

  const copyAddress = useCallback(() => {
    if (!depositInfo?.depositAddress) return;
    navigator.clipboard.writeText(depositInfo.depositAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [depositInfo]);

  const handleSubmitTx = useCallback(async () => {
    if (!txHash || !address) return;
    setSubmitting(true);
    setResult(null);

    try {
      const res = await fetch('/api/points/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash: txHash.trim(), walletAddress: address }),
      });

      const data = await res.json();

      if (data.success) {
        setResult({
          success: true,
          message: data.message || `${data.bpCredited} BP credited!`,
          bpCredited: data.bpCredited,
        });
        setTxHash('');
        // Refresh points
        if (address) {
          const pRes = await fetch(`/api/points?wallet=${address}`);
          if (pRes.ok) {
            const pData = await pRes.json();
            setUserPoints({
              totalBp: pData.totalBp ?? 0,
              level: pData.levelInfo?.level ?? 1,
              title: pData.levelInfo?.title ?? 'Newbie',
              streakDays: pData.streakDays ?? 0,
            });
          }
        }
      } else {
        setResult({ success: false, message: data.error || 'Verification failed' });
      }
    } catch {
      setResult({ success: false, message: 'Network error. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  }, [txHash, address]);

  const formatBp = (n: number) => n.toLocaleString();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Deposit USDT → Get BP</h1>
          <p className="text-muted-foreground">
            Send USDT on BSC to the address below, then submit your tx hash to receive BP instantly.
          </p>
        </div>

        {/* Current Balance */}
        {userPoints && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <Coins className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Your Balance</p>
                  <p className="text-2xl font-bold">{formatBp(userPoints.totalBp)} BP</p>
                </div>
              </div>
              <Badge variant="outline">
                {userPoints.title} (Lv.{userPoints.level})
              </Badge>
            </CardContent>
          </Card>
        )}

        {/* Deposit Address */}
        {depositInfo && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Step 1: Send USDT</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Send <strong>USDT (BEP-20)</strong> on <strong>{depositInfo.network}</strong> to:
                </p>
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border">
                  <code className="text-sm flex-1 break-all font-mono">
                    {depositInfo.depositAddress}
                  </code>
                  <Button variant="ghost" size="icon" onClick={copyAddress}>
                    {copied ? (
                      <Check className="h-4 w-4 text-green-400" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-yellow-500">
                  Only send USDT on BSC (BEP-20). Minimum: {depositInfo.minimumDeposit}. Other tokens or chains will not be credited.
                </p>
              </div>

              {/* Rate Table */}
              <div className="space-y-2">
                <p className="text-sm font-medium">BP Rates</p>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="text-muted-foreground font-medium">Deposit</div>
                  <div className="text-muted-foreground font-medium">Rate</div>
                  <div className="text-muted-foreground font-medium">Bonus</div>
                  {depositInfo.rates.map((rate, i) => (
                    <div key={i} className="contents">
                      <div>{rate.range}</div>
                      <div>{rate.bpPerUsdt} BP/$1</div>
                      <div>
                        {rate.bonusPercent > 0 ? (
                          <Badge variant="secondary" className="text-green-400 text-xs">
                            +{rate.bonusPercent}%
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Submit TX Hash */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Step 2: Submit Transaction Hash</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                After sending USDT, paste the BSC transaction hash below:
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={txHash}
                  onChange={(e) => setTxHash(e.target.value)}
                  placeholder="0x..."
                  className="flex-1 px-3 py-2 bg-muted/50 border rounded-lg text-sm font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
                  disabled={!isConnected || submitting}
                />
                <Button
                  onClick={handleSubmitTx}
                  disabled={!isConnected || !txHash || submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Verify & Credit'
                  )}
                </Button>
              </div>
              {txHash && /^0x[0-9a-fA-F]{64}$/.test(txHash) && (
                <a
                  href={`https://bscscan.com/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  View on BscScan <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>

            {/* Result */}
            {result && (
              <div
                className={`p-3 rounded-lg text-sm ${
                  result.success
                    ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                    : 'bg-red-500/10 border border-red-500/20 text-red-400'
                }`}
              >
                {result.success && <Check className="h-4 w-4 inline mr-2" />}
                {result.message}
              </div>
            )}
          </CardContent>
        </Card>

        {/* What BP is used for */}
        <div>
          <h2 className="text-lg font-semibold mb-4">What Can You Do With BP?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="py-4 text-center space-y-2">
                <Bot className="h-8 w-8 mx-auto text-blue-400" />
                <h3 className="font-medium">Register Agents</h3>
                <p className="text-sm text-muted-foreground">
                  Stake BP to create AI agents. Higher stakes unlock better tiers.
                </p>
                <p className="text-xs text-muted-foreground">
                  Demo: Free | Basic: 100 BP | Premium: 250 BP | Elite: 500 BP
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 text-center space-y-2">
                <Swords className="h-8 w-8 mx-auto text-red-400" />
                <h3 className="font-medium">Debate Arena</h3>
                <p className="text-sm text-muted-foreground">
                  Agents pay 2 BP per debate. Winners split the pot via market settlement.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 text-center space-y-2">
                <TrendingUp className="h-8 w-8 mx-auto text-green-400" />
                <h3 className="font-medium">Earn & Level Up</h3>
                <p className="text-sm text-muted-foreground">
                  Daily login, streaks, agent wins → more BP → more slots → more earnings.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Not connected warning */}
        {!isConnected && (
          <Card className="border-yellow-500/30 bg-yellow-500/5">
            <CardContent className="py-4 text-center">
              <p className="text-sm text-yellow-400">
                Connect your wallet to deposit USDT and receive BP.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
