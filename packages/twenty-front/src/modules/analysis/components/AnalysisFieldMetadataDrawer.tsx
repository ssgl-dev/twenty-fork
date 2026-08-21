import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { themeCssVariables as tcv } from 'twenty-ui/theme-constants';
import { IconX } from 'twenty-ui/icon';
import { type AnalysisFile } from '@/analysis/types/analysis.types';

const Overlay = styled.div`
  background: rgba(0, 0, 0, 0.3);
  inset: 0;
  position: fixed;
  z-index: 100;
`;

const Panel = styled.div`
  background: ${tcv.background.primary};
  border-left: 1px solid ${tcv.border.color.medium};
  bottom: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  position: fixed;
  right: 0;
  top: 0;
  width: 380px;
  z-index: 101;
`;

const Header = styled.div`
  align-items: center;
  background: ${tcv.background.secondary};
  border-bottom: 1px solid ${tcv.border.color.medium};
  display: flex;
  justify-content: space-between;
  min-height: 48px;
  padding: 0 ${tcv.spacing[3]};
`;

const Title = styled.span`
  font-size: ${tcv.font.size.md};
  font-weight: ${tcv.font.weight.semiBold};
`;

const CloseBtn = styled.button`
  align-items: center;
  background: none;
  border: none;
  border-radius: ${tcv.border.radius.sm};
  color: ${tcv.font.color.tertiary};
  cursor: pointer;
  display: flex;
  padding: 4px;
  &:hover {
    background: ${tcv.background.transparent.light};
    color: ${tcv.font.color.primary};
  }
`;

const Body = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${tcv.spacing[4]};
  overflow-y: auto;
  padding: ${tcv.spacing[4]};
`;

const Section = styled.div``;

const SectionTitle = styled.div`
  color: ${tcv.font.color.secondary};
  font-size: ${tcv.font.size.sm};
  font-weight: ${tcv.font.weight.medium};
  margin-bottom: ${tcv.spacing[2]};
  text-transform: uppercase;
`;

const FileSummary = styled.div`
  background: ${tcv.background.secondary};
  border: 1px solid ${tcv.border.color.medium};
  border-radius: ${tcv.border.radius.md};
  display: flex;
  flex-direction: column;
  gap: ${tcv.spacing[2]};
  padding: ${tcv.spacing[3]};
`;

const SummaryRow = styled.div`
  display: flex;
  font-size: ${tcv.font.size.sm};
  justify-content: space-between;
`;

const SummaryLabel = styled.span`
  color: ${tcv.font.color.tertiary};
`;

const SummaryValue = styled.span`
  font-weight: ${tcv.font.weight.medium};
`;

const FieldRow = styled.div`
  border: 1px solid ${tcv.border.color.light};
  border-radius: ${tcv.border.radius.md};
  display: flex;
  flex-direction: column;
  gap: ${tcv.spacing[1]};
  padding: ${tcv.spacing[2]} ${tcv.spacing[3]};
`;

const FieldHeader = styled.div`
  align-items: center;
  display: flex;
  font-size: ${tcv.font.size.sm};
  gap: ${tcv.spacing[2]};
  justify-content: space-between;
`;

const FieldName = styled.span`
  font-weight: ${tcv.font.weight.medium};
`;

const DtypeBadge = styled.span`
  background: ${tcv.background.transparent.light};
  border: 1px solid ${tcv.border.color.medium};
  border-radius: ${tcv.border.radius.pill};
  color: ${tcv.font.color.secondary};
  font-size: ${tcv.font.size.xs};
  padding: 1px ${tcv.spacing[2]};
`;

const FieldDescription = styled.span`
  color: ${tcv.font.color.secondary};
  font-size: ${tcv.font.size.xs};
`;

const FieldStats = styled.span`
  color: ${tcv.font.color.tertiary};
  font-size: ${tcv.font.size.xs};
`;

const WhyItMattersList = styled.ul`
  display: flex;
  flex-direction: column;
  gap: ${tcv.spacing[2]};
  margin: 0;
  padding-left: ${tcv.spacing[4]};
`;

const WhyItMattersItem = styled.li`
  color: ${tcv.font.color.secondary};
  font-size: ${tcv.font.size.sm};
`;

const getFormattedSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;

  return `${(bytes / 1024).toFixed(1)} KB`;
};

type Props = {
  file: AnalysisFile | null;
  onClose: () => void;
};

export const AnalysisFieldMetadataDrawer = ({ file, onClose }: Props) => {
  return (
    <>
      <Overlay onClick={onClose} />
      <Panel>
        <Header>
          <Title>{t`Dataset info`}</Title>
          <CloseBtn onClick={onClose}>
            <IconX size={16} />
          </CloseBtn>
        </Header>
        {file ? (
          <Body>
            <Section>
              <SectionTitle>{t`Dataset`}</SectionTitle>
              <FileSummary>
                <SummaryRow>
                  <SummaryLabel>{t`File`}</SummaryLabel>
                  <SummaryValue>{file.name}</SummaryValue>
                </SummaryRow>
                <SummaryRow>
                  <SummaryLabel>{t`Rows`}</SummaryLabel>
                  <SummaryValue>{file.rowCount}</SummaryValue>
                </SummaryRow>
                <SummaryRow>
                  <SummaryLabel>{t`Columns`}</SummaryLabel>
                  <SummaryValue>{file.columns.length}</SummaryValue>
                </SummaryRow>
                <SummaryRow>
                  <SummaryLabel>{t`Size`}</SummaryLabel>
                  <SummaryValue>{getFormattedSize(file.size)}</SummaryValue>
                </SummaryRow>
                <SummaryRow>
                  <SummaryLabel>{t`Uploaded`}</SummaryLabel>
                  <SummaryValue>
                    {new Date(file.uploadedAt).toLocaleDateString()}
                  </SummaryValue>
                </SummaryRow>
              </FileSummary>
            </Section>
            <Section>
              <SectionTitle>{t`Fields`}</SectionTitle>
              {file.columns.map((column) => (
                <FieldRow key={column.name}>
                  <FieldHeader>
                    <FieldName>{column.name}</FieldName>
                    <DtypeBadge>{column.dtype}</DtypeBadge>
                  </FieldHeader>
                  <FieldDescription>{column.description}</FieldDescription>
                  <FieldStats>
                    {t`${column.count} values · ${column.missing} missing · ${column.unique} unique`}
                  </FieldStats>
                </FieldRow>
              ))}
            </Section>
            <Section>
              <SectionTitle>{t`Why this matters`}</SectionTitle>
              <WhyItMattersList>
                <WhyItMattersItem>
                  {t`Anomalies in numeric columns can reveal data entry errors, outliers, or fraud signals before they skew downstream models.`}
                </WhyItMattersItem>
                <WhyItMattersItem>
                  {t`Missing values affect which analyses can run reliably — descriptive stats always report them explicitly.`}
                </WhyItMattersItem>
                <WhyItMattersItem>
                  {t`Unique counts tell you whether a column is an identifier, a category, or a continuous measurement.`}
                </WhyItMattersItem>
                <WhyItMattersItem>
                  {t`This file has ${file.rowCount} rows; analyses run on the full dataset, not just the preview shown here.`}
                </WhyItMattersItem>
              </WhyItMattersList>
            </Section>
          </Body>
        ) : (
          <Body>
            <SectionTitle>{t`Select a file to see its metadata`}</SectionTitle>
          </Body>
        )}
      </Panel>
    </>
  );
};
