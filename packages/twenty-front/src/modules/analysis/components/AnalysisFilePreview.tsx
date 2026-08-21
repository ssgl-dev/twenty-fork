import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { themeCssVariables as tcv } from 'twenty-ui/theme-constants';
import {
  IconChevronLeft,
  IconChevronRight,
  IconDownload,
  IconTable,
} from 'twenty-ui/icon';
import { Button } from 'twenty-ui/input';
import {
  type AnalysisFile,
  type AnalysisPreviewRow,
} from '@/analysis/types/analysis.types';
import { getAnomalousPreviewRows } from '@/analysis/utils/getAnomalousPreviewRows';

// Sliding-window virtualization: only rows inside the viewport (plus a small
// overscan buffer) are mounted at any time. The remaining rows render as
// loading-filler stripes, so the scrollbar still reflects the full dataset
// while a 2500-row file stays cheap to display.
const ROW_HEIGHT = 32;
const OVERSCAN_ROWS = 12;

const Root = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
`;

const TableScroll = styled.div`
  flex: 1;
  min-height: 0;
  overflow: auto;
`;

const FileHeader = styled.div`
  align-items: center;
  background: ${tcv.background.secondary};
  border-bottom: 1px solid ${tcv.border.color.medium};
  display: flex;
  gap: ${tcv.spacing[3]};
  min-height: 44px;
  padding: 0 ${tcv.spacing[3]};
`;

const FileName = styled.span`
  font-size: ${tcv.font.size.sm};
  font-weight: ${tcv.font.weight.medium};
`;

const FileMeta = styled.span`
  color: ${tcv.font.color.tertiary};
  font-size: ${tcv.font.size.xs};
`;

const DownloadLink = styled.a`
  align-items: center;
  color: ${tcv.font.color.tertiary};
  display: flex;
  gap: ${tcv.spacing[1]};
  margin-left: auto;
  text-decoration: none;
  &:hover {
    color: ${tcv.font.color.primary};
  }
`;

const Table = styled.table`
  border-collapse: collapse;
  font-size: ${tcv.font.size.sm};
  width: 100%;
`;

const Tr = styled.tr`
  height: ${ROW_HEIGHT}px;
`;

const Th = styled.th`
  background: ${tcv.background.tertiary};
  border-bottom: 1px solid ${tcv.border.color.medium};
  padding: ${tcv.spacing[2]} ${tcv.spacing[3]};
  position: sticky;
  text-align: left;
  top: 0;
`;

const StyledAnomalyNav = styled.div`
  align-items: center;
  display: flex;
  gap: ${tcv.spacing[2]};
`;

const StyledAnomalyCount = styled.span`
  color: ${tcv.font.color.secondary};
  font-size: ${tcv.font.size.xs};
  font-weight: ${tcv.font.weight.medium};
  white-space: nowrap;
`;

// Anomaly rows reuse the app's neutral greys so the highlight reads correctly
// in both light and dark themes. The focused (current) anomaly is emphasised
// with a slightly stronger tone + accent bar so it stands out while exploring.
const Td = styled.td<{ anomaly?: boolean; current?: boolean }>`
  background: ${({ anomaly, current }) =>
    current
      ? tcv.background.tertiary
      : anomaly
        ? tcv.background.secondary
        : 'transparent'};
  border-bottom: 1px solid ${tcv.border.color.light};
  border-left: ${({ current }) =>
    current
      ? `3px solid ${tcv.border.color.strong}`
      : '3px solid transparent'};
  box-sizing: border-box;
  color: ${({ anomaly, current }) =>
    anomaly || current ? tcv.font.color.danger : tcv.font.color.primary};
  font-weight: ${({ current }) => (current ? '600' : 'normal')};
  height: ${ROW_HEIGHT}px;
  overflow: hidden;
  padding: 0 ${tcv.spacing[3]};
  text-overflow: ellipsis;
  vertical-align: middle;
  white-space: nowrap;
`;

const AnomalyBadge = styled.span<{ current?: boolean }>`
  background: ${({ current }) =>
    current ? tcv.background.primary : tcv.background.tertiary};
  border: 1px solid ${tcv.border.color.danger};
  border-radius: ${tcv.border.radius.pill};
  color: ${tcv.font.color.danger};
  font-size: ${tcv.font.size.xs};
  margin-left: ${tcv.spacing[2]};
  padding: 1px ${tcv.spacing[2]};
`;

// Out-of-window rows render as loading-filler stripes instead of being
// mounted, so scrolling over a large file stays cheap. Real rows mount as
// the sliding window moves into them.
const Filler = styled.td`
  background: repeating-linear-gradient(
    180deg,
    ${tcv.background.secondary} 0,
    ${tcv.background.secondary} 1px,
    ${tcv.background.primary} 1px,
    ${tcv.background.primary} ${ROW_HEIGHT}px
  );
  border-bottom: 1px solid ${tcv.border.color.light};
  padding: 0;
`;

const Empty = styled.div`
  align-items: center;
  color: ${tcv.font.color.tertiary};
  display: flex;
  flex: 1;
  flex-direction: column;
  font-size: ${tcv.font.size.md};
  gap: ${tcv.spacing[2]};
  justify-content: center;
`;

const formatCell = (value: string | number | boolean | null): string => {
  if (value === null || value === undefined) return '—';

  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(2);

  return String(value);
};

const getFormattedSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;

  return `${(bytes / 1024).toFixed(1)} KB`;
};

type Props = {
  file: AnalysisFile;
  highlightAnomalies: boolean;
};

export const AnalysisFilePreview = ({ file, highlightAnomalies }: Props) => {
  const anomalousRowIndices = useMemo(() => {
    if (!highlightAnomalies) return [] as number[];

    return getAnomalousPreviewRows(file).map((anomaly) => anomaly.rowIndex);
  }, [file, highlightAnomalies]);

  const anomalousRowIndexSet = useMemo(
    () => new Set(anomalousRowIndices),
    [anomalousRowIndices],
  );

  const [currentAnomalyIndex, setCurrentAnomalyIndex] = useState<number | null>(
    null,
  );

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  const updateViewport = useCallback(() => {
    const element = scrollRef.current;

    if (!element) return;

    setScrollTop(element.scrollTop);
    setViewportHeight(element.clientHeight);
  }, []);

  // Measure the scroll viewport on mount and whenever it resizes so the
  // sliding window always covers exactly what is visible.
  useEffect(() => {
    const element = scrollRef.current;

    if (!element) return;

    updateViewport();

    const resizeObserver = new ResizeObserver(updateViewport);

    resizeObserver.observe(element);

    return () => resizeObserver.disconnect();
  }, [updateViewport]);

  // Sliding window: only rows inside the viewport (+ overscan buffer) are
  // mounted; the rest of the dataset renders as loading fillers.
  const totalRows = file.previewRows.length;
  const startIndex = Math.max(
    0,
    Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN_ROWS,
  );
  const visibleCount =
    Math.ceil(viewportHeight / ROW_HEIGHT) + OVERSCAN_ROWS * 2;
  const endIndex = Math.min(totalRows, startIndex + visibleCount);
  const visibleRows = file.previewRows.slice(startIndex, endIndex);

  // Start exploring at the first anomaly whenever the file or the highlight
  // toggle changes.
  useEffect(() => {
    setCurrentAnomalyIndex(anomalousRowIndices.length > 0 ? 0 : null);
  }, [file.id, highlightAnomalies, anomalousRowIndices.length]);

  // Keep the focused anomaly centered in view while navigating. The scroll
  // position drives the sliding window, so the target row mounts on arrival.
  useEffect(() => {
    if (currentAnomalyIndex === null || anomalousRowIndices.length === 0) {
      return;
    }

    const element = scrollRef.current;

    if (!element) return;

    const targetRowIndex = anomalousRowIndices[currentAnomalyIndex];
    const targetTop = targetRowIndex * ROW_HEIGHT;
    const centeredTop = targetTop - element.clientHeight / 2 + ROW_HEIGHT / 2;

    element.scrollTo({ top: Math.max(0, centeredTop), behavior: 'smooth' });
  }, [currentAnomalyIndex, anomalousRowIndices]);

  const goToNextAnomaly = () => {
    if (anomalousRowIndices.length === 0) return;

    setCurrentAnomalyIndex(
      (index) =>
        index === null ? 0 : (index + 1) % anomalousRowIndices.length,
    );
  };

  const goToPreviousAnomaly = () => {
    if (anomalousRowIndices.length === 0) return;

    setCurrentAnomalyIndex(
      (index) =>
        index === null
          ? 0
          : (index - 1 + anomalousRowIndices.length) %
            anomalousRowIndices.length,
    );
  };

  const isAnomalous = (rowIndex: number) =>
    anomalousRowIndexSet.has(rowIndex);

  const isCurrentAnomaly = (rowIndex: number) =>
    currentAnomalyIndex !== null &&
    anomalousRowIndices[currentAnomalyIndex] === rowIndex;

  const hasAnomalies = anomalousRowIndices.length > 0;
  const currentPosition = (currentAnomalyIndex ?? 0) + 1;

  return (
    <Root>
      <FileHeader>
        <IconTable size={14} />
        <FileName>{file.name}</FileName>
        <FileMeta>{t`${file.rowCount} rows`}</FileMeta>
        <FileMeta>
          {file.columns.length} {t`columns`} · {getFormattedSize(file.size)}
        </FileMeta>
        {highlightAnomalies && hasAnomalies && (
          <StyledAnomalyNav>
            <Button
              Icon={IconChevronLeft}
              title={t`Previous anomaly`}
              variant="secondary"
              size="small"
              onClick={goToPreviousAnomaly}
            />
            <StyledAnomalyCount>
              {t`Anomaly ${currentPosition} of ${anomalousRowIndices.length}`}
            </StyledAnomalyCount>
            <Button
              Icon={IconChevronRight}
              title={t`Next anomaly`}
              variant="secondary"
              size="small"
              onClick={goToNextAnomaly}
            />
          </StyledAnomalyNav>
        )}
        <DownloadLink
          href={file.url}
          download={file.name}
          title={t`Download CSV`}
        >
          <IconDownload size={14} />
          {t`Download`}
        </DownloadLink>
      </FileHeader>
      {totalRows === 0 ? (
        <Empty>{t`No rows to preview`}</Empty>
      ) : (
        <TableScroll ref={scrollRef} onScroll={updateViewport}>
          <Table>
            <thead>
              <tr>
                {file.columns.map((column) => (
                  <Th key={column.name}>{column.name}</Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {startIndex > 0 && (
                <tr aria-hidden="true">
                  <Filler
                    colSpan={file.columns.length}
                    style={{ height: startIndex * ROW_HEIGHT }}
                  />
                </tr>
              )}
              {visibleRows.map((row: AnalysisPreviewRow, offset: number) => {
                const rowIndex = startIndex + offset;

                return (
                  <Tr key={rowIndex} id={`anomaly-row-${rowIndex}`}>
                    {file.columns.map((column, columnIndex) => (
                      <Td
                        key={column.name}
                        anomaly={isAnomalous(rowIndex)}
                        current={isCurrentAnomaly(rowIndex)}
                      >
                        {formatCell(row[column.name] ?? null)}
                        {columnIndex === 0 && isAnomalous(rowIndex) && (
                          <AnomalyBadge current={isCurrentAnomaly(rowIndex)}>
                            {t`anomaly`}
                          </AnomalyBadge>
                        )}
                      </Td>
                    ))}
                  </Tr>
                );
              })}
              {endIndex < totalRows && (
                <tr aria-hidden="true">
                  <Filler
                    colSpan={file.columns.length}
                    style={{ height: (totalRows - endIndex) * ROW_HEIGHT }}
                  />
                </tr>
              )}
            </tbody>
          </Table>
        </TableScroll>
      )}
    </Root>
  );
};
