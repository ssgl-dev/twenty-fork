import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { useAtomValue, useSetAtom } from 'jotai';
import { useCallback, useState } from 'react';
import {
  IconAlertTriangle,
  IconChartBar,
  IconDotsVertical,
  IconFileUpload,
  IconInfoCircle,
  IconPlus,
  IconSparkles,
  IconTrash,
} from 'twenty-ui/icon';
import { Button, LightIconButton } from 'twenty-ui/input';
import { MenuItem } from 'twenty-ui/navigation';
import { themeCssVariables as tcv } from 'twenty-ui/theme-constants';
import { AnalysisFieldMetadataDrawer } from '@/analysis/components/AnalysisFieldMetadataDrawer';
import { AnalysisFilePreview } from '@/analysis/components/AnalysisFilePreview';
import { AnalysisResultsPanel } from '@/analysis/components/AnalysisResultsPanel';
import { AnalysisSidePanel } from '@/analysis/components/AnalysisSidePanel';
import { Dropdown } from '@/ui/layout/dropdown/components/Dropdown';
import { DropdownContent } from '@/ui/layout/dropdown/components/DropdownContent';
import { DropdownMenuItemsContainer } from '@/ui/layout/dropdown/components/DropdownMenuItemsContainer';
import { useCloseDropdown } from '@/ui/layout/dropdown/hooks/useCloseDropdown';
import {
  analysesState,
  analysisFilesState,
  analysisRunsState,
  selectedAnalysisFileIdState,
} from '@/analysis/states/analysisState';
import {
  type Analysis,
  type AnalysisRun,
} from '@/analysis/types/analysis.types';
import { PageCardLayout } from '@/ui/layout/page/components/PageCardLayout';
import { PageCardHeader } from '@/ui/layout/page/components/PageCardHeader';

const WorkspaceRoot = styled.div`
  display: flex;
  flex: 1;
  min-height: 0;
  min-width: 0;
`;

const LeftPane = styled.div`
  background: ${tcv.background.primary};
  border-right: 1px solid ${tcv.border.color.medium};
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: ${tcv.spacing[4]};
  min-width: 260px;
  overflow-y: auto;
  padding: ${tcv.spacing[3]};
  width: 260px;
`;

const Section = styled.div``;

const SectionTitle = styled.div`
  color: ${tcv.font.color.tertiary};
  font-size: ${tcv.font.size.xs};
  font-weight: ${tcv.font.weight.semiBold};
  letter-spacing: 0.5px;
  margin-bottom: ${tcv.spacing[2]};
  text-transform: uppercase;
`;

// Hover-reveal "..." row action, mirroring the row-action affordance used in
// the rest of the app (e.g. the record list rows).
const ItemActions = styled.div`
  align-items: center;
  display: flex;
  margin-left: auto;
  opacity: 0;
  transition: opacity 0.15s ease;
`;

const FileItem = styled.div<{ active?: boolean }>`
  align-items: center;
  background: ${({ active }) =>
    active ? tcv.background.transparent.light : 'transparent'};
  border: 1px solid
    ${({ active }) =>
      active ? tcv.border.color.medium : 'transparent'};
  border-radius: ${tcv.border.radius.sm};
  box-sizing: border-box;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: ${tcv.spacing[2]};
  &:hover {
    background: ${tcv.background.transparent.light};
  }
  &:hover ${ItemActions},
  &:focus-within ${ItemActions} {
    opacity: 1;
  }
`;

const FileItemTitle = styled.div`
  align-items: center;
  display: flex;
  font-size: ${tcv.font.size.sm};
  gap: ${tcv.spacing[2]};
  min-width: 0;
  width: 100%;
`;

const FileItemName = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const FileItemMeta = styled.span`
  color: ${tcv.font.color.tertiary};
  font-size: ${tcv.font.size.xs};
  width: 100%;
`;

const AnalysisItem = styled.div<{ active?: boolean }>`
  background: ${({ active }) =>
    active ? tcv.background.transparent.light : 'transparent'};
  border: 1px solid
    ${({ active }) =>
      active ? tcv.border.color.medium : 'transparent'};
  border-radius: ${tcv.border.radius.sm};
  box-sizing: border-box;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: ${tcv.spacing[2]};
  &:hover {
    background: ${tcv.background.transparent.light};
  }
  &:hover ${ItemActions},
  &:focus-within ${ItemActions} {
    opacity: 1;
  }
`;

const AnalysisItemTitle = styled.div`
  align-items: center;
  display: flex;
  font-size: ${tcv.font.size.sm};
  gap: ${tcv.spacing[2]};
  min-width: 0;
  width: 100%;
`;

const AnalysisItemName = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const MainPane = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
`;

const ActionBar = styled.div`
  align-items: center;
  background: ${tcv.background.secondary};
  border-bottom: 1px solid ${tcv.border.color.medium};
  display: flex;
  gap: ${tcv.spacing[2]};
  min-height: 44px;
  padding: 0 ${tcv.spacing[3]};
`;

const ActionBarTitle = styled.div`
  align-items: center;
  display: flex;
  font-size: ${tcv.font.size.sm};
  font-weight: ${tcv.font.weight.medium};
  gap: ${tcv.spacing[2]};
  margin-right: auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const HeaderActions = styled.div`
  align-items: center;
  display: flex;
  gap: ${tcv.spacing[2]};
`;

const StyledEmpty = styled.div`
  align-items: center;
  color: ${tcv.font.color.tertiary};
  display: flex;
  flex: 1;
  flex-direction: column;
  font-size: ${tcv.font.size.md};
  gap: ${tcv.spacing[2]};
  justify-content: center;
`;

const LABELS: Record<string, string> = {
  descriptive: 'Descriptive',
  isolation_forest: 'Anomaly Detection',
  classification: 'Classification',
};

type ActiveRun = { analysisId: string; run: AnalysisRun };

export const AnalysisWorkspacePage = () => {
  const analyses = useAtomValue(analysesState);
  const files = useAtomValue(analysisFilesState);
  const analysisRuns = useAtomValue(analysisRunsState);
  const selectedFileId = useAtomValue(selectedAnalysisFileIdState);
  const setSelectedFileId = useSetAtom(selectedAnalysisFileIdState);
  const setAnalyses = useSetAtom(analysesState);
  const setFiles = useSetAtom(analysisFilesState);
  const setAnalysisRuns = useSetAtom(analysisRunsState);

  const { closeDropdown } = useCloseDropdown();

  const [activeRun, setActiveRun] = useState<ActiveRun | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const [highlightAnomalies, setHighlightAnomalies] = useState(false);

  const selectedFile =
    files.find((file) => file.id === selectedFileId) ?? null;

  const handleSelectFile = useCallback(
    (fileId: string) => {
      setSelectedFileId(fileId);
      setActiveRun(null);
      setIsResultsOpen(false);
      setHighlightAnomalies(false);
    },
    [setSelectedFileId],
  );

  const handleViewAnalysis = useCallback(
    (analysis: Analysis) => {
      const savedRun = analysisRuns[analysis.id];

      setActiveRun({
        analysisId: analysis.id,
        run:
          savedRun ?? {
            id: analysis.id,
            analysisId: analysis.id,
            status: analysis.status,
            startedAt: analysis.createdAt,
            completedAt: analysis.updatedAt,
          },
      });
      if (analysis.csvFileId) {
        setSelectedFileId(analysis.csvFileId);
      }
      setHighlightAnomalies(true);
      setIsResultsOpen(true);
      setIsDrawerOpen(false);
    },
    [analysisRuns, setSelectedFileId],
  );

  const handleRunStart = useCallback((run: AnalysisRun) => {
    setActiveRun({ analysisId: run.analysisId, run });
  }, []);

  const handleRunComplete = useCallback(
    (run: AnalysisRun) => {
      setAnalyses((prev) =>
        prev.map((analysis) =>
          analysis.id === run.analysisId
            ? { ...analysis, status: run.status }
            : analysis,
        ),
      );
      setActiveRun({ analysisId: run.analysisId, run });

      const completedAnalysis = analyses.find(
        (analysis) => analysis.id === run.analysisId,
      );

      if (completedAnalysis?.csvFileId) {
        setSelectedFileId(completedAnalysis.csvFileId);
      }

      setHighlightAnomalies(true);
      setIsResultsOpen(true);
      setIsSidePanelOpen(false);
      setIsDrawerOpen(false);
    },
    [setAnalyses, analyses, setSelectedFileId],
  );

  const activeAnalysis =
    activeRun && analyses.find((a) => a.id === activeRun.analysisId);

  const handleDeleteFile = useCallback(
    (fileId: string) => {
      setFiles((prev) => prev.filter((file) => file.id !== fileId));

      // Analyses + runs tied to the deleted dataset are removed too: without
      // their source file they would only render as broken rows.
      const orphanedAnalyses = analyses.filter(
        (analysis) => analysis.csvFileId === fileId,
      );

      setAnalyses((prev) =>
        prev.filter((analysis) => analysis.csvFileId !== fileId),
      );
      setAnalysisRuns((prev) => {
        const next = { ...prev };

        orphanedAnalyses.forEach((analysis) => {
          delete next[analysis.id];
        });

        return next;
      });

      if (selectedFileId === fileId) {
        setSelectedFileId(null);
      }

      if (
        activeRun &&
        orphanedAnalyses.some(
          (analysis) => analysis.id === activeRun.analysisId,
        )
      ) {
        setActiveRun(null);
        setIsResultsOpen(false);
        setHighlightAnomalies(false);
      }

      closeDropdown(`file-options-${fileId}`);
    },
    [
      setFiles,
      setAnalyses,
      setAnalysisRuns,
      analyses,
      selectedFileId,
      setSelectedFileId,
      activeRun,
      closeDropdown,
    ],
  );

  const handleDeleteAnalysis = useCallback(
    (analysisId: string) => {
      setAnalyses((prev) =>
        prev.filter((analysis) => analysis.id !== analysisId),
      );
      setAnalysisRuns((prev) => {
        const next = { ...prev };

        delete next[analysisId];

        return next;
      });

      if (activeRun?.analysisId === analysisId) {
        setActiveRun(null);
        setIsResultsOpen(false);
        setHighlightAnomalies(false);
      }

      closeDropdown(`analysis-options-${analysisId}`);
    },
    [setAnalyses, setAnalysisRuns, activeRun, closeDropdown],
  );

  const header = (
    <PageCardHeader
      icon={<IconChartBar size={16} />}
      title={t`Analysis`}
      actionButton={
        <HeaderActions>
          <Button
            Icon={IconInfoCircle}
            title={t`Dataset info`}
            variant="secondary"
            size="small"
            onClick={() => setIsDrawerOpen((open) => !open)}
          />
          <Button
            Icon={IconPlus}
            title={t`New Analysis`}
            variant="primary"
            accent="blue"
            size="small"
            onClick={() => setIsSidePanelOpen(true)}
          />
        </HeaderActions>
      }
    />
  );

  return (
    <PageCardLayout header={header}>
      <WorkspaceRoot>
        <LeftPane>
          <Section>
            <SectionTitle>{t`Files to analyze`}</SectionTitle>
            {files.map((file) => (
              <FileItem
                key={file.id}
                active={file.id === selectedFileId}
                onClick={() => handleSelectFile(file.id)}
              >
                <FileItemTitle>
                  <IconFileUpload size={14} />
                  <FileItemName>{file.name}</FileItemName>
                  <ItemActions>
                    <Dropdown
                      clickableComponent={
                        <LightIconButton
                          Icon={IconDotsVertical}
                          size="small"
                          accent="tertiary"
                          aria-label={t`File options`}
                        />
                      }
                      dropdownId={`file-options-${file.id}`}
                      dropdownPlacement="bottom-end"
                      dropdownComponents={
                        <DropdownContent>
                          <DropdownMenuItemsContainer>
                            <MenuItem
                              LeftIcon={IconTrash}
                              text={t`Delete`}
                              accent="danger"
                              onClick={() => handleDeleteFile(file.id)}
                            />
                          </DropdownMenuItemsContainer>
                        </DropdownContent>
                      }
                    />
                  </ItemActions>
                </FileItemTitle>
                <FileItemMeta>
                  {file.rowCount} {t`rows`} · {file.columns.length}{' '}
                  {t`columns`}
                </FileItemMeta>
              </FileItem>
            ))}
          </Section>
          <Section>
            <SectionTitle>{t`Recent analyses`}</SectionTitle>
            {analyses.length === 0 ? (
              <FileItemMeta>{t`No analyses yet`}</FileItemMeta>
            ) : (
              analyses.map((analysis) => (
                <AnalysisItem
                  key={analysis.id}
                  active={activeRun?.analysisId === analysis.id}
                  onClick={() => handleViewAnalysis(analysis)}
                >
                  <AnalysisItemTitle>
                    <AnalysisItemName>{analysis.name}</AnalysisItemName>
                    <ItemActions>
                      <Dropdown
                        clickableComponent={
                          <LightIconButton
                            Icon={IconDotsVertical}
                            size="small"
                            accent="tertiary"
                            aria-label={t`Analysis options`}
                          />
                        }
                        dropdownId={`analysis-options-${analysis.id}`}
                        dropdownPlacement="bottom-end"
                        dropdownComponents={
                          <DropdownContent>
                            <DropdownMenuItemsContainer>
                              <MenuItem
                                LeftIcon={IconTrash}
                                text={t`Delete`}
                                accent="danger"
                                onClick={() =>
                                  handleDeleteAnalysis(analysis.id)
                                }
                              />
                            </DropdownMenuItemsContainer>
                          </DropdownContent>
                        }
                      />
                    </ItemActions>
                  </AnalysisItemTitle>
                  <FileItemMeta>
                    {LABELS[analysis.analysisType] ?? analysis.analysisType}
                  </FileItemMeta>
                </AnalysisItem>
              ))
            )}
          </Section>
        </LeftPane>
        <MainPane>
          {selectedFile ? (
            <>
              <ActionBar>
                <ActionBarTitle>
                  <IconFileUpload size={14} />
                  {selectedFile.name}
                </ActionBarTitle>
                {activeRun && (
                  <>
                    <Button
                      Icon={IconChartBar}
                      title={t`Results`}
                      variant={isResultsOpen ? 'primary' : 'secondary'}
                      accent="blue"
                      size="small"
                      onClick={() => setIsResultsOpen(true)}
                    />
                  </>
                )}
                <Button
                  Icon={IconSparkles}
                  title={t`Analyze file`}
                  variant="primary"
                  accent="blue"
                  size="small"
                  onClick={() => {
                    setIsDrawerOpen(false);
                    setIsSidePanelOpen(true);
                  }}
                />
                <Button
                  Icon={IconAlertTriangle}
                  title={
                    highlightAnomalies
                      ? t`Hide anomalies`
                      : t`Highlight anomalies`
                  }
                  variant="secondary"
                  size="small"
                  onClick={() =>
                    setHighlightAnomalies((highlight) => !highlight)
                  }
                />
                <Button
                  Icon={IconInfoCircle}
                  title={t`Dataset info`}
                  variant="secondary"
                  size="small"
                  onClick={() => setIsDrawerOpen((open) => !open)}
                />
              </ActionBar>
              <AnalysisFilePreview
                file={selectedFile}
                highlightAnomalies={highlightAnomalies}
              />
            </>
          ) : (
            <StyledEmpty>
              <IconChartBar size={48} />
              <p>{t`Select a file to preview its contents`}</p>
              <span>
                {t`Pick a dataset from the list, then run an analysis on it.`}
              </span>
            </StyledEmpty>
          )}
        </MainPane>
      </WorkspaceRoot>
      {isDrawerOpen && (
        <AnalysisFieldMetadataDrawer
          file={selectedFile}
          onClose={() => setIsDrawerOpen(false)}
        />
      )}
      {isSidePanelOpen && (
        <AnalysisSidePanel
          initialFile={selectedFile}
          onClose={() => setIsSidePanelOpen(false)}
          onRunStart={handleRunStart}
          onRunComplete={handleRunComplete}
        />
      )}
      {isResultsOpen && activeRun && (
        <AnalysisResultsPanel
          run={activeRun.run}
          analysisType={activeAnalysis?.analysisType ?? 'descriptive'}
          onClose={() => setIsResultsOpen(false)}
        />
      )}
    </PageCardLayout>
  );
};
