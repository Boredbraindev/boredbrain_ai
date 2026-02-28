'use client';

import React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { PlusSignIcon, BinocularsIcon, RefreshIcon, Cancel01Icon } from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/user-context';
import { useSignals } from '@/hooks/use-signals';
import { SidebarProvider } from '@/components/ui/sidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { SignalDetailsSidebar } from './components/signal-details-sidebar';
import { toast } from 'sonner';

// Import our new components
import { Navbar } from './components/navbar';
import { LoadingSkeletons } from './components/loading-skeleton';
import { NoActiveSignalsEmpty, NoArchivedSignalsEmpty } from './components/empty-state';
import { TotalLimitWarning, DailyLimitWarning } from './components/warning-card';
import { SignalCard } from './components/signal-card';
import { ProUpgradeScreen } from './components/pro-upgrade-screen';
import { SignalForm } from './components/signal-form';
import { useSignalForm } from './hooks/use-signal-form';
import { getRandomExamples, SIGNAL_LIMITS, timezoneOptions } from './constants';
import { formatFrequency } from './utils/time-utils';

interface Signal {
  id: string;
  title: string;
  prompt: string;
  frequency: string;
  timezone: string;
  nextRunAt: Date;
  status: 'active' | 'paused' | 'archived' | 'running';
  lastRunAt?: Date | null;
  lastRunChatId?: string | null;
  createdAt: Date;
  cronSchedule?: string;
}

const guestAccessEnabled =
  (process.env.NEXT_PUBLIC_ALLOW_GUEST_ACCESS ?? 'true') !== 'false';
const proUnlockedForAll =
  (process.env.NEXT_PUBLIC_UNLOCK_PRO_FOR_ALL ?? 'true') !== 'false';
const bypassProGating = guestAccessEnabled || proUnlockedForAll;

export default function SignalsPage() {
  const [activeTab, setActiveTab] = React.useState('active');
  const isMobile = useIsMobile();
  const shouldBypassProGating = bypassProGating;

  // Random examples state
  const [randomExamples, setRandomExamples] = React.useState(() => getRandomExamples(6));

  // Sidebar state for signal details
  const [selectedSignal, setSelectedSignal] = React.useState<Signal | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  // Delete dialog state
  const [signalToDelete, setSignalToDelete] = React.useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);

  // Authentication and Pro status
  const { user, isProUser, isLoading: isProStatusLoading } = useUser();
  const router = useRouter();

  // Signals data and mutations
  const {
    signals: allSignals,
    isLoading,
    error,
    createSignal,
    updateStatus,
    updateSignal,
    deleteSignal,
    testSignal,
    manualRefresh,
    isPending: isMutating,
  } = useSignals();

  // Detect user timezone on client with fallback to available options
  const [detectedTimezone, setDetectedTimezone] = React.useState<string>('UTC');

  React.useEffect(() => {
    try {
      const systemTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      console.log('🌍 Detected system timezone:', systemTimezone);

      // Check if the detected timezone is in our options list
      const matchingOption = timezoneOptions.find((option) => option.value === systemTimezone);
      console.log('📍 Found matching option:', matchingOption);

      if (matchingOption) {
        console.log('✅ Using exact match:', systemTimezone);
        setDetectedTimezone(systemTimezone);
      } else {
        // Try to find a close match based on common patterns
        let fallbackTimezone = 'UTC';

        if (systemTimezone.includes('America/')) {
          if (
            systemTimezone.includes('New_York') ||
            systemTimezone.includes('Montreal') ||
            systemTimezone.includes('Toronto')
          ) {
            fallbackTimezone = 'America/New_York';
          } else if (systemTimezone.includes('Chicago') || systemTimezone.includes('Winnipeg')) {
            fallbackTimezone = 'America/Chicago';
          } else if (systemTimezone.includes('Denver') || systemTimezone.includes('Edmonton')) {
            fallbackTimezone = 'America/Denver';
          } else if (systemTimezone.includes('Los_Angeles') || systemTimezone.includes('Vancouver')) {
            fallbackTimezone = 'America/Los_Angeles';
          }
        } else if (systemTimezone.includes('Europe/')) {
          if (systemTimezone.includes('London')) {
            fallbackTimezone = 'Europe/London';
          } else if (
            systemTimezone.includes('Paris') ||
            systemTimezone.includes('Berlin') ||
            systemTimezone.includes('Rome')
          ) {
            fallbackTimezone = 'Europe/Paris';
          }
        } else if (systemTimezone.includes('Asia/')) {
          if (systemTimezone.includes('Tokyo')) {
            fallbackTimezone = 'Asia/Tokyo';
          } else if (systemTimezone.includes('Shanghai') || systemTimezone.includes('Beijing')) {
            fallbackTimezone = 'Asia/Shanghai';
          } else if (systemTimezone.includes('Singapore')) {
            fallbackTimezone = 'Asia/Singapore';
          } else if (systemTimezone.includes('Kolkata') || systemTimezone.includes('Mumbai')) {
            fallbackTimezone = 'Asia/Kolkata';
          }
        } else if (systemTimezone.includes('Australia/')) {
          if (systemTimezone.includes('Sydney') || systemTimezone.includes('Melbourne')) {
            fallbackTimezone = 'Australia/Sydney';
          } else if (systemTimezone.includes('Perth')) {
            fallbackTimezone = 'Australia/Perth';
          }
        }

        console.log('🔄 Using fallback timezone:', fallbackTimezone);
        setDetectedTimezone(fallbackTimezone);
      }
    } catch {
      console.log('❌ Timezone detection failed, using UTC');
      setDetectedTimezone('UTC');
    }
  }, []);

  // Form logic hook
  const formHook = useSignalForm(detectedTimezone);

  // Redirect non-authenticated users
  React.useEffect(() => {
    if (shouldBypassProGating) return;
    if (!isProStatusLoading && !user) {
      router.push('/sign-in');
    }
  }, [user, isProStatusLoading, router, shouldBypassProGating]);

  // Handle error display
  React.useEffect(() => {
    if (error) {
      toast.error('Failed to load signals');
    }
  }, [error]);

  // Calculate limits and counts
  const activeDailySignals = allSignals.filter(
    (l: Signal) => l.frequency === 'daily' && l.status === 'active',
  ).length;
  const totalSignals = allSignals.filter((l: Signal) => l.status !== 'archived').length;
  const canCreateMore = totalSignals < SIGNAL_LIMITS.TOTAL_SIGNALS;
  const canCreateDailyMore = activeDailySignals < SIGNAL_LIMITS.DAILY_SIGNALS;

  // Filter signals by tab
  const filteredSignals = allSignals.filter((signal: Signal) => {
    if (activeTab === 'active')
      return signal.status === 'active' || signal.status === 'paused' || signal.status === 'running';
    if (activeTab === 'archived') return signal.status === 'archived';
    return true;
  });

  // Event handlers
  const handleStatusChange = async (id: string, status: 'active' | 'paused' | 'archived' | 'running') => {
    updateStatus({ id, status });
  };

  const handleDelete = (id: string) => {
    setSignalToDelete(id);
    setIsDeleteDialogOpen(true);
  };

  const handleTest = (id: string) => {
    testSignal({ id });
  };

  const handleManualRefresh = async () => {
    await manualRefresh();
  };

  const confirmDelete = () => {
    if (signalToDelete) {
      deleteSignal({ id: signalToDelete });
      setSignalToDelete(null);
      setIsDeleteDialogOpen(false);
    }
  };

  const handleOpenSignalDetails = (signal: Signal) => {
    setSelectedSignal(signal);
    setIsSidebarOpen(true);
  };

  const handleEditSignal = (signal: Signal) => {
    formHook.populateFormForEdit(signal);
    setIsSidebarOpen(false);
  };

  const handleSignalChange = (newSignal: Signal) => {
    setSelectedSignal(newSignal);
  };

  // Show loading state while checking authentication
  if (isProStatusLoading) {
    return (
      <>
        <Navbar user={user} isProUser={isProUser} isProStatusLoading={isProStatusLoading} showProBadge={false} />
        <div className="flex-1 flex flex-col justify-center py-8">
          <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
            <LoadingSkeletons count={3} />
          </div>
        </div>
      </>
    );
  }

  // Show upgrade prompt for non-Pro users
  if (!shouldBypassProGating && !isProUser) {
    return <ProUpgradeScreen user={user} isProUser={isProUser} isProStatusLoading={isProStatusLoading} />;
  }

  return (
    <>
      {/* Signal Details Sidebar */}
      {selectedSignal && (
        <>
          {/* Backdrop */}
          <div
            className={`fixed inset-0 z-40 transition-all duration-300 ease-out ${
              isSidebarOpen
                ? 'bg-black/10 backdrop-blur-sm opacity-100'
                : 'bg-black/0 backdrop-blur-0 opacity-0 pointer-events-none'
            }`}
            onClick={() => setIsSidebarOpen(false)}
          />

          {/* Sidebar */}
          <div
            className={`fixed right-0 top-0 h-screen w-full sm:max-w-xl bg-background border-l z-50 shadow-xl transform transition-all duration-500 ease-out overflow-y-auto ${
              isSidebarOpen ? 'translate-x-0' : 'translate-x-full'
            }`}
          >
            <div className="h-full flex flex-col">
              {/* Header */}
              <div className="border-b px-3 sm:px-4 py-3 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HugeiconsIcon icon={BinocularsIcon} size={16} color="currentColor" strokeWidth={1.5} />
                    <span className="font-medium text-sm">Signal Details</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setIsSidebarOpen(false)} className="h-7 w-7 p-0">
                    <HugeiconsIcon icon={Cancel01Icon} size={14} color="currentColor" strokeWidth={1.5} />
                  </Button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto">
                <SignalDetailsSidebar
                  signal={selectedSignal as any}
                  allSignals={allSignals as any}
                  isOpen={isSidebarOpen}
                  onOpenChange={setIsSidebarOpen}
                  onSignalChange={handleSignalChange as any}
                  onEditSignal={handleEditSignal as any}
                  onTest={handleTest}
                />
              </div>
            </div>
          </div>
        </>
      )}

      <div className="min-h-screen bg-background overflow-x-hidden">
        <div className="max-w-3xl w-full mx-auto px-4 pt-12 sm:pt-14 pb-12 sm:pb-10">
          {/* Header */}
          <div className="flex items-center justify-center mb-6 sm:mb-8">
            <h1
              className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-primary"
              style={{ fontFamily: 'var(--font-logo), var(--font-sans)', textShadow: '0 0 6px rgba(255,255,255,0.28), 0 0 14px rgba(255,255,255,0.16)' }}
            >
              Signals
            </h1>
          </div>

          {/* Header with Tabs and Actions */}
          <div className="mb-6 space-y-4">

              {isMobile ? (
                /* Mobile Layout: Actions first, then Tabs */
                <div className="space-y-3">
                  {/* Action buttons - prominent on mobile */}
                  <div className="flex gap-3">
                    <Drawer open={formHook.isCreateDialogOpen} onOpenChange={formHook.handleDialogOpenChange}>
                      <DrawerTrigger asChild>
                        <Button className="flex-1 rounded-full" disabled={!canCreateMore}>
                          <HugeiconsIcon
                            icon={PlusSignIcon}
                            size={16}
                            color="currentColor"
                            strokeWidth={1.5}
                            className="mr-2"
                          />
                          Add New Signal
                        </Button>
                      </DrawerTrigger>
                      <DrawerContent className="max-h-[85vh]">
                        <DrawerHeader className="pb-4">
                          <DrawerTitle className="text-lg">
                            {formHook.editingSignal ? 'Edit Signal' : 'Create New Signal'}
                          </DrawerTitle>
                        </DrawerHeader>

                        <div className="px-4 pb-4 overflow-y-auto flex-1">
                          <SignalForm
                            formHook={formHook}
                            isMutating={isMutating}
                            activeDailySignals={activeDailySignals}
                            totalSignals={totalSignals}
                            canCreateMore={canCreateMore}
                            canCreateDailyMore={canCreateDailyMore}
                            createSignal={createSignal}
                            updateSignal={updateSignal}
                          />
                        </div>
                      </DrawerContent>
                    </Drawer>

                    <Button
                      variant="outline"
                      onClick={handleManualRefresh}
                      disabled={isMutating}
                      title="Refresh signals"
                      className="px-3 rounded-full"
                    >
                      <HugeiconsIcon
                        icon={RefreshIcon}
                        size={16}
                        color="currentColor"
                        strokeWidth={1.5}
                        className={isMutating ? 'animate-spin' : ''}
                      />
                    </Button>
                  </div>

                  {/* Tabs for mobile */}
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="bg-muted/10 border border-border/40 rounded-full w-full">
                      <TabsTrigger value="active" className="flex-1 rounded-full">
                        Active
                      </TabsTrigger>
                      <TabsTrigger value="archived" className="flex-1 rounded-full">
                        Archived
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              ) : (
                /* Desktop Layout: Tabs and Actions side by side */
                <div className="flex justify-between items-center">
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="bg-muted/10 border border-border/40 rounded-full">
                      <TabsTrigger value="active" className="rounded-full">Active</TabsTrigger>
                      <TabsTrigger value="archived" className="rounded-full">Archived</TabsTrigger>
                    </TabsList>
                  </Tabs>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleManualRefresh}
                      disabled={isMutating}
                      title="Refresh signals"
                      className="rounded-full"
                    >
                      <HugeiconsIcon
                        icon={RefreshIcon}
                        size={16}
                        color="currentColor"
                        strokeWidth={1.5}
                        className={isMutating ? 'animate-spin' : ''}
                      />
                      <span className="ml-1.5">Refresh</span>
                    </Button>
                    <Dialog open={formHook.isCreateDialogOpen} onOpenChange={formHook.handleDialogOpenChange}>
                      <DialogTrigger asChild>
                        <Button size="sm" disabled={!canCreateMore} className="rounded-full">
                          <HugeiconsIcon
                            icon={PlusSignIcon}
                            size={16}
                            color="currentColor"
                            strokeWidth={1.5}
                            className="mr-1"
                          />
                          Add new
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[580px] max-h-[90vh] overflow-y-auto">
                        <DialogHeader className="pb-4">
                          <DialogTitle className="text-lg">
                            {formHook.editingSignal ? 'Edit Signal' : 'Create New Signal'}
                          </DialogTitle>
                        </DialogHeader>

                        <SignalForm
                          formHook={formHook}
                          isMutating={isMutating}
                          activeDailySignals={activeDailySignals}
                          totalSignals={totalSignals}
                          canCreateMore={canCreateMore}
                          canCreateDailyMore={canCreateDailyMore}
                          createSignal={createSignal}
                          updateSignal={updateSignal}
                        />
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              )}
            </div>

            {/* Limit Warnings */}
            {!canCreateMore && <TotalLimitWarning />}
            {canCreateMore && !canCreateDailyMore && <DailyLimitWarning />}

            {/* Main Content Tabs */}
            <Tabs value={activeTab} defaultValue="active" className="space-y-6">
              <TabsContent value="active" className="space-y-6">
                {isLoading ? (
                  <LoadingSkeletons count={3} />
                ) : filteredSignals.length === 0 ? (
                  <NoActiveSignalsEmpty />
                ) : (
                  <div className="space-y-3">
                    {filteredSignals.map((signal) => (
                      <SignalCard
                        key={signal.id}
                        signal={signal}
                        isMutating={isMutating}
                        onStatusChange={handleStatusChange}
                        onDelete={handleDelete}
                        onTest={handleTest}
                        onOpenDetails={handleOpenSignalDetails}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="archived">
                {isLoading ? (
                  <LoadingSkeletons count={2} showActions={false} />
                ) : filteredSignals.length === 0 ? (
                  <NoArchivedSignalsEmpty />
                ) : (
                  <div className="space-y-3">
                    {filteredSignals.map((signal) => (
                      <SignalCard
                        key={signal.id}
                        signal={signal}
                        isMutating={isMutating}
                        onStatusChange={handleStatusChange}
                        onDelete={handleDelete}
                        onTest={handleTest}
                        onOpenDetails={handleOpenSignalDetails}
                        showActions={false}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {/* Example Cards */}
            <div className="mt-12">
              <h2 className="text-lg font-semibold mb-4">Example Signals</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-hidden">
                {randomExamples.map((example, index) => (
                  <Card
                    key={index}
                    className="cursor-pointer transition-all duration-200 group !pb-0 !mb-0 max-h-96 h-full bg-muted/10 border border-border/40 hover:border-primary/30 backdrop-blur-sm shadow-none rounded-2xl"
                    onClick={() => formHook.handleUseExample(example)}
                  >
                    <CardHeader>
                      <CardTitle className="text-sm font-medium group-hover:text-primary transition-colors">
                        {example.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="bg-background/70 border !mb-0 sm:!-mb-1 border-border/40 rounded-xl mx-3 p-4 grow h-28 sm:h-28 group-hover:bg-background/90 group-hover:border-primary/20 transition-all duration-200">
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {example.prompt.slice(0, 100)}...
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatFrequency(example.frequency, example.time)}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="mx-4 max-w-md rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Signal</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this signal? This action cannot be undone and will permanently remove all
              run history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={() => setIsDeleteDialogOpen(false)} className="w-full sm:w-auto rounded-full">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full sm:w-auto rounded-full"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
