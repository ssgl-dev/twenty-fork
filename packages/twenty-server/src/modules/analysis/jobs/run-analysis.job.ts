import { Scope } from '@nestjs/common';

import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { AnalysisService } from 'src/modules/analysis/analysis.service';

export type RunAnalysisJobData = {
  analysisId: string;
  workspaceId: string;
};

@Processor({
  queueName: MessageQueue.messagingQueue,
  scope: Scope.REQUEST,
})
export class RunAnalysisJob {
  constructor(private readonly analysisService: AnalysisService) {}

  @Process(RunAnalysisJob.name)
  async handle(data: RunAnalysisJobData): Promise<void> {
    await this.analysisService.runAnalysis(data.analysisId);
  }
}
