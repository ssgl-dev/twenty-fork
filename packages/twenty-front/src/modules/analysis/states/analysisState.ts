import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';

import { MOCK_ANALYSIS_FILES } from '@/analysis/mocks/analysisFiles.mock';
import { createAnalysisTypedStorage } from '@/analysis/states/analysisStorage';
import {
  type Analysis,
  type AnalysisFile,
  type AnalysisRun,
} from '@/analysis/types/analysis.types';

// Persist analyses, uploaded datasets and runs in IndexedDB (not localStorage,
// whose ~5MB quota overflows with large datasets/results). They survive a
// reload / navigating away from the Analysis page.
export const analysesState = atomWithStorage<Analysis[]>(
  'analysis-analyses',
  [],
  createAnalysisTypedStorage<Analysis[]>(),
);

export const analysisFilesState = atomWithStorage<AnalysisFile[]>(
  'analysis-files',
  MOCK_ANALYSIS_FILES,
  createAnalysisTypedStorage<AnalysisFile[]>(),
);

export const selectedAnalysisFileIdState = atom<string | null>(null);

export const selectedAnalysisState = atom<Analysis | null>(null);

export const selectedAnalysisRunState = atom<AnalysisRun | null>(null);

// Persisted map of analysisId -> latest run (with its real result), so a run
// stays visible after leaving the page or reloading.
export const analysisRunsState = atomWithStorage<Record<string, AnalysisRun>>(
  'analysis-runs',
  {},
  createAnalysisTypedStorage<Record<string, AnalysisRun>>(),
);

export const analysisResultsState = atom<Record<string, unknown> | null>(null);

export const analysisErrorState = atom<string | null>(null);

export const isAnalysisLoadingState = atom<boolean>(false);
