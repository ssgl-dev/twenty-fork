import {
  type AnalysisFile,
  type AnalysisFileColumn,
  type AnalysisPreviewRow,
} from '@/analysis/types/analysis.types';

const isNonEmptyString = (value: string | null): value is string =>
  value !== null && value.trim() !== '';

const inferDtype = (values: Array<string | null>): string => {
  const nonEmpty = values.filter(isNonEmptyString);

  if (nonEmpty.length === 0) return 'object';

  const allBoolean = nonEmpty.every(
    (value) =>
      value.trim().toLowerCase() === 'true' ||
      value.trim().toLowerCase() === 'false',
  );

  if (allBoolean) return 'bool';

  const allInteger = nonEmpty.every((value) =>
    /^[+-]?\d+$/.test(value.trim()),
  );

  if (allInteger) return 'int64';

  const allNumeric = nonEmpty.every(
    (value) => !Number.isNaN(Number(value.trim())),
  );

  if (allNumeric) return 'float64';

  return 'object';
};

const coerceValue = (
  value: string | null,
): string | number | boolean | null => {
  if (value === null || value.trim() === '') return null;

  const trimmed = value.trim();

  if (trimmed.toLowerCase() === 'true') return true;
  if (trimmed.toLowerCase() === 'false') return false;

  const numeric = Number(trimmed);

  if (!Number.isNaN(numeric)) return numeric;

  return value;
};

const splitCsvLine = (line: string): string[] => {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index++) {
    const char = line[index];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current);

  return values;
};

export const parseCsvFile = async (file: File): Promise<AnalysisFile> => {
  const text = await file.text();
  const lines = text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '');

  const [headerLine, ...dataLines] = lines;
  const columnNames = headerLine
    ? splitCsvLine(headerLine).map((name) => name.trim())
    : [];

  const rows: AnalysisPreviewRow[] = dataLines.map((line) => {
    const values = splitCsvLine(line);
    const row: AnalysisPreviewRow = {};

    columnNames.forEach((name, index) => {
      row[name] = coerceValue(values[index] ?? null);
    });

    return row;
  });

  const columns: AnalysisFileColumn[] = columnNames.map((name) => {
    const columnValues = rows.map((row) => row[name] ?? null);
    const presentValues = columnValues.filter((value) => value !== null);
    const unique = new Set(
      presentValues.map((value) => String(value)),
    ).size;

    return {
      name,
      dtype: inferDtype(
        columnValues.map((value) =>
          value === null ? null : String(value),
        ),
      ),
      description: '',
      count: presentValues.length,
      missing: columnValues.length - presentValues.length,
      unique,
    };
  });

  return {
    id: crypto.randomUUID(),
    name: file.name,
    url: URL.createObjectURL(file),
    size: file.size,
    uploadedAt: new Date().toISOString(),
    rowCount: rows.length,
    columns,
    // Keep the whole parsed dataset so the preview and the analysis both run
    // on every row, not just a truncated sample.
    previewRows: rows,
  };
};
