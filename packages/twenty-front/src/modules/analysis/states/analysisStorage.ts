import * as idb from 'idb-keyval';

import { isDefined } from 'twenty-shared/utils';

import { type JotaiSyncStorage } from '@/ui/utilities/state/jotai/types/JotaiSyncStorage';
import { createIndexedDbBackedJotaiStorage } from '@/ui/utilities/state/jotai/utils/createIndexedDbBackedJotaiStorage';
import { logError } from '~/utils/logError';

const ANALYSIS_STORAGE_CACHE_NAME = 'analysis-store';
const IDB_STORE_NAME = 'keyval';

// The analysis state used to live in localStorage, whose ~5MB quota overflows
// once a few large datasets and results are persisted. IndexedDB has a much
// larger quota and is write-failure-safe (writes are fire-and-forget).
export const LEGACY_ANALYSIS_LOCAL_STORAGE_KEYS: string[] = [
  'analysis-analyses',
  'analysis-files',
  'analysis-runs',
];

export const analysisStorage =
  createIndexedDbBackedJotaiStorage<unknown>(ANALYSIS_STORAGE_CACHE_NAME);

export const analysisStoreStorage = analysisStorage.storage;

export const hydrateAnalysisStorage = analysisStorage.hydrate;
export const clearAnalysisStorage = analysisStorage.clear;

// One-time migration: move any existing analysis state out of localStorage
// into the IndexedDB-backed store, then free the legacy keys. Must run before
// hydrateAnalysisStorage() so the atoms pick up the migrated values.
export const migrateAnalysisStateFromLocalStorage = async (): Promise<void> => {
  try {
    const store = idb.createStore(
      `twenty-front-${ANALYSIS_STORAGE_CACHE_NAME}`,
      IDB_STORE_NAME,
    );

    for (const key of LEGACY_ANALYSIS_LOCAL_STORAGE_KEYS) {
      const alreadyStored = await idb.get(key, store);

      if (isDefined(alreadyStored)) {
        continue;
      }

      const legacyValue = localStorage.getItem(key);

      if (legacyValue === null) {
        continue;
      }

      try {
        await idb.set(key, JSON.parse(legacyValue), store);
      } catch (error) {
        logError(error);
        continue;
      }

      localStorage.removeItem(key);
    }
  } catch (error) {
    logError(error);
  }
};

export const createAnalysisTypedStorage = <Value>(): JotaiSyncStorage<Value> =>
  analysisStoreStorage as JotaiSyncStorage<Value>;
