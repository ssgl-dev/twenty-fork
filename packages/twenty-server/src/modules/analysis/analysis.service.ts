import { Injectable, Logger } from '@nestjs/common';

import { AnalysisClientService } from 'src/modules/analysis/analysis-client/analysis-client.service';
import { type CreateAnalysisInput } from 'src/modules/analysis/dtos/create-analysis-input.dto';

export type AnalysisEntity = {
  id: string;
  name: string;
  csvFileId: string;
  analysisType: string;
  targetColumn?: string | null;
  config: Record<string, unknown>;
  status: string;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  // In-memory store for demo purposes.
  // In production, this would use TypeORM/Workspace repositories.
  private analyses: Map<string, AnalysisEntity> = new Map();
  private runs: Map<string, unknown> = new Map();

  constructor(
    private readonly analysisClientService: AnalysisClientService,
  ) {}

  async createAnalysis(
    input: CreateAnalysisInput,
    workspaceId: string,
  ): Promise<AnalysisEntity> {
    const id = crypto.randomUUID();

    const analysis: AnalysisEntity = {
      id,
      name: input.name,
      csvFileId: input.csvFileId,
      analysisType: input.analysisType,
      targetColumn: input.targetColumn ?? null,
      config: input.config ?? {},
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.analyses.set(id, analysis);
    this.logger.log(`Created analysis ${id} in workspace ${workspaceId}`);

    return analysis;
  }

  async runAnalysis(analysisId: string): Promise<unknown> {
    const analysis = this.analyses.get(analysisId);

    if (!analysis) {
      throw new Error(`Analysis ${analysisId} not found`);
    }

    analysis.status = 'running';
    this.analyses.set(analysisId, analysis);

    const runId = crypto.randomUUID();

    this.logger.log(`Starting analysis run ${runId} for analysis ${analysisId}`);

    try {
      // In a real implementation, the CSV would be read from storage
      // and parsed into a 2D array here. For now we use demo data.
      const demoData = this._getDemoData(analysis.analysisType);
      const demoColumns = this._getDemoColumns(analysis.analysisType);

      const result = await this.analysisClientService.runAnalysis(
        analysis.analysisType,
        demoData,
        demoColumns,
        analysis.targetColumn,
        analysis.config as Record<string, unknown>,
      );

      analysis.status = result.status === 'failed' ? 'failed' : 'completed';
      this.analyses.set(analysisId, analysis);

      this.runs.set(runId, {
        id: runId,
        analysisId,
        status: result.status,
        result: result.result ?? null,
        errorMessage: result.error_message ?? null,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      });

      return this.runs.get(runId);
    } catch (error) {
      analysis.status = 'failed';
      this.analyses.set(analysisId, analysis);

      this.runs.set(runId, {
        id: runId,
        analysisId,
        status: 'failed',
        result: null,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      });

      throw error;
    }
  }

  async getAnalysis(id: string): Promise<AnalysisEntity | null> {
    return this.analyses.get(id) ?? null;
  }

  async getAnalyses(): Promise<AnalysisEntity[]> {
    return Array.from(this.analyses.values());
  }

  async getAnalysisRun(runId: string): Promise<unknown | null> {
    return this.runs.get(runId) ?? null;
  }

  async deleteAnalysis(id: string): Promise<boolean> {
    return this.analyses.delete(id);
  }

  // Demo data helpers — in production, data would come from uploaded CSV files
  private _getDemoData(analysisType: string): unknown[][] {
    if (analysisType === 'classification') {
      return [
        [5.1, 3.5, 1.4, 0.2, 'setosa'],
        [4.9, 3.0, 1.4, 0.2, 'setosa'],
        [7.0, 3.2, 4.7, 1.4, 'versicolor'],
        [6.4, 3.2, 4.5, 1.5, 'versicolor'],
        [6.3, 3.3, 6.0, 2.5, 'virginica'],
        [5.8, 2.7, 5.1, 1.9, 'virginica'],
        [5.4, 3.9, 1.7, 0.4, 'setosa'],
        [6.9, 3.1, 4.9, 1.5, 'versicolor'],
        [7.1, 3.0, 5.9, 2.1, 'virginica'],
        [5.0, 3.4, 1.5, 0.2, 'setosa'],
        [6.5, 2.8, 4.6, 1.5, 'versicolor'],
        [6.7, 3.1, 5.6, 2.4, 'virginica'],
        [4.8, 3.1, 1.6, 0.2, 'setosa'],
        [6.0, 2.9, 4.5, 1.5, 'versicolor'],
        [6.5, 3.0, 5.8, 2.2, 'virginica'],
        [5.2, 3.4, 1.4, 0.2, 'setosa'],
        [5.9, 3.0, 4.2, 1.5, 'versicolor'],
        [7.7, 3.0, 6.1, 2.3, 'virginica'],
      ];
    }

    // Default numeric data for isolation_forest and descriptive
    return [
      [100, 25, 1.2],
      [102, 27, 1.1],
      [98, 23, 1.3],
      [105, 26, 1.15],
      [250, 60, 3.5], // anomaly
      [101, 25, 1.25],
      [99, 24, 1.2],
      [103, 26, 1.18],
      [5, 3, 0.1], // anomaly
      [104, 28, 1.22],
      [101, 25, 1.19],
      [100, 26, 1.21],
    ];
  }

  private _getDemoColumns(analysisType: string): string[] {
    if (analysisType === 'classification') {
      return [
        'sepal_length',
        'sepal_width',
        'petal_length',
        'petal_width',
        'species',
      ];
    }

    return ['value_x', 'value_y', 'ratio'];
  }
}
