import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';
import { AnalysisService } from 'src/modules/analysis/analysis.service';
import { AnalysisDTO, AnalysisRunDTO } from 'src/modules/analysis/dtos/analysis-result.dto';
import { CreateAnalysisInput } from 'src/modules/analysis/dtos/create-analysis-input.dto';

@Resolver(() => AnalysisDTO)
export class AnalysisResolver {
  constructor(private readonly analysisService: AnalysisService) {}

  @Query(() => [AnalysisDTO])
  @UseGuards(WorkspaceAuthGuard)
  async analyses(): Promise<AnalysisDTO[]> {
    const analyses = await this.analysisService.getAnalyses();
    return analyses;
  }

  @Query(() => AnalysisDTO, { nullable: true })
  @UseGuards(WorkspaceAuthGuard)
  async analysis(
    @Args('id', { type: () => String }) id: string,
  ): Promise<AnalysisDTO | null> {
    return this.analysisService.getAnalysis(id);
  }

  @Query(() => AnalysisRunDTO, { nullable: true })
  @UseGuards(WorkspaceAuthGuard)
  async analysisRun(
    @Args('id', { type: () => String }) id: string,
  ): Promise<AnalysisRunDTO | null> {
    const run = await this.analysisService.getAnalysisRun(id);
    return run as AnalysisRunDTO | null;
  }

  @Mutation(() => AnalysisDTO)
  @UseGuards(WorkspaceAuthGuard)
  async createAnalysis(
    @Args('input') input: CreateAnalysisInput,
  ): Promise<AnalysisDTO> {
    return this.analysisService.createAnalysis(input, 'default-workspace');
  }

  @Mutation(() => AnalysisRunDTO)
  @UseGuards(WorkspaceAuthGuard)
  async runAnalysis(
    @Args('analysisId', { type: () => String }) analysisId: string,
  ): Promise<AnalysisRunDTO> {
    const result = await this.analysisService.runAnalysis(analysisId);
    return result as AnalysisRunDTO;
  }

  @Mutation(() => Boolean)
  @UseGuards(WorkspaceAuthGuard)
  async deleteAnalysis(
    @Args('id', { type: () => String }) id: string,
  ): Promise<boolean> {
    return this.analysisService.deleteAnalysis(id);
  }
}
