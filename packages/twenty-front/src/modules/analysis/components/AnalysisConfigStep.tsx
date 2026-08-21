import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { themeCssVariables as tcv } from 'twenty-ui/theme-constants';
import { type AnalysisType } from '@/analysis/types/analysis.types';

const StyledConfig = styled.div` display: flex; flex-direction: column; gap: ${tcv.spacing[5]}; `;
const StyledSection = styled.div` display: flex; flex-direction: column; gap: ${tcv.spacing[2]}; `;
const StyledLabel = styled.label` font-size: ${tcv.font.size.sm}; font-weight: ${tcv.font.weight.medium}; `;
const StyledInput = styled.input`
  background: ${tcv.background.secondary}; border: 1px solid ${tcv.border.color.medium};
  border-radius: ${tcv.border.radius.sm}; color: ${tcv.font.color.primary};
  font-size: ${tcv.font.size.sm}; padding: ${tcv.spacing[2]} ${tcv.spacing[3]};
  &:focus { border-color: ${tcv.border.color.strong}; outline: none; }
`;
const StyledSelect = styled.select`
  appearance: none; background: ${tcv.background.secondary}; border: 1px solid ${tcv.border.color.medium};
  border-radius: ${tcv.border.radius.sm}; color: ${tcv.font.color.primary};
  font-size: ${tcv.font.size.sm}; padding: ${tcv.spacing[2]} ${tcv.spacing[3]};
  &:focus { border-color: ${tcv.border.color.strong}; outline: none; }
`;
const StyledTypeCards = styled.div` display: flex; flex-direction: column; gap: ${tcv.spacing[2]}; `;
const StyledTypeCard = styled.div<{ isSelected: boolean }>`
  background: ${({ isSelected }) => isSelected ? tcv.background.primary : tcv.background.secondary};
  border: 1px solid ${({ isSelected }) => isSelected ? tcv.border.color.strong : tcv.border.color.medium};
  border-radius: ${tcv.border.radius.md}; cursor: pointer;
  display: flex; flex-direction: column; gap: ${tcv.spacing[1]}; padding: ${tcv.spacing[3]} ${tcv.spacing[4]};
  &:hover { background: ${tcv.background.primary}; }
`;
const StyledTypeTitle = styled.span` font-size: ${tcv.font.size.sm}; font-weight: ${tcv.font.weight.medium}; `;
const StyledTypeDescription = styled.span` color: ${tcv.font.color.tertiary}; font-size: ${tcv.font.size.xs}; `;
const StyledNumberInput = styled.input`
  background: ${tcv.background.secondary}; border: 1px solid ${tcv.border.color.medium};
  border-radius: ${tcv.border.radius.sm}; color: ${tcv.font.color.primary};
  font-size: ${tcv.font.size.sm}; padding: ${tcv.spacing[2]} ${tcv.spacing[3]}; width: 120px;
  &:focus { border-color: ${tcv.border.color.strong}; outline: none; }
`;

type Props = {
  analysisType: AnalysisType; targetColumn: string | undefined;
  config: Record<string, unknown>; name: string;
  onAnalysisTypeChange: (type: AnalysisType) => void; onTargetColumnChange: (column: string) => void;
  onConfigChange: (config: Record<string, unknown>) => void; onNameChange: (name: string) => void;
};

const ANALYSIS_TYPES: { type: AnalysisType; title: string; description: string }[] = [
  { type: 'descriptive', title: 'Descriptive Statistics', description: 'Column summaries, correlations, and distribution stats' },
  { type: 'isolation_forest', title: 'Anomaly Detection (Isolation Forest)', description: 'Detect outliers and unusual patterns in your data' },
  { type: 'classification', title: 'Classification', description: 'Train a model to predict a target column' },
];

export const AnalysisConfigStep = ({ analysisType, targetColumn, config, name, onAnalysisTypeChange, onTargetColumnChange, onConfigChange, onNameChange }: Props) => {
  const updateConfig = (key: string, value: unknown) => { onConfigChange({ ...config, [key]: value }); };
  return (
    <StyledConfig>
      <StyledSection><StyledLabel htmlFor="analysis-name">{t`Analysis Name`}</StyledLabel>
        <StyledInput id="analysis-name" type="text" value={name} onChange={(e) => onNameChange(e.target.value)} placeholder={t`My Analysis`} /></StyledSection>
      <StyledSection><StyledLabel>{t`Analysis Type`}</StyledLabel>
        <StyledTypeCards>{ANALYSIS_TYPES.map((item) => (
          <StyledTypeCard key={item.type} isSelected={analysisType === item.type} onClick={() => onAnalysisTypeChange(item.type)} role="radio" aria-checked={analysisType === item.type} tabIndex={0}
            onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') onAnalysisTypeChange(item.type); }}>
            <StyledTypeTitle>{item.title}</StyledTypeTitle><StyledTypeDescription>{item.description}</StyledTypeDescription></StyledTypeCard>
        ))}</StyledTypeCards></StyledSection>
      {analysisType === 'classification' && (<StyledSection><StyledLabel htmlFor="target-column">{t`Target Column`}</StyledLabel>
        <StyledInput id="target-column" type="text" value={targetColumn ?? ''} onChange={(e) => onTargetColumnChange(e.target.value)} placeholder={t`e.g. species, churn, category`} /></StyledSection>)}
      {(analysisType === 'isolation_forest' || analysisType === 'classification') && (<>
        <StyledSection><StyledLabel htmlFor="n-estimators">{t`Number of Estimators`}</StyledLabel>
          <StyledNumberInput id="n-estimators" type="number" min={10} max={1000} value={(config.n_estimators as number) ?? 100} onChange={(e) => updateConfig('n_estimators', parseInt(e.target.value, 10))} /></StyledSection>
        {analysisType === 'isolation_forest' && (<StyledSection><StyledLabel htmlFor="contamination">{t`Contamination Rate`}</StyledLabel>
          <StyledNumberInput id="contamination" type="number" min={0.01} max={0.5} step={0.01} value={(config.contamination as number) ?? 0.1} onChange={(e) => updateConfig('contamination', parseFloat(e.target.value))} /></StyledSection>)}
        {analysisType === 'classification' && (<>
          <StyledSection><StyledLabel htmlFor="test-split">{t`Test Split`}</StyledLabel>
            <StyledNumberInput id="test-split" type="number" min={0.1} max={0.5} step={0.05} value={(config.test_split as number) ?? 0.2} onChange={(e) => updateConfig('test_split', parseFloat(e.target.value))} /></StyledSection>
          <StyledSection><StyledLabel htmlFor="algorithm">{t`Algorithm`}</StyledLabel>
            <StyledSelect id="algorithm" value={(config.algorithm as string) ?? 'random_forest'} onChange={(e) => updateConfig('algorithm', e.target.value)}>
              <option value="random_forest">Random Forest</option><option value="logistic_regression">Logistic Regression</option></StyledSelect></StyledSection>
        </>)}
      </>)}
    </StyledConfig>
  );
};
