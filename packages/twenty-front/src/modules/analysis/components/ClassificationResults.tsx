import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { themeCssVariables as tcv } from 'twenty-ui/theme-constants';

const StyledSection = styled.div` display: flex; flex-direction: column; gap: ${tcv.spacing[3]}; `;
const StyledSectionTitle = styled.h2` font-size: ${tcv.font.size.md}; font-weight: ${tcv.font.weight.semiBold}; margin: 0; `;
const StyledMetricsGrid = styled.div` display: grid; gap: ${tcv.spacing[3]}; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); `;
const StyledMetricCard = styled.div` background: ${tcv.background.secondary}; border: 1px solid ${tcv.border.color.medium}; border-radius: ${tcv.border.radius.md}; display: flex; flex-direction: column; gap: ${tcv.spacing[1]}; padding: ${tcv.spacing[3]}; `;
const StyledMetricValue = styled.span` font-size: ${tcv.font.size.xl}; font-weight: ${tcv.font.weight.semiBold}; `;
const StyledMetricLabel = styled.span` color: ${tcv.font.color.tertiary}; font-size: ${tcv.font.size.xs}; `;
const StyledTable = styled.table` border-collapse: collapse; font-size: ${tcv.font.size.sm}; width: 100%; `;
const StyledTh = styled.th` background: ${tcv.background.tertiary}; border: 1px solid ${tcv.border.color.medium}; padding: ${tcv.spacing[1.5]} ${tcv.spacing[2]}; text-align: left; `;
const StyledTd = styled.td` border: 1px solid ${tcv.border.color.medium}; padding: ${tcv.spacing[1.5]} ${tcv.spacing[2]}; `;
const StyledFeatureList = styled.div` display: flex; flex-direction: column; gap: ${tcv.spacing[1]}; `;
const StyledFeatureItem = styled.div` display: flex; font-size: ${tcv.font.size.sm}; gap: ${tcv.spacing[2]}; justify-content: space-between; `;
const StyledBar = styled.div<{ width: number }>` background: #3b82f6; border-radius: ${tcv.border.radius.sm}; height: 8px; opacity: 0.6; width: ${({ width }) => `${width}%`}; `;
const StyledConfusionCell = styled.td<{ isDiagonal: boolean }>`
  background: ${({ isDiagonal }) => isDiagonal ? tcv.background.transparent.light : 'transparent'};
  border: 1px solid ${tcv.border.color.medium}; font-weight: ${({ isDiagonal }) => isDiagonal ? 'bold' : 'normal'}; padding: ${tcv.spacing[1.5]} ${tcv.spacing[2]}; text-align: center;
`;

type Props = { result: Record<string, unknown>; };

export const ClassificationResults = ({ result }: Props) => {
  const accuracy = Number(result.accuracy ?? 0);
  const precision = Number(result.precision ?? 0);
  const recall = Number(result.recall ?? 0);
  const f1 = Number(result.f1 ?? 0);
  const algorithm = String(result.algorithm ?? '');
  const targetColumn = String(result.target_column ?? '');
  const confusionMatrix = (result.confusion_matrix as number[][]) ?? [];
  const featureImportance = (result.feature_importance as Record<string, number>) ?? {};
  const featureEntries = Object.entries(featureImportance).sort(([, a], [, b]) => b - a).slice(0, 10);
  const maxImportance = featureEntries.length > 0 ? featureEntries[0][1] : 1;

  return (<>
    <StyledSection><StyledSectionTitle>{t`Model Performance`}</StyledSectionTitle>
      <StyledMetricsGrid>
        <StyledMetricCard><StyledMetricValue>{(accuracy * 100).toFixed(1)}%</StyledMetricValue><StyledMetricLabel>{t`Accuracy`}</StyledMetricLabel></StyledMetricCard>
        <StyledMetricCard><StyledMetricValue>{(precision * 100).toFixed(1)}%</StyledMetricValue><StyledMetricLabel>{t`Precision`}</StyledMetricLabel></StyledMetricCard>
        <StyledMetricCard><StyledMetricValue>{(recall * 100).toFixed(1)}%</StyledMetricValue><StyledMetricLabel>{t`Recall`}</StyledMetricLabel></StyledMetricCard>
        <StyledMetricCard><StyledMetricValue>{(f1 * 100).toFixed(1)}%</StyledMetricValue><StyledMetricLabel>{t`F1 Score`}</StyledMetricLabel></StyledMetricCard>
      </StyledMetricsGrid>
      <StyledMetricLabel>{t`Algorithm`}: {algorithm} | {t`Target`}: {targetColumn}</StyledMetricLabel></StyledSection>
    {confusionMatrix.length > 0 && (<StyledSection><StyledSectionTitle>{t`Confusion Matrix`}</StyledSectionTitle>
      <StyledTable><tbody>{confusionMatrix.map((row: number[], i: number) => (<tr key={i}>{row.map((cell: number, j: number) => (<StyledConfusionCell key={j} isDiagonal={i === j}>{cell}</StyledConfusionCell>))}</tr>))}</tbody></StyledTable></StyledSection>)}
    {featureEntries.length > 0 && (<StyledSection><StyledSectionTitle>{t`Feature Importance`}</StyledSectionTitle>
      <StyledFeatureList>{featureEntries.map(([feature, value]) => (<StyledFeatureItem key={feature}><span>{feature}</span><StyledBar width={maxImportance > 0 ? (value / maxImportance) * 100 : 0} /><span>{value.toFixed(4)}</span></StyledFeatureItem>))}</StyledFeatureList></StyledSection>)}
  </>);
};
