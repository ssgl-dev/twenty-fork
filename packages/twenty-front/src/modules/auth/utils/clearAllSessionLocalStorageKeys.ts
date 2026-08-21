import { safeRemoveLocalStorageItems } from '@/auth/utils/safeRemoveLocalStorageItems';
import {
  clearAnalysisStorage,
  LEGACY_ANALYSIS_LOCAL_STORAGE_KEYS,
} from '@/analysis/states/analysisStorage';
import {
  ALL_METADATA_ENTITY_KEYS,
  METADATA_STORE_KEY_PREFIX,
  type MetadataEntityKey,
} from '@/metadata-store/states/metadataStoreState';
import { clearMetadataStoreStorage } from '@/metadata-store/storage/metadataStoreStorage';
import { clearSessionLocalStorageKeys } from './clearSessionLocalStorageKeys';

const getMetadataStoreKeys = (): string[] =>
  ALL_METADATA_ENTITY_KEYS.map(
    (key: MetadataEntityKey) => `${METADATA_STORE_KEY_PREFIX}${key}`,
  );

export const clearAllSessionLocalStorageKeys = () => {
  clearSessionLocalStorageKeys();
  void clearMetadataStoreStorage();
  safeRemoveLocalStorageItems(getMetadataStoreKeys());
  void clearAnalysisStorage();
  safeRemoveLocalStorageItems(LEGACY_ANALYSIS_LOCAL_STORAGE_KEYS);
};
