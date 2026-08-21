import { type AnalysisFile, type AnalysisPreviewRow } from '@/analysis/types/analysis.types';

type MockFileSeed = {
  id: string;
  name: string;
  uploadedAt: string;
  columns: Array<{ name: string; dtype: string; description: string }>;
  rows: AnalysisPreviewRow[];
};

const buildCsvDataUrl = (
  columns: Array<{ name: string }>,
  rows: AnalysisPreviewRow[],
): string => {
  const header = columns.map((column) => column.name).join(',');
  const lines = rows.map((row) =>
    columns.map((column) => String(row[column.name] ?? '')).join(','),
  );
  return (
    'data:text/csv;charset=utf-8,' +
    encodeURIComponent([header, ...lines].join('\n'))
  );
};

const buildFile = (seed: MockFileSeed): AnalysisFile => {
  const columns = seed.columns.map((column) => {
    const values = seed.rows
      .map((row) => row[column.name])
      .filter((value) => value !== null && value !== undefined);

    const unique = new Set(values.map((value) => String(value))).size;

    return {
      ...column,
      count: values.length,
      missing: seed.rows.length - values.length,
      unique,
    };
  });

  return {
    ...seed,
    url: buildCsvDataUrl(seed.columns, seed.rows),
    size: Math.round(seed.rows.length * seed.columns.length * 24),
    rowCount: seed.rows.length,
    columns,
    previewRows: seed.rows,
  };
};

const CUSTOMER_CHURN: MockFileSeed = {
  id: 'file-customer-churn',
  name: 'customer_churn.csv',
  uploadedAt: '2026-07-28T09:14:00Z',
  columns: [
    { name: 'customer_id', dtype: 'object', description: 'Unique customer identifier' },
    { name: 'plan', dtype: 'object', description: 'Subscription plan name' },
    { name: 'monthly_charge', dtype: 'float64', description: 'Monthly recurring charge in USD' },
    { name: 'tenure_months', dtype: 'int64', description: 'Number of months since signup' },
    { name: 'support_tickets', dtype: 'int64', description: 'Support tickets opened in the last 90 days' },
    { name: 'churned', dtype: 'bool', description: 'Whether the customer churned' },
  ],
  rows: [
    { customer_id: 'C-1001', plan: 'pro', monthly_charge: 49, tenure_months: 24, support_tickets: 1, churned: false },
    { customer_id: 'C-1002', plan: 'basic', monthly_charge: 19, tenure_months: 3, support_tickets: 4, churned: true },
    { customer_id: 'C-1003', plan: 'enterprise', monthly_charge: 199, tenure_months: 41, support_tickets: 0, churned: false },
    { customer_id: 'C-1004', plan: 'pro', monthly_charge: 49, tenure_months: 12, support_tickets: 2, churned: false },
    { customer_id: 'C-1005', plan: 'basic', monthly_charge: 19, tenure_months: -3, support_tickets: 9, churned: true },
    { customer_id: 'C-1006', plan: 'enterprise', monthly_charge: 199, tenure_months: 55, support_tickets: 3, churned: false },
    { customer_id: 'C-1007', plan: 'pro', monthly_charge: 49, tenure_months: 7, support_tickets: 1, churned: true },
    { customer_id: 'C-1008', plan: 'basic', monthly_charge: 19, tenure_months: 18, support_tickets: 0, churned: false },
    { customer_id: 'C-1009', plan: 'enterprise', monthly_charge: 620, tenure_months: 30, support_tickets: 1, churned: false },
    { customer_id: 'C-1010', plan: 'pro', monthly_charge: 49, tenure_months: 9, support_tickets: 5, churned: true },
    { customer_id: 'C-1011', plan: 'basic', monthly_charge: 19, tenure_months: 27, support_tickets: 2, churned: false },
    { customer_id: 'C-1012', plan: 'pro', monthly_charge: 49, tenure_months: 14, support_tickets: 0, churned: false },
  ],
};

const SALES_LEADS: MockFileSeed = {
  id: 'file-sales-leads',
  name: 'sales_leads.csv',
  uploadedAt: '2026-07-30T14:40:00Z',
  columns: [
    { name: 'lead_id', dtype: 'object', description: 'Unique lead identifier' },
    { name: 'company', dtype: 'object', description: 'Company name' },
    { name: 'region', dtype: 'object', description: 'Sales region' },
    { name: 'deal_value', dtype: 'float64', description: 'Expected deal value in USD' },
    { name: 'probability', dtype: 'float64', description: 'Estimated win probability (0-1)' },
    { name: 'closed', dtype: 'bool', description: 'Whether the deal was closed' },
  ],
  rows: [
    { lead_id: 'L-2101', company: 'Acme Corp', region: 'emea', deal_value: 12000, probability: 0.6, closed: false },
    { lead_id: 'L-2102', company: 'Globex', region: 'na', deal_value: 8500, probability: 0.4, closed: false },
    { lead_id: 'L-2103', company: 'Initech', region: 'apac', deal_value: 24000, probability: 0.8, closed: true },
    { lead_id: 'L-2104', company: 'Umbrella Inc', region: 'na', deal_value: 3200, probability: 0.2, closed: false },
    { lead_id: 'L-2105', company: 'Hooli', region: 'na', deal_value: 45000, probability: 1.7, closed: true },
    { lead_id: 'L-2106', company: 'Stark Industries', region: 'emea', deal_value: 18000, probability: 0.5, closed: false },
    { lead_id: 'L-2107', company: 'Wayne Enterprises', region: 'na', deal_value: 6000, probability: 0.7, closed: false },
    { lead_id: 'L-2108', company: 'Cyberdyne', region: 'apac', deal_value: 9500, probability: 0.3, closed: false },
    { lead_id: 'L-2109', company: 'Vandelay Ind', region: 'emea', deal_value: 7200, probability: 0.9, closed: true },
    { lead_id: 'L-2110', company: 'Pied Piper', region: 'na', deal_value: 15000, probability: 0.6, closed: false },
    { lead_id: 'L-2111', company: 'Aperture Sci', region: 'na', deal_value: 31000, probability: 0.4, closed: false },
    { lead_id: 'L-2112', company: 'Black Mesa', region: 'na', deal_value: 4800, probability: 0.5, closed: false },
  ],
};

const INVENTORY_METRICS: MockFileSeed = {
  id: 'file-inventory-metrics',
  name: 'inventory_metrics.csv',
  uploadedAt: '2026-08-01T08:05:00Z',
  columns: [
    { name: 'sku', dtype: 'object', description: 'Stock keeping unit' },
    { name: 'product_name', dtype: 'object', description: 'Product name' },
    { name: 'units_sold', dtype: 'int64', description: 'Units sold this month' },
    { name: 'restock_level', dtype: 'int64', description: 'Minimum stock level before reorder' },
    { name: 'days_out_of_stock', dtype: 'int64', description: 'Days the product was out of stock' },
    { name: 'reorder_triggered', dtype: 'bool', description: 'Whether a reorder was triggered' },
  ],
  rows: [
    { sku: 'SKU-001', product_name: 'Wireless Mouse', units_sold: 340, restock_level: 100, days_out_of_stock: 0, reorder_triggered: false },
    { sku: 'SKU-002', product_name: 'Mechanical Keyboard', units_sold: 180, restock_level: 60, days_out_of_stock: 2, reorder_triggered: true },
    { sku: 'SKU-003', product_name: 'USB-C Hub', units_sold: 95, restock_level: 40, days_out_of_stock: 6, reorder_triggered: true },
    { sku: 'SKU-004', product_name: 'Laptop Stand', units_sold: 220, restock_level: 80, days_out_of_stock: 0, reorder_triggered: false },
    { sku: 'SKU-005', product_name: 'Monitor 27in', units_sold: 64, restock_level: 25, days_out_of_stock: 1, reorder_triggered: false },
    { sku: 'SKU-006', product_name: 'Webcam 4K', units_sold: 410, restock_level: 120, days_out_of_stock: -9, reorder_triggered: true },
    { sku: 'SKU-007', product_name: 'Desk Mat', units_sold: 150, restock_level: 70, days_out_of_stock: 0, reorder_triggered: false },
    { sku: 'SKU-008', product_name: 'Docking Station', units_sold: 88, restock_level: 30, days_out_of_stock: 3, reorder_triggered: true },
    { sku: 'SKU-009', product_name: 'Headset', units_sold: 265, restock_level: 90, days_out_of_stock: 0, reorder_triggered: false },
    { sku: 'SKU-010', product_name: 'Ergonomic Chair', units_sold: 45, restock_level: 15, days_out_of_stock: 12, reorder_triggered: true },
    { sku: 'SKU-011', product_name: 'Cable Organizer', units_sold: 510, restock_level: 200, days_out_of_stock: 0, reorder_triggered: false },
    { sku: 'SKU-012', product_name: 'Desk Lamp', units_sold: 130, restock_level: 50, days_out_of_stock: 0, reorder_triggered: false },
  ],
};

export const MOCK_ANALYSIS_FILES: AnalysisFile[] = [
  buildFile(CUSTOMER_CHURN),
  buildFile(SALES_LEADS),
  buildFile(INVENTORY_METRICS),
];
