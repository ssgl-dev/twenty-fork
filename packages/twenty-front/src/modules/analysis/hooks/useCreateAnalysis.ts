import { useCallback } from 'react';
import { useSetAtom } from 'jotai';

import { type Analysis } from '@/analysis/types/analysis.types';
import { analysesState } from '@/analysis/states/analysisState';

// GraphQL mutation placeholder — replace with generated hook after codegen
type CreateAnalysisInput = {
  name: string;
  csvFileId: string;
  analysisType: string;
  targetColumn?: string;
  config?: Record<string, unknown>;
};

export const useCreateAnalysis = () => {
  const setAnalyses = useSetAtom(analysesState);

  const createAnalysis = useCallback(
    async (input: CreateAnalysisInput): Promise<Analysis> => {
      // In production, this would call the GraphQL mutation via Apollo:
      // const [mutate] = useCreateAnalysisMutation();
      // const result = await mutate({ variables: { input } });

      const mockAnalysis: Analysis = {
        id: crypto.randomUUID(),
        name: input.name,
        csvFileId: input.csvFileId,
        analysisType: input.analysisType as Analysis['analysisType'],
        targetColumn: input.targetColumn ?? null,
        config: input.config ?? {},
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setAnalyses((prev) => [...prev, mockAnalysis]);

      return mockAnalysis;
    },
    [setAnalyses],
  );

  return { createAnalysis };
};
