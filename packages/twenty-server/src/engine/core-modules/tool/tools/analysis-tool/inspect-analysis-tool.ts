import { Injectable } from '@nestjs/common';

import { z } from 'zod';

import { FileFolder } from 'twenty-shared/types';

import { FileService } from 'src/engine/core-modules/file/services/file.service';
import { type ToolInput } from 'src/engine/core-modules/tool/types/tool-input.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type ToolExecutionContext } from 'src/engine/core-modules/tool/types/tool-execution-context.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';

const PREVIEW_MAX_ROWS = 20;

const InspectAnalysisInputSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('listAnalyses'),
  }),
  z.object({
    action: z.literal('getAnalysis'),
    analysisId: z.string(),
  }),
  z.object({
    action: z.literal('getDatasetInfo'),
    datasetId: z.string(),
  }),
  z.object({
    action: z.literal('readDataset'),
    datasetId: z.string(),
  }),
]);

type InspectAnalysisInput = z.infer<typeof InspectAnalysisInputSchema>;

type DatasetReference = {
  datasetId: string | null;
  datasetFilename: string | null;
};

@Injectable()
export class InspectAnalysisTool implements Tool {
  description = `Inspect the analyses and datasets of the current workspace (read-only).
    Use listAnalyses to list all analyses with their type, status and the dataset (CSV file) they reference.
    Use getAnalysis to fetch a full analysis record including its configuration and computed result.
    Use getDatasetInfo to get metadata about a dataset file by id (datasetId).
    Use readDataset to read the actual CSV content of a dataset (headers, row count and a preview of the first rows).
    Datasets are regular workspace files: to run Python on a dataset, call the code interpreter tool with
    files: [{ "fileId": <datasetId>, "filename": <datasetFilename> }] — the file will be available at /home/user/<datasetFilename>.
    This tool never runs, edits or deletes anything — use it to understand what analyses exist and what they found.`;

  inputSchema = InspectAnalysisInputSchema;

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly fileService: FileService,
  ) {}

  async execute(
    parameters: ToolInput,
    context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const parseResult = InspectAnalysisInputSchema.safeParse(parameters);

    if (!parseResult.success) {
      return {
        success: false,
        message: 'Invalid analysis inspection input',
        error: parseResult.error.message,
      };
    }

    const input: InspectAnalysisInput = parseResult.data;

    try {
      switch (input.action) {
        case 'listAnalyses':
          return await this.listAnalyses(context.workspaceId);
        case 'getAnalysis':
          return await this.getAnalysis(context.workspaceId, input.analysisId);
        case 'getDatasetInfo':
          return await this.getDatasetInfo(
            context.workspaceId,
            input.datasetId,
          );
        case 'readDataset':
          return await this.readDataset(context.workspaceId, input.datasetId);
      }
    } catch (error) {
      return {
        success: false,
        message: 'Failed to inspect analyses',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async listAnalyses(workspaceId: string): Promise<ToolOutput> {
    const repository =
      await this.globalWorkspaceOrmManager.getRepository<Record<string, unknown>>(
        workspaceId,
        'analysis',
      );

    const analyses = await repository.find();

    if (analyses.length === 0) {
      return {
        success: true,
        message: 'No analyses found in this workspace yet.',
        result: { analyses: [] },
      };
    }

    const summary = [];

    for (const analysis of analyses) {
      const dataset = await this.resolveDatasetReference(
        workspaceId,
        analysis,
      );

      summary.push({
        id: analysis.id,
        name: analysis.name ?? null,
        analysisType: analysis.analysisType ?? null,
        status: analysis.status ?? null,
        targetColumn: analysis.targetColumn ?? null,
        datasetId: dataset.datasetId,
        datasetFilename: dataset.datasetFilename,
        hasResult: analysis.result != null,
        createdAt: analysis.createdAt ?? null,
        updatedAt: analysis.updatedAt ?? null,
      });
    }

    return {
      success: true,
      message: `Found ${analyses.length} analysis(ies) in this workspace.`,
      result: { analyses: summary },
    };
  }

  private async getAnalysis(
    workspaceId: string,
    analysisId: string,
  ): Promise<ToolOutput> {
    const repository =
      await this.globalWorkspaceOrmManager.getRepository<Record<string, unknown>>(
        workspaceId,
        'analysis',
      );

    const analysis = await repository.findOneBy({ id: analysisId });

    if (!analysis) {
      return {
        success: false,
        message: `Analysis "${analysisId}" was not found in this workspace.`,
        error: 'Analysis not found',
      };
    }

    const dataset = await this.resolveDatasetReference(workspaceId, analysis);

    return {
      success: true,
      message: `Analysis "${analysisId}" retrieved.`,
      result: {
        id: analysis.id,
        name: analysis.name ?? null,
        analysisType: analysis.analysisType ?? null,
        targetColumn: analysis.targetColumn ?? null,
        config: analysis.config ?? null,
        status: analysis.status ?? null,
        result: analysis.result ?? null,
        datasetId: dataset.datasetId,
        datasetFilename: dataset.datasetFilename,
        createdAt: analysis.createdAt ?? null,
        updatedAt: analysis.updatedAt ?? null,
      },
    };
  }

  private async getDatasetInfo(
    workspaceId: string,
    datasetId: string,
  ): Promise<ToolOutput> {
    const fileContent = await this.readFileContent(workspaceId, datasetId);

    if (!fileContent) {
      return {
        success: false,
        message:
          `No dataset with id "${datasetId}" was found in this workspace. ` +
          'Use listAnalyses to get a valid datasetId.',
        error: 'Dataset not found',
      };
    }

    return {
      success: true,
      message: `Dataset "${datasetId}" found.`,
      result: {
        datasetId,
        filename: `${datasetId}.csv`,
        mimeType: fileContent.mimeType,
        sizeBytes: fileContent.buffer.length,
      },
    };
  }

  private async readDataset(
    workspaceId: string,
    datasetId: string,
  ): Promise<ToolOutput> {
    const fileContent = await this.readFileContent(workspaceId, datasetId);

    if (!fileContent) {
      return {
        success: false,
        message:
          `No dataset with id "${datasetId}" was found in this workspace. ` +
          'Use listAnalyses to get a valid datasetId.',
        error: 'Dataset not found',
      };
    }

    const parsed = this.parseCsvPreview(fileContent.buffer);

    return {
      success: true,
      message: `Read dataset "${datasetId}": ${parsed.rowCount} rows, ${parsed.columnNames.length} columns.`,
      result: {
        datasetId,
        filename: `${datasetId}.csv`,
        rowCount: parsed.rowCount,
        columnNames: parsed.columnNames,
        preview: parsed.preview,
      },
    };
  }

  // Resolves the dataset (CSV file) referenced by an analysis: either the
  // analysis.csvFileId is set, or an attachment record points at the file.
  private async resolveDatasetReference(
    workspaceId: string,
    analysis: Record<string, unknown>,
  ): Promise<DatasetReference> {
    const csvFileId = analysis.csvFileId;

    if (typeof csvFileId === 'string' && csvFileId.length > 0) {
      return { datasetId: csvFileId, datasetFilename: `${csvFileId}.csv` };
    }

    const analysisId = analysis.id;

    if (typeof analysisId !== 'string') {
      return { datasetId: null, datasetFilename: null };
    }

    const attachmentRepository =
      await this.globalWorkspaceOrmManager.getRepository<Record<string, unknown>>(
        workspaceId,
        'attachment',
      );

    const attachments = await attachmentRepository.findBy({
      targetAnalysisId: analysisId,
    });

    const attachment = attachments.find(
      (item) => Array.isArray(item.file) && item.file.length > 0,
    );

    const attachmentFile = Array.isArray(attachment?.file)
      ? (attachment.file[0] as Record<string, unknown>)
      : undefined;

    const fileId =
      typeof attachmentFile?.fileId === 'string'
        ? attachmentFile.fileId
        : null;
    const filename =
      typeof attachmentFile?.label === 'string'
        ? attachmentFile.label
        : fileId
          ? `${fileId}.csv`
          : null;

    if (fileId) {
      return { datasetId: fileId, datasetFilename: filename };
    }

    return { datasetId: null, datasetFilename: null };
  }

  private async readFileContent(
    workspaceId: string,
    fileId: string,
  ): Promise<{ buffer: Buffer; mimeType: string } | null> {
    for (const fileFolder of [FileFolder.FilesField, FileFolder.AgentChat]) {
      const content = await this.fileService.getFileContentById({
        fileId,
        workspaceId,
        fileFolder,
      });

      if (content !== null) {
        return content;
      }
    }

    return null;
  }

  private parseCsvPreview(buffer: Buffer): {
    rowCount: number;
    columnNames: string[];
    preview: Array<Record<string, string>>;
  } {
    const text = buffer.toString('utf8');
    const lines = text.split(/\r?\n/);
    const header = lines[0] ? this.splitCsvLine(lines[0]) : [];
    const dataLines = lines.slice(1).filter((line) => line.trim() !== '');

    const preview = dataLines
      .slice(0, PREVIEW_MAX_ROWS)
      .map((line) => {
        const values = this.splitCsvLine(line);
        const row: Record<string, string> = {};

        header.forEach((column, index) => {
          row[column] = values[index] ?? '';
        });

        return row;
      });

    return {
      rowCount: dataLines.length,
      columnNames: header,
      preview,
    };
  }

  private splitCsvLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let index = 0; index < line.length; index++) {
      const char = line[index];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current);

    return values.map((value) => value.trim());
  }
}
