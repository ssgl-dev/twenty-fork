export type AnalysisType = 'descriptive' | 'isolation_forest' | 'classification';

export type AnalysisStatus = 'pending' | 'running' | 'completed' | 'failed';

export type Analysis = {
  id: string;
  name: string;
  csvFileId: string;
  analysisType: AnalysisType;
  targetColumn?: string | null;
  config?: Record<string, unknown> | null;
  status: AnalysisStatus;
  createdAt: string;
  updatedAt: string;
};

export type AnalysisRun = {
  id: string;
  analysisId: string;
  status: AnalysisStatus;
  startedAt: string;
  completedAt?: string | null;
  result?: Record<string, unknown> | null;
  errorMessage?: string | null;
};

export type AnalysisFileColumn = {
  name: string;
  dtype: string;
  description: string;
  count: number;
  missing: number;
  unique: number;
};

export type AnalysisPreviewRow = Record<string, string | number | boolean | null>;

export type AnalysisFile = {
  id: string;
  name: string;
  url: string;
  size: number;
  uploadedAt: string;
  rowCount: number;
  columns: AnalysisFileColumn[];
  previewRows: AnalysisPreviewRow[];
};

export type ColumnStat = {
  column: string;
  dtype: string;
  count: number;
  missing: number;
  unique: number;
  mean?: number | null;
  median?: number | null;
  std?: number | null;
  min?: number | null;
  max?: number | null;
  q25?: number | null;
  q75?: number | null;
};

export type CorrelationItem = {
  columnA: string;
  columnB: string;
  correlation: number;
};

export type DescriptiveResult = {
  columnStats: ColumnStat[];
  correlationMatrix: CorrelationItem[];
};

export type AnomalyItem = {
  rowIndex: number;
  score: number;
  isAnomaly: boolean;
  contributingFeatures: Record<string, number>;
};

export type IsolationForestResult = {
  anomalies: AnomalyItem[];
  totalRows: number;
  anomalyCount: number;
  contamination: number;
  featureImportance: Record<string, number>;
};

export type ClassificationResult = {
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  confusionMatrix: number[][];
  featureImportance: Record<string, number>;
  algorithm: string;
  targetColumn: string;
};
