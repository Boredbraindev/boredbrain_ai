'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMediaQuery } from '@/hooks/use-media-query';
import {
  getUserMessageCount,
  getExtremeSearchUsageCount,
  generateReferralCode,
  getReferralStats,
  useReferralCode as applyReferralCode,
} from '@/app/actions';
import { cn } from '@/lib/utils';
import { CopyIcon, CheckIcon, GiftIcon } from '@phosphor-icons/react';
import { toast } from 'sonner';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: any;
  subscriptionData?: any;
  isProUser?: boolean;
  isProStatusLoading?: boolean;
  isCustomInstructionsEnabled?: boolean;
  setIsCustomInstructionsEnabled?: (value: boolean | ((val: boolean) => boolean)) => void;
  initialTab?: 'account' | 'usage' | 'referral';
}

const tabs = [
  { value: 'account', label: 'Account' },
  { value: 'usage', label: 'Usage' },
  { value: 'referral', label: 'Referral' },
];

function AccountTab({ user }: { user: any }) {
  const initials = useMemo(() => {
    if (!user?.name) {
      return 'U';
    }
    return user.name
      .split(' ')
      .map((chunk: string) => chunk.charAt(0))
      .join('')
      .toUpperCase();
  }, [user]);

  const infoRows: Array<{ label: string; value: string }> = [
    { label: 'Account', value: 'Telegram mini app' },
    { label: 'Access', value: 'Instant entry' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <Avatar className="h-20 w-20">
          <AvatarImage src={user?.image || ''} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="space-y-1">
          <h3 className="text-lg font-semibold leading-tight">{user?.name || 'User'}</h3>
          {user?.username && <p className="text-sm text-muted-foreground">@{user.username}</p>}
        </div>
      </div>

      <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-3">
        {infoRows.map((row) => (
          <div key={row.label} className="text-left">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{row.label}</p>
            <p className="text-sm font-medium mt-1 leading-snug">{row.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function UsageTab({ user }: { user: any }) {
  const { data: messageStats, isLoading: messageLoading } = useQuery({
    queryKey: ['usage', 'messages', user?.id],
    queryFn: () => getUserMessageCount(user),
    enabled: Boolean(user?.id),
  });

  const { data: extremeStats, isLoading: extremeLoading } = useQuery({
    queryKey: ['usage', 'extreme', user?.id],
    queryFn: () => getExtremeSearchUsageCount(user),
    enabled: Boolean(user?.id),
  });

  const totalSearches = messageStats?.count ?? 0;
  const extremeUsage = extremeStats?.count ?? 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border/60 bg-background/40 p-4">
          <p className="text-xs uppercase text-muted-foreground">Total Searches</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-semibold">{messageLoading ? '—' : totalSearches}</span>
            <span className="text-xs text-muted-foreground">lifetime</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Unlimited usage in Telegram.</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-background/40 p-4">
          <p className="text-xs uppercase text-muted-foreground">Extreme Search</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-semibold">{extremeLoading ? '—' : extremeUsage}</span>
            <span className="text-xs text-muted-foreground">runs</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Advanced tools are always on.</p>
        </div>
      </div>
      <div className="rounded-lg border border-dashed border-border/60 bg-muted/15 p-4 text-sm text-muted-foreground">
        Connectors and custom instructions are unavailable in the mini app; everything runs with the default setup.
      </div>
    </div>
  );
}

function ReferralTab({ user }: { user: any }) {
  const [referralCodeInput, setReferralCodeInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  const {
    data: referralStats,
    isLoading: referralLoading,
    refetch,
  } = useQuery({
    queryKey: ['referral', 'stats', user?.id],
    queryFn: () => getReferralStats(user?.id),
    enabled: Boolean(user?.id),
  });

  const handleGenerateCode = async () => {
    if (!user?.id) return;

    try {
      const result = await generateReferralCode(user.id);
      if (result.success) {
        refetch();
        toast.success('Referral code generated successfully!');
      } else {
        toast.error(result.error || 'Failed to generate referral code');
      }
    } catch (error) {
      toast.error('Failed to generate referral code');
    }
  };

  const handleCopyCode = async () => {
    if (!referralStats?.referralCode) return;

    try {
      await navigator.clipboard.writeText(referralStats.referralCode);
      setCopied(true);
      toast.success('Referral code copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy referral code');
    }
  };

  const handleUseReferralCode = async () => {
    if (!referralCodeInput.trim()) {
      toast.error('Please enter a referral code');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await applyReferralCode(referralCodeInput.trim());
      if (result.success) {
        toast.success(result.message || 'Referral code applied successfully!');
        setReferralCodeInput('');
      } else {
        toast.error(result.error || 'Failed to apply referral code');
      }
    } catch (error) {
      toast.error('Failed to apply referral code');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* My Referral Code Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <GiftIcon size={20} className="text-primary" />
          <h3 className="text-lg font-semibold">My Referral Code</h3>
        </div>

        {referralLoading ? (
          <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
            <div className="animate-pulse space-y-2">
              <div className="h-4 bg-muted rounded w-1/4"></div>
              <div className="h-8 bg-muted rounded"></div>
            </div>
          </div>
        ) : referralStats?.referralCode ? (
          <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Your referral code:</span>
              <Button onClick={handleCopyCode} variant="ghost" size="sm" className="h-8 px-2">
                {copied ? <CheckIcon size={16} className="text-green-600" /> : <CopyIcon size={16} />}
              </Button>
            </div>
            <div className="bg-background/50 rounded-md p-3 font-mono text-lg font-semibold text-center">
              {referralStats.referralCode}
            </div>
            <p className="text-xs text-muted-foreground text-center">Share this code with friends to earn rewards!</p>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border/60 bg-muted/15 p-4 text-center">
            <p className="text-sm text-muted-foreground mb-3">You don&apos;t have a referral code yet</p>
            <Button onClick={handleGenerateCode} size="sm">
              Generate Referral Code
            </Button>
          </div>
        )}
      </div>

      {/* Referral Stats */}
      {referralStats && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Referral Stats</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-border/60 bg-background/40 p-4">
              <p className="text-xs uppercase text-muted-foreground">Total Referrals</p>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-3xl font-semibold">{referralStats.totalReferrals}</span>
                <span className="text-xs text-muted-foreground">people</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Friends who joined using your code</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/40 p-4">
              <p className="text-xs uppercase text-muted-foreground">Status</p>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-lg font-semibold text-green-600">Active</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Your referral program is active</p>
            </div>
          </div>
        </div>
      )}

      {/* Use Referral Code Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Use Referral Code</h3>
        <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Have a referral code? Enter it below to get started with rewards!
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="Enter referral code"
              value={referralCodeInput}
              onChange={(e) => setReferralCodeInput(e.target.value.toUpperCase())}
              className="flex-1"
              maxLength={8}
            />
            <Button onClick={handleUseReferralCode} disabled={isSubmitting || !referralCodeInput.trim()} size="sm">
              {isSubmitting ? 'Applying...' : 'Apply'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SettingsDialog({ open, onOpenChange, user, initialTab = 'account' }: SettingsDialogProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [activeTab, setActiveTab] = useState<'account' | 'usage' | 'referral'>(initialTab);

  const handleTabChange = (value: string) => {
    if (value === 'usage') {
      setActiveTab('usage');
    } else if (value === 'referral') {
      setActiveTab('referral');
    } else {
      setActiveTab('account');
    }
  };

  const content = (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
      <TabsList className="grid w-full grid-cols-3 items-center justify-center">
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value} className="flex items-center justify-center">
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="account" className="mt-6">
        <AccountTab user={user} />
      </TabsContent>

      <TabsContent value="usage" className="mt-6">
        <UsageTab user={user} />
      </TabsContent>

      <TabsContent value="referral" className="mt-6">
        <ReferralTab user={user} />
      </TabsContent>
    </Tabs>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="h-[100dvh] max-h-[100dvh] flex flex-col">
          <DrawerHeader className="text-left flex-shrink-0">
            <DrawerTitle>Settings</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6 overflow-y-auto flex-1">{content}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <div className="pb-4">{content}</div>
      </DialogContent>
    </Dialog>
  );
}
