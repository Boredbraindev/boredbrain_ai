
import { useState, useEffect, useCallback } from 'react';

export function useSettingsDialog() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'account' | 'usage'>('account');

  const handleOpenSettings = useCallback((tab?: string) => {
    const normalizedTab = tab === 'usage' ? 'usage' : 'account';
    setSettingsInitialTab(normalizedTab);
    setSettingsOpen(true);
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash === '#settings') {
        setSettingsOpen(true);
      }
    };

    handleHashChange();

    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  useEffect(() => {
    if (settingsOpen) {
      if (window.location.hash !== '#settings') {
        window.history.pushState(null, '', '#settings');
      }
    } else {
      if (window.location.hash === '#settings') {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }
  }, [settingsOpen]);

  return { settingsOpen, setSettingsOpen, settingsInitialTab, handleOpenSettings };
}
