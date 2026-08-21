import { Injectable, Logger } from '@nestjs/common';
import { type AxiosInstance } from 'axios';

import { SecureHttpClientService } from 'src/engine/core-modules/secure-http-client/secure-http-client.service';

export type AnalysisResult = {
  run_id: string;
  status: string;
  result?: Record<string, unknown>;
  error_message?: string;
};

@Injectable()
export class AnalysisClientService {
  private readonly logger = new Logger(AnalysisClientService.name);
  private readonly httpService: AxiosInstance;

  constructor(
    private readonly secureHttpClientService: SecureHttpClientService,
  ) {
    this.httpService = this.secureHttpClientService.getHttpClient({
      baseURL: process.env.ANALYSIS_SERVICE_URL ?? 'http://localhost:8000',
      timeout: 5 * 60 * 1000, // 5 minutes
    });
  }

  async runAnalysis(
    analysisType: string,
    data: unknown[][],
    columns: string[],
    targetColumn?: string | null,
    config?: Record<string, unknown>,
  ): Promise<AnalysisResult> {
    this.logger.log(
      `Running ${analysisType} analysis with ${data.length} rows and ${columns.length} columns`,
    );

    try {
      const response = await this.httpService.post<AnalysisResult>(
        '/analyze',
        {
          analysis_type: analysisType,
          data,
          columns,
          target_column: targetColumn ?? undefined,
          config: config ?? {},
        },
      );

      return response.data;
    } catch (error) {
      this.logger.error(
        `Analysis service request failed: ${error}`,
      );
      throw new Error(
        `Failed to run analysis: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.httpService.get('/health');
      return response.data?.status === 'ok';
    } catch {
      return false;
    }
  }
}
