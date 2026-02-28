'use client';

import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  createScheduledSignal,
  getUserSignals,
  updateSignalStatusAction,
  updateSignalAction,
  deleteSignalAction,
  testSignalAction,
} from '@/app/actions';

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

// Query key factory
export const signalKeys = {
  all: ['signals'] as const,
  lists: () => [...signalKeys.all, 'list'] as const,
  list: (filters: string) => [...signalKeys.lists(), { filters }] as const,
  details: () => [...signalKeys.all, 'detail'] as const,
  detail: (id: string) => [...signalKeys.details(), id] as const,
};

// Custom hook for signals
export function useSignals() {
  const queryClient = useQueryClient();

  // Track previous signals state to detect completion
  const previousSignalsRef = React.useRef<Signal[]>([]);

  // Track if create mutation was actually triggered by user
  const isActualCreateRef = React.useRef<boolean>(false);

  // Track recent completions to prevent duplicate toasts
  const recentCompletionsRef = React.useRef<Set<string>>(new Set());

  // Query for fetching signals
  const {
    data: signals = [],
    isLoading,
    error,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    queryKey: signalKeys.lists(),
    queryFn: async () => {
      const result = await getUserSignals();
      if (result.success) {
        return (result.signals || []) as Signal[];
      }
      throw new Error(result.error || 'Failed to load signals');
    },
    staleTime: 1000 * 2, // Consider data fresh for 2 seconds
    refetchInterval: 1000 * 5, // Refetch every 5 seconds for real-time updates
    refetchIntervalInBackground: false, // Don't poll when tab is not focused
    gcTime: 1000 * 30, // Keep in cache for 30 seconds
    networkMode: 'always', // Always try to refetch
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true, // Always refetch when component mounts
    retry: (failureCount, error) => {
      // Retry up to 3 times with exponential backoff
      if (failureCount < 3) return true;
      return false;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    // Enable query deduplication for performance
    structuralSharing: true,

    // Prevent unnecessary re-renders
    notifyOnChangeProps: ['data', 'error', 'isLoading'],
  });

  // Detect signal completions and show appropriate toast
  React.useEffect(() => {
    if (!signals.length || !previousSignalsRef.current.length) {
      previousSignalsRef.current = signals;
      return;
    }

    // Check for signals that transitioned from 'running' to 'active' or 'paused'
    const completedSignals = signals.filter((current) => {
      const previous = previousSignalsRef.current.find((prev) => prev.id === current.id);
      const completionKey = `${current.id}-${current.lastRunAt?.getTime()}`;

      return (
        previous?.status === 'running' &&
        (current.status === 'active' || current.status === 'paused') &&
        current.lastRunAt !== previous.lastRunAt && // Ensure it's a new completion
        !recentCompletionsRef.current.has(completionKey) // Prevent duplicate toasts
      );
    });

    // Show completion toast for each completed signal with debouncing
    completedSignals.forEach((signal) => {
      const completionKey = `${signal.id}-${signal.lastRunAt?.getTime()}`;
      recentCompletionsRef.current.add(completionKey);

      const statusText = signal.frequency === 'once' ? 'completed' : 'run finished';
      toast.success(`Signal "${signal.title}" ${statusText} successfully!`);

      // Clear completion key after 30 seconds to allow future notifications
      setTimeout(() => {
        recentCompletionsRef.current.delete(completionKey);
      }, 30000);
    });

    previousSignalsRef.current = signals;
  }, [signals]);

  // Create signal mutation
  const createMutation = useMutation({
    mutationFn: async (params: {
      title: string;
      prompt: string;
      frequency: 'once' | 'daily' | 'weekly' | 'monthly';
      time: string;
      timezone: string;
      date?: string;
      onSuccess?: () => void;
    }) => {
      const { onSuccess: successCallback, ...mutationParams } = params;
      const result = await createScheduledSignal(mutationParams);
      if (!result.success) {
        throw new Error(result.error || 'Failed to create signal');
      }
      return { result, onSuccess: successCallback };
    },
    onSuccess: (data) => {
      // Only show create toast for actual user-initiated creation
      if (isActualCreateRef.current) {
        toast.success('Signal created successfully!');
        isActualCreateRef.current = false; // Reset flag
      }
      // Immediate cache invalidation for real-time updates
      queryClient.invalidateQueries({ queryKey: signalKeys.lists() });
      queryClient.refetchQueries({ queryKey: signalKeys.lists() });
      if (data.onSuccess) {
        data.onSuccess();
      }
    },
    onError: (error: Error) => {
      isActualCreateRef.current = false; // Reset flag on error
      toast.error(error.message);
    },
  });

  // Update signal status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (params: { id: string; status: 'active' | 'paused' | 'archived' | 'running' }) => {
      const result = await updateSignalStatusAction(params);
      if (!result.success) {
        throw new Error(result.error || 'Failed to update signal');
      }
      return { ...params, result };
    },
    onMutate: async ({ id, status }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: signalKeys.lists() });

      // Snapshot the previous value
      const previousSignals = queryClient.getQueryData<Signal[]>(signalKeys.lists());

      // Optimistically update
      queryClient.setQueryData<Signal[]>(signalKeys.lists(), (old = []) =>
        old.map((signal) => (signal.id === id ? { ...signal, status } : signal)),
      );

      return { previousSignals };
    },
    onSuccess: (data) => {
      const statusText =
        data.status === 'active'
          ? 'activated'
          : data.status === 'paused'
            ? 'paused'
            : data.status === 'archived'
              ? 'archived'
              : 'updated';
      toast.success(`Signal ${statusText}`);
    },
    onError: (error: Error, variables, context) => {
      // Rollback on error
      if (context?.previousSignals) {
        queryClient.setQueryData(signalKeys.lists(), context.previousSignals);
      }
      toast.error(error.message);
    },
    onSettled: () => {
      // Always refetch after error or success for real-time updates
      queryClient.invalidateQueries({ queryKey: signalKeys.lists() });
      queryClient.refetchQueries({ queryKey: signalKeys.lists() });
    },
  });

  // Update signal mutation
  const updateMutation = useMutation({
    mutationFn: async (params: {
      id: string;
      title: string;
      prompt: string;
      frequency: 'once' | 'daily' | 'weekly' | 'monthly';
      time: string;
      timezone: string;
      onSuccess?: () => void;
    }) => {
      const { onSuccess: successCallback, ...mutationParams } = params;
      const result = await updateSignalAction(mutationParams);
      if (!result.success) {
        throw new Error(result.error || 'Failed to update signal');
      }
      return { result, onSuccess: successCallback };
    },
    onSuccess: (data) => {
      toast.success('Signal updated successfully!');
      // Immediate cache invalidation and refetch for real-time updates
      queryClient.invalidateQueries({ queryKey: signalKeys.lists() });
      queryClient.refetchQueries({ queryKey: signalKeys.lists() });
      if (data.onSuccess) {
        data.onSuccess();
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Delete signal mutation
  const deleteMutation = useMutation({
    mutationFn: async (params: { id: string }) => {
      const result = await deleteSignalAction(params);
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete signal');
      }
      return params;
    },
    onMutate: async ({ id }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: signalKeys.lists() });

      // Snapshot the previous value
      const previousSignals = queryClient.getQueryData<Signal[]>(signalKeys.lists());

      // Optimistically update
      queryClient.setQueryData<Signal[]>(signalKeys.lists(), (old = []) =>
        old.filter((signal) => signal.id !== id),
      );

      return { previousSignals };
    },
    onSuccess: () => {
      toast.success('Signal deleted successfully');
      // Force immediate refetch after delete
      queryClient.refetchQueries({ queryKey: signalKeys.lists() });
    },
    onError: (error: Error, variables, context) => {
      // Rollback on error
      if (context?.previousSignals) {
        queryClient.setQueryData(signalKeys.lists(), context.previousSignals);
      }
      toast.error(error.message);
    },
    onSettled: () => {
      // Always refetch after error or success for real-time updates
      queryClient.invalidateQueries({ queryKey: signalKeys.lists() });
      queryClient.refetchQueries({ queryKey: signalKeys.lists() });
    },
  });

  // Test signal mutation
  const testMutation = useMutation({
    mutationFn: async (params: { id: string }) => {
      const result = await testSignalAction(params);
      if (!result.success) {
        throw new Error(result.error || 'Failed to test signal');
      }
      return params;
    },
    onMutate: async ({ id }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: signalKeys.lists() });

      // Snapshot the previous value
      const previousSignals = queryClient.getQueryData<Signal[]>(signalKeys.lists());

      // Optimistically update to 'running' status
      queryClient.setQueryData<Signal[]>(signalKeys.lists(), (old = []) =>
        old.map((signal) => (signal.id === id ? { ...signal, status: 'running' as const } : signal)),
      );

      return { previousSignals };
    },
    onSuccess: () => {
      toast.success("Test run started - you'll be notified when complete!");
    },
    onError: (error: Error, variables, context) => {
      // Rollback on error
      if (context?.previousSignals) {
        queryClient.setQueryData(signalKeys.lists(), context.previousSignals);
      }
      toast.error(error.message);
    },
    onSettled: () => {
      // Always refetch after error or success to get real status
      queryClient.invalidateQueries({ queryKey: signalKeys.lists() });
      queryClient.refetchQueries({ queryKey: signalKeys.lists() });
    },
  });

  // Manual refresh function for immediate updates
  const manualRefresh = async () => {
    // Cancel any in-flight queries first
    await queryClient.cancelQueries({ queryKey: signalKeys.lists() });
    // Invalidate and refetch with fresh data
    await queryClient.invalidateQueries({ queryKey: signalKeys.lists() });
    return queryClient.refetchQueries({
      queryKey: signalKeys.lists(),
      type: 'active', // Only refetch active queries
    });
  };

  // Optimized cache invalidation for running signals
  React.useEffect(() => {
    const hasRunningSignals = signals.some((signal) => signal.status === 'running');

    if (!hasRunningSignals) return;

    const interval = setInterval(() => {
      // Only invalidate if there are still running signals
      const currentRunning = signals.some((signal) => signal.status === 'running');
      if (currentRunning) {
        queryClient.invalidateQueries({ queryKey: signalKeys.lists() });
      }
    }, 3000); // Check every 3 seconds when there are running signals

    return () => clearInterval(interval);
  }, [signals, queryClient]);

  return {
    // Data
    signals,
    lookouts: signals, // backwards compatibility
    isLoading,
    error,

    // Actions
    refetch,
    manualRefresh,

    // Metadata
    lastUpdated: dataUpdatedAt,
    createSignal: (params: any) => {
      isActualCreateRef.current = true; // Mark as actual create
      createMutation.mutate(params);
    },
    updateStatus: updateStatusMutation.mutate,
    updateSignal: updateMutation.mutate,
    deleteSignal: deleteMutation.mutate,
    testSignal: testMutation.mutate,

    // Loading states
    isCreating: createMutation.isPending,
    isUpdatingStatus: updateStatusMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isTesting: testMutation.isPending,

    // For backwards compatibility with existing optimistic update patterns
    isPending:
      createMutation.isPending ||
      updateStatusMutation.isPending ||
      updateMutation.isPending ||
      deleteMutation.isPending ||
      testMutation.isPending,
  };
}

// Helper hook for filtered signals
export function useFilteredSignals(filter: 'active' | 'archived' | 'all' = 'all') {
  const { signals, ...rest } = useSignals();

  const filteredSignals = signals.filter((signal) => {
    if (filter === 'active')
      return signal.status === 'active' || signal.status === 'paused' || signal.status === 'running';
    if (filter === 'archived') return signal.status === 'archived';
    return true;
  });

  return {
    signals: filteredSignals,
    ...rest,
  };
}
