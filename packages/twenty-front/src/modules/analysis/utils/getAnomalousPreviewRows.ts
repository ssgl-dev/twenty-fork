import { type AnalysisFile } from '@/analysis/types/analysis.types';

export type AnomalousPreviewRow = {
  rowIndex: number;
  score: number;
  contributingFeatures: Record<string, number>;
};

const isNumericValue = (
  value: string | number | boolean | null | undefined,
): value is number => typeof value === 'number';

const getNumericColumnValues = (
  file: AnalysisFile,
  columnName: string,
): number[] =>
  file.previewRows
    .map((row) => row[columnName])
    .filter(isNumericValue);

const getColumnStats = (values: number[]) => {
  if (values.length === 0) return null;

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  const std = Math.sqrt(variance);

  return { mean, std };
};

const getContributionScore = (value: number, mean: number, std: number) =>
  std > 0 ? (value - mean) / std : 0;

// Flags preview rows where a numeric value deviates by more than
// 2 standard deviations from its column mean. Mimics what the
// isolation forest service would surface as outliers.
export const getAnomalousPreviewRows = (
  file: AnalysisFile,
): AnomalousPreviewRow[] => {
  const numericColumns = file.columns.filter((column) =>
    column.dtype.startsWith('int') || column.dtype.startsWith('float'),
  );

  return file.previewRows
    .map((row, rowIndex) => {
      const contributingFeatures: Record<string, number> = {};
      let maxAbsScore = 0;

      for (const column of numericColumns) {
        const value = row[column.name];

        if (!isNumericValue(value)) continue;

        const stats = getColumnStats(getNumericColumnValues(file, column.name));

        if (!stats) continue;

        const score = getContributionScore(value, stats.mean, stats.std);

        if (Math.abs(score) > 2) {
          contributingFeatures[column.name] = Number(score.toFixed(2));
          maxAbsScore = Math.max(maxAbsScore, Math.abs(score));
        }
      }

      return { rowIndex, maxAbsScore, contributingFeatures };
    })
    .filter((item) => item.maxAbsScore > 0)
    .map(({ rowIndex, maxAbsScore, contributingFeatures }) => ({
      rowIndex,
      score: Number((1 - 1 / (1 + maxAbsScore)).toFixed(4)),
      contributingFeatures,
    }));
};
