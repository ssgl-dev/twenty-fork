import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { useSetAtom } from 'jotai';
import { IconFileUpload } from 'twenty-ui/icon';
import { themeCssVariables as tcv } from 'twenty-ui/theme-constants';
import {
  analysisFilesState,
  selectedAnalysisFileIdState,
} from '@/analysis/states/analysisState';
import { type AnalysisFile } from '@/analysis/types/analysis.types';
import { parseCsvFile } from '@/analysis/utils/parseCsvFile';

const StyledUploadZone = styled.div`
  align-items: center;
  border: 2px dashed ${tcv.border.color.medium};
  border-radius: ${tcv.border.radius.lg};
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: ${tcv.spacing[3]};
  justify-content: center;
  padding: ${tcv.spacing[10]};
  transition: border-color 0.2s ease;
  &:hover { border-color: ${tcv.border.color.strong}; }
`;
const StyledUploadIcon = styled.div`
  color: ${tcv.font.color.tertiary};
  display: flex;
`;
const StyledUploadText = styled.p`
  color: ${tcv.font.color.secondary}; font-size: ${tcv.font.size.md}; margin: 0; text-align: center;
`;
const StyledUploadHint = styled.p`
  color: ${tcv.font.color.tertiary}; font-size: ${tcv.font.size.sm}; margin: 0;
`;
const StyledFileInput = styled.input` display: none; `;

type CsvUploadStepProps = {
  onComplete: (file: AnalysisFile) => void;
};

export const CsvUploadStep = ({ onComplete }: CsvUploadStepProps) => {
  const setAnalysisFiles = useSetAtom(analysisFilesState);
  const setSelectedFileId = useSetAtom(selectedAnalysisFileIdState);

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const parsedFile = await parseCsvFile(file);

    setAnalysisFiles((prev) => [...prev, parsedFile]);
    setSelectedFileId(parsedFile.id);
    onComplete(parsedFile);
  };

  return (
    <StyledUploadZone onClick={() => document.getElementById('csv-upload')?.click()} role="button" tabIndex={0} aria-label={t`Upload CSV file`}
      onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') document.getElementById('csv-upload')?.click(); }}>
      <StyledUploadIcon><IconFileUpload size={48} /></StyledUploadIcon>
      <StyledUploadText>{t`Drag and drop a CSV file here, or click to browse`}</StyledUploadText>
      <StyledUploadHint>{t`Supported format: .csv (max 100MB)`}</StyledUploadHint>
      <StyledFileInput id="csv-upload" type="file" accept=".csv" onChange={handleFileChange} />
    </StyledUploadZone>
  );
};
