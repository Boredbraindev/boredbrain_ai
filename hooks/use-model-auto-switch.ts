
import { useEffect } from 'react';
import { requiresProSubscription } from '@/ai/providers';

interface UseModelAutoSwitchProps {
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  isUserPro: boolean;
  proStatusLoading: boolean;
  showBanner: (type: 'info' | 'error' | 'success', message: string, timeout?: number) => void;
}

export function useModelAutoSwitch({
  selectedModel,
  setSelectedModel,
  isUserPro,
  proStatusLoading,
  showBanner,
}: UseModelAutoSwitchProps) {
  useEffect(() => {
    if (proStatusLoading) return;

    const currentModelRequiresPro = requiresProSubscription(selectedModel);

    if (currentModelRequiresPro && !isUserPro && selectedModel !== 'boredbrain-default') {
      console.log(`Auto-switching from pro model '${selectedModel}' to 'boredbrain-default' - user lost pro access`);
      setSelectedModel('boredbrain-default');
      showBanner('info', 'Switched to the default model — premium models require Pro access.');
    }
  }, [selectedModel, isUserPro, proStatusLoading, setSelectedModel, showBanner]);
}
