import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { useAtomValue, useSetAtom } from 'jotai';
import { useState } from 'react';
import { ProgressBar } from 'twenty-ui/feedback';
import { themeCssVariables as tcv } from 'twenty-ui/theme-constants';
import { IconFileUpload, IconSparkles, IconX, IconPlus } from 'twenty-ui/icon';
import { Button } from 'twenty-ui/input';
import { CsvUploadStep } from '@/analysis/components/CsvUploadStep';
import { AnalysisConfigStep } from '@/analysis/components/AnalysisConfigStep';
import { useCreateAnalysis } from '@/analysis/hooks/useCreateAnalysis';
import {
  analysesState,
  analysisFilesState,
  analysisRunsState,
} from '@/analysis/states/analysisState';
import {
  type AnalysisFile,
  type AnalysisType,
  type AnalysisRun,
} from '@/analysis/types/analysis.types';
import { computeAnalysisResult } from '@/analysis/utils/computeAnalysisResult';

const RUN_STAGES = [
  'Reading dataset',
  'Computing statistics',
  'Detecting patterns & anomalies',
] as const;

const StyledOverlay = styled.div`
  background: rgba(0,0,0,0.3); inset: 0; position: fixed; z-index: 100;
`;
const StyledPanel = styled.div`
  background: ${tcv.background.primary}; border-left: 1px solid ${tcv.border.color.medium};
  bottom: 0; display: flex; flex-direction: column; overflow-y: auto;
  position: fixed; right: 0; top: 0; width: 460px; z-index: 101;
`;
const StyledHeader = styled.div`
  align-items: center; background: ${tcv.background.secondary};
  border-bottom: 1px solid ${tcv.border.color.medium}; display: flex;
  justify-content: space-between; min-height: 48px; padding: 0 ${tcv.spacing[3]};
`;
const StyledTitle = styled.span` font-size: ${tcv.font.size.md}; font-weight: ${tcv.font.weight.semiBold}; `;
const StyledCloseButton = styled.button`
  align-items: center; background: none; border: none; border-radius: ${tcv.border.radius.sm};
  color: ${tcv.font.color.tertiary}; cursor: pointer; display: flex; padding: 4px;
  &:hover { background: ${tcv.background.transparent.light}; color: ${tcv.font.color.primary}; }
`;
const StyledBody = styled.div` flex: 1; overflow-y: auto; padding: ${tcv.spacing[4]}; `;
const StyledSteps = styled.div` display: flex; gap: ${tcv.spacing[2]}; margin-bottom: ${tcv.spacing[4]}; `;
const StyledStep = styled.div<{ active: boolean; completed: boolean }>`
  align-items: center;
  background: ${({ active, completed }) => active || completed ? tcv.background.primary : tcv.background.tertiary};
  border: 1px solid ${({ active }) => active ? tcv.border.color.strong : tcv.border.color.medium};
  border-radius: ${tcv.border.radius.pill};
  color: ${({ active }) => active ? tcv.font.color.primary : tcv.font.color.tertiary};
  cursor: ${({ completed }) => completed ? 'pointer' : 'default'};
  display: flex; font-size: ${tcv.font.size.sm}; gap: ${tcv.spacing[1]};
  padding: ${tcv.spacing[1.5]} ${tcv.spacing[3]};
`;
const StyledFooter = styled.div`
  border-top: 1px solid ${tcv.border.color.medium}; display: flex;
  gap: ${tcv.spacing[2]}; justify-content: flex-end; padding: ${tcv.spacing[3]};
`;
const StyledDatasetRow = styled.div`
  align-items: center; background: ${tcv.background.secondary};
  border: 1px solid ${tcv.border.color.medium}; border-radius: ${tcv.border.radius.md};
  color: ${tcv.font.color.secondary}; display: flex; font-size: ${tcv.font.size.sm};
  gap: ${tcv.spacing[2]}; margin-bottom: ${tcv.spacing[4]}; padding: ${tcv.spacing[2]} ${tcv.spacing[3]};
`;
const StyledRunningSection = styled.div`
  display: flex; flex-direction: column; gap: ${tcv.spacing[3]}; margin-bottom: ${tcv.spacing[4]};
`;
const StyledRunningTitle = styled.div`
  align-items: center; color: ${tcv.font.color.secondary}; display: flex;
  font-size: ${tcv.font.size.sm}; gap: ${tcv.spacing[2]};
`;
const StyledStageLabel = styled.span`
  color: ${tcv.font.color.tertiary}; font-size: ${tcv.font.size.xs};
`;

type StepType = 'upload' | 'config';

type AnalysisSidePanelProps = {
  onClose: () => void;
  onRunStart: (run: AnalysisRun) => void;
  onRunComplete: (run: AnalysisRun) => void;
  initialFile?: AnalysisFile | null;
};

export const AnalysisSidePanel = ({
  onClose,
  onRunStart,
  onRunComplete,
  initialFile,
}: AnalysisSidePanelProps) => {
  const files = useAtomValue(analysisFilesState);
  const setAnalyses = useSetAtom(analysesState);
  const setAnalysisRuns = useSetAtom(analysisRunsState);
  const [step, setStep] = useState<StepType>(initialFile ? 'config' : 'upload');
  const [csvFile, setCsvFile] = useState<AnalysisFile | null>(initialFile ?? null);
  const [analysisType, setAnalysisType] = useState<AnalysisType>('descriptive');
  const [targetColumn, setTargetColumn] = useState<string | undefined>();
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [name, setName] = useState(
    initialFile ? `Analysis of ${initialFile.name}` : '',
  );
  const [isRunning, setIsRunning] = useState(false);
  const [runStage, setRunStage] = useState(0);
  const { createAnalysis } = useCreateAnalysis();

  const isUsingInitialFile = csvFile?.id === initialFile?.id;

  const handleRun = async () => {
    if (!csvFile || isRunning) return;

    setIsRunning(true);
    setRunStage(0);

    const analysis = await createAnalysis({
      name: name || 'Analysis ' + new Date().toLocaleDateString(),
      csvFileId: csvFile.id,
      analysisType,
      targetColumn,
      config,
    });

    setAnalyses((prev) =>
      prev.map((item) =>
        item.id === analysis.id ? { ...item, status: 'running' } : item,
      ),
    );

    const runId = crypto.randomUUID();
    const startedAt = new Date().toISOString();

    onRunStart({
      id: runId,
      analysisId: analysis.id,
      status: 'running',
      startedAt,
      result: null,
    });

    // Compute real results from the full uploaded dataset.
    const file = files.find((item) => item.id === csvFile.id) ?? csvFile;
    const result = computeAnalysisResult(
      file,
      analysisType,
      targetColumn,
      config,
    );

    const run: AnalysisRun = {
      id: runId,
      analysisId: analysis.id,
      status: 'completed',
      startedAt,
      completedAt: new Date().toISOString(),
      result,
    };

    // Persist the run so it survives a reload / navigating away.
    setAnalysisRuns((prev) => ({ ...prev, [analysis.id]: run }));
    setAnalyses((prev) =>
      prev.map((item) =>
        item.id === analysis.id ? { ...item, status: 'completed' } : item,
      ),
    );

    onRunComplete(run);
    setIsRunning(false);
  };

  return (
    <>
      <StyledOverlay onClick={onClose} />
      <StyledPanel>
        <StyledHeader>
          <StyledTitle>{t`New Analysis`}</StyledTitle>
          <StyledCloseButton onClick={onClose}>
            <IconX size={16} />
          </StyledCloseButton>
        </StyledHeader>
        <StyledBody>
          {isRunning ? (
            <StyledRunningSection>
              <StyledRunningTitle>
                <IconSparkles size={14} />
                {t`Running analysis…`}
              </StyledRunningTitle>
              <ProgressBar
                value={((runStage + 1) / RUN_STAGES.length) * 100}
                barColor="#3b82f6"
                withBorderRadius
              />
              <StyledStageLabel>{t`${RUN_STAGES[runStage]}…`}</StyledStageLabel>
            </StyledRunningSection>
          ) : (
            <>
              {initialFile && isUsingInitialFile && (
                <StyledDatasetRow>
                  <IconFileUpload size={14} />
                  <span>{initialFile.name}</span>
                </StyledDatasetRow>
              )}
              <StyledSteps>
                <StyledStep
                  active={step === 'upload'}
                  completed={step !== 'upload' && !!csvFile}
                  onClick={() => csvFile && setStep('upload')}
                >
                  1. {t`Upload CSV`}
                </StyledStep>
                <StyledStep active={step === 'config'} completed={false}>
                  2. {t`Configure`}
                </StyledStep>
              </StyledSteps>
              {step === 'upload' && (
                <CsvUploadStep
                  onComplete={(file) => {
                    setCsvFile(file);
                    setStep('config');
                  }}
                />
              )}
              {step === 'config' && (
                <AnalysisConfigStep
                  analysisType={analysisType}
                  targetColumn={targetColumn}
                  config={config}
                  name={name}
                  onAnalysisTypeChange={setAnalysisType}
                  onTargetColumnChange={setTargetColumn}
                  onConfigChange={setConfig}
                  onNameChange={setName}
                />
              )}
            </>
          )}
        </StyledBody>
        {!isRunning && (
          <StyledFooter>
            {step === 'upload' && (
              <Button
                title={t`Cancel`}
                variant="secondary"
                size="small"
                onClick={onClose}
              />
            )}
            {step === 'config' && (
              <Button
                title={t`Back`}
                variant="secondary"
                size="small"
                onClick={() => setStep('upload')}
              />
            )}
            {step === 'config' && (
              <Button
                Icon={IconPlus}
                title={t`Run Analysis`}
                variant="primary"
                accent="blue"
                size="small"
                onClick={handleRun}
              />
            )}
          </StyledFooter>
        )}
      </StyledPanel>
    </>
  );
};
