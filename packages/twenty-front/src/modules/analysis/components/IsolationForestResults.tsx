import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { themeCssVariables as tcv } from 'twenty-ui/theme-constants';

const StyledSection = styled.div` display: flex; flex-direction: column; gap: ${tcv.spacing[3]}; `;
const StyledSectionTitle = styled.h2` font-size: ${tcv.font.size.md}; font-weight: ${tcv.font.weight.semiBold}; margin: 0; `;
const StyledSummary = styled.div` color: ${tcv.font.color.secondary}; display: flex; font-size: ${tcv.font.size.sm}; gap: ${tcv.spacing[4]}; `;
const StyledHint = styled.div`
  background: ${tcv.background.transparent.light};
  border: 1px solid ${tcv.border.color.medium};
  border-radius: ${tcv.border.radius.md};
  color: ${tcv.font.color.secondary};
  font-size: ${tcv.font.size.sm};
  padding: ${tcv.spacing[2]} ${tcv.spacing[3]};
`;
const StyledFeatureList = styled.div` display: flex; flex-direction: column; gap: ${tcv.spacing[1]}; `;
const StyledFeatureItem = styled.div` display: flex; font-size: ${tcv.font.size.sm}; gap: ${tcv.spacing[2]}; justify-content: space-between; `;
const StyledBar = styled.div<{ width: number }>`
  background: #3b82f6; border-radius: ${tcv.border.radius.sm}; height: 8px; opacity: 0.6; width: ${({ width }) => `${width}%`};
`;

type Props = { result: Record<string, unknown>; };

export const IsolationForestResults = ({ result }: Props) => {
  const totalRows = Number(result.total_rows ?? 0);
  const anomalyCount = Number(result.anomaly_count ?? 0);
  const contamination = Number(result.contamination ?? 0);
  const featureImportance = (result.feature_importance as Record<string, number>) ?? {};
  const featureEntries = Object.entries(featureImportance).sort(([, a], [, b]) => b - a).slice(0, 10);
  const maxImportance = featureEntries.length > 0 ? featureEntries[0][1] : 1;

  return (<>
    <StyledSection><StyledSectionTitle>{t`Anomaly Summary`}</StyledSectionTitle>
      <StyledSummary><span>{t`Total Rows`}: {totalRows}</span><span>{t`Anomalies Found`}: {anomalyCount} ({(contamination * 100).toFixed(1)}% contamination)</span></StyledSummary></StyledSection>
    <StyledHint>{t`Anomalous rows are highlighted in the file preview.`}</StyledHint>
    {featureEntries.length > 0 && (<StyledSection><StyledSectionTitle>{t`Feature Importance`}</StyledSectionTitle>
      <StyledFeatureList>{featureEntries.map(([feature, value]) => (<StyledFeatureItem key={feature}><span>{feature}</span><StyledBar width={maxImportance > 0 ? (value / maxImportance) * 100 : 0} /><span>{value.toFixed(2)}</span></StyledFeatureItem>))}</StyledFeatureList></StyledSection>)}
  </>);
};
