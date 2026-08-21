import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { Loader } from 'twenty-ui/feedback';
import { themeCssVariables as tcv } from 'twenty-ui/theme-constants';
import { IconX } from 'twenty-ui/icon';
import { ClassificationResults } from '@/analysis/components/ClassificationResults';
import { DescriptiveResults } from '@/analysis/components/DescriptiveResults';
import { IsolationForestResults } from '@/analysis/components/IsolationForestResults';
import { type AnalysisRun } from '@/analysis/types/analysis.types';

const LABELS: Record<string, string> = {
  descriptive: 'Descriptive',
  isolation_forest: 'Anomaly Detection',
  classification: 'Classification',
};

const StyledOverlay = styled.div`
  background: rgba(0, 0, 0, 0.3);
  inset: 0;
  position: fixed;
  z-index: 100;
`;

const StyledPanel = styled.div`
  background: ${tcv.background.primary};
  border-left: 1px solid ${tcv.border.color.medium};
  bottom: 0;
  display: flex;
  flex-direction: column;
  position: fixed;
  right: 0;
  top: 0;
  width: 460px;
  z-index: 101;
`;

const StyledHeader = styled.div`
  align-items: center;
  background: ${tcv.background.secondary};
  border-bottom: 1px solid ${tcv.border.color.medium};
  display: flex;
  gap: ${tcv.spacing[2]};
  min-height: 48px;
  padding: 0 ${tcv.spacing[3]};
`;

const StyledTitle = styled.span`
  font-size: ${tcv.font.size.md};
  font-weight: ${tcv.font.weight.semiBold};
`;

const StyledTypeLabel = styled.span`
  color: ${tcv.font.color.tertiary};
  font-size: ${tcv.font.size.xs};
`;

const StyledCloseButton = styled.button`
  align-items: center;
  background: none;
  border: none;
  border-radius: ${tcv.border.radius.sm};
  color: ${tcv.font.color.tertiary};
  cursor: pointer;
  display: flex;
  margin-left: auto;
  padding: 4px;
  &:hover {
    background: ${tcv.background.transparent.light};
    color: ${tcv.font.color.primary};
  }
`;

const StyledBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: ${tcv.spacing[4]};
`;

const StyledState = styled.div`
  align-items: center;
  color: ${tcv.font.color.tertiary};
  display: flex;
  flex: 1;
  flex-direction: column;
  font-size: ${tcv.font.size.md};
  gap: ${tcv.spacing[3]};
  justify-content: center;
`;

const StyledErrorMessage = styled.span`
  font-size: ${tcv.font.size.sm};
  text-align: center;
`;

type AnalysisResultsPanelProps = {
  run: AnalysisRun;
  analysisType: string;
  onClose: () => void;
};

export const AnalysisResultsPanel = ({
  run,
  analysisType,
  onClose,
}: AnalysisResultsPanelProps) => {
  const result = run.result as Record<string, unknown> | null | undefined;

  const renderResults = () => {
    if (run.status === 'running') {
      return (
        <StyledState>
          <Loader />
          <span>{t`Running analysis…`}</span>
        </StyledState>
      );
    }

    if (run.status === 'failed') {
      return (
        <StyledState>
          <span>{t`Analysis failed`}</span>
          {run.errorMessage && (
            <StyledErrorMessage>{run.errorMessage}</StyledErrorMessage>
          )}
        </StyledState>
      );
    }

    if (!result) {
      return <StyledState>{t`No results yet`}</StyledState>;
    }

    if (analysisType === 'descriptive') {
      return <DescriptiveResults result={result} />;
    }

    if (analysisType === 'isolation_forest') {
      return <IsolationForestResults result={result} />;
    }

    if (analysisType === 'classification') {
      return <ClassificationResults result={result} />;
    }

    return <StyledState>{t`No results yet`}</StyledState>;
  };

  return (
    <>
      <StyledOverlay onClick={onClose} />
      <StyledPanel>
        <StyledHeader>
          <StyledTitle>{t`Results`}</StyledTitle>
          <StyledTypeLabel>
            {LABELS[analysisType] ?? analysisType}
          </StyledTypeLabel>
          <StyledCloseButton onClick={onClose}>
            <IconX size={16} />
          </StyledCloseButton>
        </StyledHeader>
        <StyledBody>{renderResults()}</StyledBody>
      </StyledPanel>
    </>
  );
};
