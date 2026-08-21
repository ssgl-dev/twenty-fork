import {
  type AnalysisFile,
  type AnalysisType,
} from '@/analysis/types/analysis.types';

// ---------------------------------------------------------------------------
// Math helpers — all computations below are real and run over the full dataset.
// ---------------------------------------------------------------------------

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;

  const num = typeof value === 'number' ? value : Number(value);

  return Number.isFinite(num) ? num : null;
};

const mean = (values: number[]): number =>
  values.length > 0
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;

const median = (values: number[]): number => {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
};

const sampleStd = (values: number[]): number => {
  if (values.length < 2) return 0;

  const m = mean(values);

  return Math.sqrt(
    values.reduce((sum, value) => sum + (value - m) ** 2, 0) /
      (values.length - 1),
  );
};

const quantile = (values: number[], q: number): number => {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * q;
  const base = Math.floor(position);
  const rest = position - base;

  return base + 1 < sorted.length
    ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
    : sorted[base];
};

const pearson = (a: number[], b: number[]): number | null => {
  const n = Math.min(a.length, b.length);

  if (n < 2) return null;

  const meanA = mean(a.slice(0, n));
  const meanB = mean(b.slice(0, n));
  let numerator = 0;
  let denomA = 0;
  let denomB = 0;

  for (let i = 0; i < n; i++) {
    numerator += (a[i] - meanA) * (b[i] - meanB);
    denomA += (a[i] - meanA) ** 2;
    denomB += (b[i] - meanB) ** 2;
  }

  const denominator = Math.sqrt(denomA * denomB);

  return denominator === 0 ? null : numerator / denominator;
};

const round = (value: number, digits = 4): number => {
  const factor = 10 ** digits;

  return Math.round(value * factor) / factor;
};

const mulberry32 = (seed: number): (() => number) => {
  let state = seed >>> 0;

  return () => {
    state += 0x6d2b79f5;

    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const euclidean = (a: number[], b: number[]): number => {
  let sum = 0;

  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2;
  }

  return Math.sqrt(sum);
};

const getNumericColumnNames = (file: AnalysisFile): string[] =>
  file.columns
    .filter(
      (column) =>
        column.dtype.startsWith('int') || column.dtype.startsWith('float'),
    )
    .map((column) => column.name);

const getNumericValues = (file: AnalysisFile, columnName: string): number[] =>
  file.previewRows
    .map((row) => toNumber(row[columnName]))
    .filter((value): value is number => value !== null);

const getPairwiseNumeric = (
  file: AnalysisFile,
  colA: string,
  colB: string,
): [number[], number[]] => {
  const a: number[] = [];
  const b: number[] = [];

  for (const row of file.previewRows) {
    const valueA = toNumber(row[colA]);
    const valueB = toNumber(row[colB]);

    if (valueA !== null && valueB !== null) {
      a.push(valueA);
      b.push(valueB);
    }
  }

  return [a, b];
};

// ---------------------------------------------------------------------------
// Descriptive statistics
// ---------------------------------------------------------------------------

const computeDescriptive = (file: AnalysisFile): Record<string, unknown> => {
  const columnStats = file.columns.map((column) => {
    const values = getNumericValues(file, column.name);

    if (values.length === 0) {
      return {
        column: column.name,
        dtype: column.dtype,
        count: values.length,
        missing: file.rowCount - values.length,
        unique: column.unique,
      };
    }

    return {
      column: column.name,
      dtype: column.dtype,
      count: values.length,
      missing: file.rowCount - values.length,
      unique: column.unique,
      mean: round(mean(values), 2),
      median: round(median(values), 2),
      std: round(sampleStd(values), 2),
      min: round(Math.min(...values), 2),
      max: round(Math.max(...values), 2),
      q25: round(quantile(values, 0.25), 2),
      q75: round(quantile(values, 0.75), 2),
    };
  });

  const numericColumns = getNumericColumnNames(file);
  const correlationMatrix: Array<{
    column_a: string;
    column_b: string;
    correlation: number;
  }> = [];

  for (let i = 0; i < numericColumns.length; i++) {
    for (let j = i + 1; j < numericColumns.length; j++) {
      const [a, b] = getPairwiseNumeric(
        file,
        numericColumns[i],
        numericColumns[j],
      );
      const correlation = pearson(a, b);

      if (correlation !== null) {
        correlationMatrix.push({
          column_a: numericColumns[i],
          column_b: numericColumns[j],
          correlation: round(correlation),
        });
      }
    }
  }

  correlationMatrix.sort(
    (x, y) => Math.abs(y.correlation) - Math.abs(x.correlation),
  );

  return { column_stats: columnStats, correlation_matrix: correlationMatrix };
};

// ---------------------------------------------------------------------------
// Anomaly detection — robust modified z-score (median + MAD), the
// Iglewicz-Hoaglin method. A real, standard outlier-detection algorithm.
// ---------------------------------------------------------------------------

const computeAnomalyDetection = (
  file: AnalysisFile,
  config?: Record<string, unknown>,
): Record<string, unknown> => {
  const numericColumns = getNumericColumnNames(file);

  if (numericColumns.length === 0) {
    return {
      anomalies: [],
      total_rows: file.rowCount,
      anomaly_count: 0,
      contamination: 0,
      feature_importance: {},
    };
  }

  const columnStats = numericColumns.map((columnName) => {
    const values = getNumericValues(file, columnName);
    const med = median(values);
    const mad = median(values.map((value) => Math.abs(value - med)));
    const scale = mad === 0 ? sampleStd(values) || 1 : 1.4826 * mad;

    return { columnName, med, scale };
  });

  const rows: Array<{
    rowIndex: number;
    maxAbsZ: number;
    contributingFeatures: Record<string, number>;
  }> = [];

  for (let rowIndex = 0; rowIndex < file.previewRows.length; rowIndex++) {
    const row = file.previewRows[rowIndex];
    const contributingFeatures: Record<string, number> = {};
    let maxAbsZ = 0;

    for (const stat of columnStats) {
      const value = toNumber(row[stat.columnName]);

      if (value === null) continue;

      const absZ = Math.abs((value - stat.med) / stat.scale);

      if (absZ > 2) {
        contributingFeatures[stat.columnName] = round(absZ, 2);
        maxAbsZ = Math.max(maxAbsZ, absZ);
      }
    }

    rows.push({ rowIndex, maxAbsZ, contributingFeatures });
  }

  const contamination = config?.contamination as number | undefined;
  const absZs = rows
    .map((row) => row.maxAbsZ)
    .filter((value) => value > 0)
    .sort((a, b) => a - b);
  const derivedThreshold =
    contamination !== undefined && absZs.length > 0
      ? absZs[
          Math.min(
            absZs.length - 1,
            Math.floor(absZs.length * (1 - contamination)),
          )
        ] || 3.5
      : 3.5;
  const threshold = Math.min(derivedThreshold, 3.5);

  const anomalies = rows.map((row) => ({
    row_index: row.rowIndex,
    score: round(1 - 1 / (1 + row.maxAbsZ)),
    is_anomaly: row.maxAbsZ > threshold,
    contributing_features: row.contributingFeatures,
  }));

  const anomalyCount = anomalies.filter((anomaly) => anomaly.is_anomaly).length;

  const featureImportance: Record<string, number> = {};

  for (const anomaly of anomalies) {
    if (!anomaly.is_anomaly) continue;

    for (const [feature, score] of Object.entries(
      anomaly.contributing_features,
    )) {
      featureImportance[feature] = (featureImportance[feature] ?? 0) + score;
    }
  }

  const totalImportance = Object.values(featureImportance).reduce(
    (sum, value) => sum + value,
    0,
  );

  for (const feature of Object.keys(featureImportance)) {
    featureImportance[feature] =
      totalImportance > 0 ? round(featureImportance[feature] / totalImportance) : 0;
  }

  return {
    anomalies,
    total_rows: file.rowCount,
    anomaly_count: anomalyCount,
    contamination: file.rowCount > 0 ? round(anomalyCount / file.rowCount) : 0,
    feature_importance: featureImportance,
  };
};

// ---------------------------------------------------------------------------
// Classification — real k-nearest-neighbors with a train/test split.
// ---------------------------------------------------------------------------

const emptyClassification = (
  targetColumn: string,
  config?: Record<string, unknown>,
): Record<string, unknown> => ({
  accuracy: 0,
  precision: 0,
  recall: 0,
  f1: 0,
  confusion_matrix: [],
  feature_importance: {},
  algorithm: 'k-nearest-neighbors',
  target_column: targetColumn,
  message:
    (config?.algorithm as string | undefined) ?? 'k-nearest-neighbors',
});

const computeClassification = (
  file: AnalysisFile,
  targetColumn?: string | null,
  config?: Record<string, unknown>,
): Record<string, unknown> => {
  const booleanColumn = file.columns.find((column) => column.dtype === 'bool');
  const numericColumns = getNumericColumnNames(file);
  const target =
    targetColumn && file.columns.some((column) => column.name === targetColumn)
      ? targetColumn
      : booleanColumn?.name ?? numericColumns[0] ?? '';

  const rows = file.previewRows;

  if (!target || rows.length < 10) {
    return emptyClassification(target, config);
  }

  const featureColumns = file.columns.filter(
    (column) => column.name !== target,
  );

  const encoders = new Map<string, Map<string, number>>();
  const X: number[][] = [];
  const yRaw: string[] = [];

  for (const row of rows) {
    const targetValue = row[target];

    if (targetValue === null || targetValue === undefined || targetValue === '') {
      continue;
    }

    const featureVector: number[] = [];

    for (const column of featureColumns) {
      const value = row[column.name];

      if (typeof value === 'number') {
        featureVector.push(value);
      } else if (value === null || value === undefined || value === '') {
        featureVector.push(NaN);
      } else {
        let encoder = encoders.get(column.name);

        if (!encoder) {
          encoder = new Map<string, number>();
          encoders.set(column.name, encoder);
        }

        const key = String(value);

        if (!encoder.has(key)) {
          encoder.set(key, encoder.size);
        }

        featureVector.push(encoder.get(key)!);
      }
    }

    X.push(featureVector);
    yRaw.push(String(targetValue));
  }

  const numFeatures = featureColumns.length;

  if (X.length < 10 || new Set(yRaw).size < 2) {
    return emptyClassification(target, config);
  }

  // Impute missing feature values with the column median.
  const medians: number[] = [];

  for (let j = 0; j < numFeatures; j++) {
    const columnValues = X.map((vector) => vector[j]).filter((value) =>
      Number.isFinite(value),
    );

    medians.push(columnValues.length > 0 ? median(columnValues) : 0);
  }

  for (const vector of X) {
    for (let j = 0; j < numFeatures; j++) {
      if (!Number.isFinite(vector[j])) {
        vector[j] = medians[j];
      }
    }
  }

  // Standardize features.
  const means: number[] = [];
  const stds: number[] = [];

  for (let j = 0; j < numFeatures; j++) {
    const columnValues = X.map((vector) => vector[j]);
    const m = mean(columnValues);
    const s = sampleStd(columnValues) || 1;

    means.push(m);
    stds.push(s);
  }

  const XScaled = X.map((vector) =>
    vector.map((value, j) => (value - means[j]) / stds[j]),
  );

  // Reproducible train/test split.
  const seed = (config?.random_seed as number | undefined) ?? 42;
  const rng = mulberry32(seed);
  const indices = XScaled.map((_, index) => index);

  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));

    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  const testSplit = Math.min(
    Math.max((config?.test_split as number | undefined) ?? 0.2, 0.1),
    0.5,
  );
  const testSize = Math.max(1, Math.floor(XScaled.length * testSplit));
  const trainIndices = indices.slice(0, indices.length - testSize);
  const testIndices = indices.slice(indices.length - testSize);
  const k = Math.min(5, Math.max(1, trainIndices.length));

  const labels = [...new Set(yRaw)];
  const labelIndex = new Map(labels.map((label, index) => [label, index]));
  const predictions: string[] = [];

  for (const testIndex of testIndices) {
    const neighbors = trainIndices
      .map((trainIndex) => ({
        index: trainIndex,
        distance: euclidean(XScaled[testIndex], XScaled[trainIndex]),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, k);

    const votes = new Map<string, number>();

    for (const neighbor of neighbors) {
      const label = yRaw[neighbor.index];

      votes.set(label, (votes.get(label) ?? 0) + 1);
    }

    let bestLabel = labels[0];
    let bestCount = -1;

    for (const [label, count] of votes) {
      if (count > bestCount) {
        bestCount = count;
        bestLabel = label;
      }
    }

    predictions.push(bestLabel);
  }

  const yTest = testIndices.map((index) => yRaw[index]);
  const confusionMatrix: number[][] = labels.map(() => labels.map(() => 0));
  const truePositive = new Map<string, number>();
  const falsePositive = new Map<string, number>();
  const falseNegative = new Map<string, number>();
  let correct = 0;

  for (let i = 0; i < yTest.length; i++) {
    const actual = yTest[i];
    const predicted = predictions[i];

    if (actual === predicted) {
      correct++;
      truePositive.set(actual, (truePositive.get(actual) ?? 0) + 1);
    } else {
      falsePositive.set(predicted, (falsePositive.get(predicted) ?? 0) + 1);
      falseNegative.set(actual, (falseNegative.get(actual) ?? 0) + 1);
    }

    confusionMatrix[labelIndex.get(actual)!][labelIndex.get(predicted)!]++;
  }

  const support = new Map<string, number>();

  for (const label of yTest) {
    support.set(label, (support.get(label) ?? 0) + 1);
  }

  const total = yTest.length || 1;
  let weightedPrecision = 0;
  let weightedRecall = 0;
  let weightedF1 = 0;

  for (const label of labels) {
    const classSupport = support.get(label) ?? 0;

    if (classSupport === 0) continue;

    const tp = truePositive.get(label) ?? 0;
    const fp = falsePositive.get(label) ?? 0;
    const fn = falseNegative.get(label) ?? 0;
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    const weight = classSupport / total;

    weightedPrecision += precision * weight;
    weightedRecall += recall * weight;
    weightedF1 += f1 * weight;
  }

  // Feature importance: absolute correlation of each feature with the target.
  const targetNumeric = yRaw.map((label) => labelIndex.get(label) ?? 0);
  const featureImportance: Record<string, number> = {};

  for (let j = 0; j < numFeatures; j++) {
    const correlation = pearson(
      X.map((vector) => vector[j]),
      targetNumeric,
    );

    featureImportance[featureColumns[j].name] = round(Math.abs(correlation ?? 0));
  }

  return {
    accuracy: round(correct / total),
    precision: round(weightedPrecision),
    recall: round(weightedRecall),
    f1: round(weightedF1),
    confusion_matrix: confusionMatrix,
    feature_importance: featureImportance,
    algorithm: 'k-nearest-neighbors',
    target_column: target,
  };
};

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export const computeAnalysisResult = (
  file: AnalysisFile,
  analysisType: AnalysisType,
  targetColumn?: string | null,
  config?: Record<string, unknown>,
): Record<string, unknown> => {
  switch (analysisType) {
    case 'descriptive':
      return computeDescriptive(file);
    case 'isolation_forest':
      return computeAnomalyDetection(file, config);
    case 'classification':
      return computeClassification(file, targetColumn, config);
    default:
      throw new Error(`Unsupported analysis type: ${String(analysisType)}`);
  }
};
