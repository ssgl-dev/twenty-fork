import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { themeCssVariables as tcv } from 'twenty-ui/theme-constants';

const StyledSection = styled.div` display: flex; flex-direction: column; gap: ${tcv.spacing[3]}; `;
const StyledSectionTitle = styled.h2` font-size: ${tcv.font.size.md}; font-weight: ${tcv.font.weight.semiBold}; margin: 0; `;
const StyledTable = styled.table` border-collapse: collapse; font-size: ${tcv.font.size.sm}; width: 100%; `;
const StyledTh = styled.th` background: ${tcv.background.tertiary}; border: 1px solid ${tcv.border.color.medium}; padding: ${tcv.spacing[1.5]} ${tcv.spacing[2]}; text-align: left; `;
const StyledTd = styled.td` border: 1px solid ${tcv.border.color.medium}; padding: ${tcv.spacing[1.5]} ${tcv.spacing[2]}; `;
const StyledCorrelationList = styled.div` display: flex; flex-direction: column; gap: ${tcv.spacing[1]}; `;
const StyledCorrelationItem = styled.div` display: flex; font-size: ${tcv.font.size.sm}; gap: ${tcv.spacing[2]}; `;
const StyledCorrelationBar = styled.div<{ width: number; isPositive: boolean }>`
  background: ${({ isPositive }) => isPositive ? '#3b82f6' : '#ef4444'};
  border-radius: ${tcv.border.radius.sm}; height: 8px; opacity: 0.6; width: ${({ width }) => `${width}%`};
`;

type Props = { result: Record<string, unknown>; };

export const DescriptiveResults = ({ result }: Props) => {
  const columnStats = result.column_stats as Array<Record<string, unknown>> | undefined;
  const correlationMatrix = result.correlation_matrix as Array<Record<string, unknown>> | undefined;
  return (<>
    {columnStats && columnStats.length > 0 && (<StyledSection><StyledSectionTitle>{t`Column Statistics`}</StyledSectionTitle>
      <StyledTable><thead><tr><StyledTh>{t`Column`}</StyledTh><StyledTh>{t`Type`}</StyledTh><StyledTh>{t`Count`}</StyledTh><StyledTh>{t`Missing`}</StyledTh><StyledTh>{t`Unique`}</StyledTh><StyledTh>{t`Mean`}</StyledTh><StyledTh>{t`Std`}</StyledTh><StyledTh>{t`Min`}</StyledTh><StyledTh>{t`Max`}</StyledTh></tr></thead>
      <tbody>{columnStats.map((col: Record<string, unknown>, idx: number) => (<tr key={idx}>
        <StyledTd>{String(col.column)}</StyledTd><StyledTd>{String(col.dtype)}</StyledTd><StyledTd>{String(col.count)}</StyledTd>
        <StyledTd>{String(col.missing)}</StyledTd><StyledTd>{String(col.unique)}</StyledTd>
        <StyledTd>{col.mean != null ? Number(col.mean).toFixed(2) : '—'}</StyledTd>
        <StyledTd>{col.std != null ? Number(col.std).toFixed(2) : '—'}</StyledTd>
        <StyledTd>{col.min != null ? Number(col.min).toFixed(2) : '—'}</StyledTd>
        <StyledTd>{col.max != null ? Number(col.max).toFixed(2) : '—'}</StyledTd>
      </tr>))}</tbody></StyledTable></StyledSection>)}
    {correlationMatrix && correlationMatrix.length > 0 && (<StyledSection><StyledSectionTitle>{t`Correlation Matrix`}</StyledSectionTitle>
      <StyledCorrelationList>{correlationMatrix.map((corr: Record<string, unknown>, idx: number) => {
        const value = Number(corr.correlation);
        return (<StyledCorrelationItem key={idx}><span>{String(corr.column_a)} ↔ {String(corr.column_b)}</span>
        <span>{value.toFixed(3)}</span><StyledCorrelationBar width={Math.abs(value) * 100} isPositive={value >= 0} /></StyledCorrelationItem>);
      })}</StyledCorrelationList></StyledSection>)}
  </>);
};
