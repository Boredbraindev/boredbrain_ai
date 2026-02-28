/**
 * Migration script to update localStorage keys from Scira to Bored Brain
 * This runs automatically on app load to ensure smooth transition for existing users
 */

export function migrateLocalStorageKeys() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  const migrations = [
    ['scira-selected-model', 'boredbrain-selected-model'],
    ['scira-selected-group', 'boredbrain-selected-group'],
    ['scira-custom-instructions-enabled', 'boredbrain-custom-instructions-enabled'],
    ['scira-search-provider', 'boredbrain-search-provider'],
    ['scira-user-data', 'boredbrain-user-data'],
  ];

  let migrated = false;

  migrations.forEach(([oldKey, newKey]) => {
    const value = localStorage.getItem(oldKey);
    if (value !== null) {
      // Only migrate if the new key doesn't already exist
      if (localStorage.getItem(newKey) === null) {
        localStorage.setItem(newKey, value);
        migrated = true;
      }
      // Remove the old key
      localStorage.removeItem(oldKey);
    }
  });

  // Also update model names if they exist in the new keys
  const selectedModelKey = 'boredbrain-selected-model';
  const selectedModel = localStorage.getItem(selectedModelKey);
  if (selectedModel && selectedModel.startsWith('scira-')) {
    const newModelName = selectedModel.replace('scira-', 'boredbrain-');
    localStorage.setItem(selectedModelKey, newModelName);
    migrated = true;
  }

  // Mark migration as complete to avoid running again
  if (migrated) {
    localStorage.setItem('boredbrain-migration-v1-complete', 'true');
    console.log('Successfully migrated Scira settings to Bored Brain');
  }
}

/**
 * Check if migration has already been completed
 */
export function isMigrationComplete() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return true;
  }
  return localStorage.getItem('boredbrain-migration-v1-complete') === 'true';
}
