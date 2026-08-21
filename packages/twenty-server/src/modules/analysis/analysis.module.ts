import { Module } from '@nestjs/common';

import { HttpModule } from '@nestjs/axios';

import { SecureHttpClientModule } from 'src/engine/core-modules/secure-http-client/secure-http-client.module';
import { AnalysisResolver } from 'src/modules/analysis/analysis.resolver';
import { AnalysisService } from 'src/modules/analysis/analysis.service';
import { AnalysisClientService } from 'src/modules/analysis/analysis-client/analysis-client.service';
import { RunAnalysisJob } from 'src/modules/analysis/jobs/run-analysis.job';

@Module({
  imports: [HttpModule, SecureHttpClientModule],
  providers: [AnalysisResolver, AnalysisService, AnalysisClientService, RunAnalysisJob],
  exports: [AnalysisService],
})
export class AnalysisModule {}
