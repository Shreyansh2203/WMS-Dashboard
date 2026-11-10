import type { Discrepancy } from '../data/mock';

/** Serialize rows to CSV and trigger a download. */
export function exportDiscrepanciesCsv(rows: Discrepancy[], siteId: string) {
  const header = [
    'Ref', 'SKU', 'Item', 'Category', 'ABC', 'Zone', 'Location', 'Type',
    'System Qty', 'Counted Qty', 'Var Qty', 'Unit Cost', 'Value Variance',
    'Severity', 'Status', 'Detected', 'Owner',
  ];
  const esc = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`;
  const lines = rows.map((d) => [
    d.id, d.sku, d.item, d.category, d.abc, d.zoneName, d.location, d.type,
    d.systemQty, d.countedQty, d.varQty, d.unitCost.toFixed(2), d.valueVar.toFixed(2),
    d.severity, d.status, new Date(d.detectedAt).toISOString(), d.owner ?? 'Unassigned',
  ].map(esc).join(','));
  const csv = [header.map(esc).join(','), ...lines].join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `discrepancies-${siteId}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
