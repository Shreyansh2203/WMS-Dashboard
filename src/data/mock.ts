// ─────────────────────────────────────────────────────────────────────────────
// Recon · mock data layer
// Deterministic (seeded) generator so every reload renders the same warehouse.
// ─────────────────────────────────────────────────────────────────────────────

export interface Site {
  id: string;
  code: string;
  name: string;
  meta: string;
  seed: number;
}

export const SITES: Site[] = [
  { id: 'atl-01', code: 'ATL-01', name: 'Atlanta — Building A', meta: 'Grocery · 412K sq ft · 8 zones', seed: 7101 },
  { id: 'cmh-02', code: 'CMH-02', name: 'Columbus — Fulfillment Center', meta: 'E-commerce · 238K sq ft · 6 zones', seed: 2202 },
  { id: 'dfw-03', code: 'DFW-03', name: 'Dallas — Regional DC', meta: 'Ambient + chilled · 350K sq ft · 7 zones', seed: 3303 },
];

export const ZONES = [
  { id: 'PKA', name: 'Pick Face A' },
  { id: 'PKB', name: 'Pick Face B' },
  { id: 'BLK', name: 'Bulk Storage' },
  { id: 'HRK', name: 'High Rack' },
  { id: 'RCV', name: 'Receiving Dock' },
  { id: 'CLD', name: 'Cold Storage' },
  { id: 'SHP', name: 'Shipping Staging' },
  { id: 'RTN', name: 'Returns Processing' },
] as const;
export type ZoneId = (typeof ZONES)[number]['id'];
export const ZONE_MAP = new Map(ZONES.map((z) => [z.id, z.name]));

export type DiscrepancyType = 'Shortage' | 'Overage' | 'Missing' | 'Mislocation' | 'UOM Error';
export type Severity = 'Critical' | 'High' | 'Medium' | 'Low';
export type Status = 'Open' | 'Investigating' | 'Resolved';

export const TYPE_STYLE: Record<DiscrepancyType, { hex: string; soft: string }> = {
  Shortage:    { hex: '#3987e5', soft: 'rgba(57,135,229,0.14)' },
  Overage:     { hex: '#d95926', soft: 'rgba(217,89,38,0.14)' },
  Missing:     { hex: '#199e70', soft: 'rgba(25,158,112,0.16)' },
  Mislocation: { hex: '#c98500', soft: 'rgba(201,133,0,0.16)' },
  'UOM Error': { hex: '#d55181', soft: 'rgba(213,81,129,0.15)' },
};
export const TYPE_ORDER: DiscrepancyType[] = ['Shortage', 'Overage', 'Missing', 'Mislocation', 'UOM Error'];

export const SEV_RANK: Record<Severity, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
export const STATUS_RANK: Record<Status, number> = { Open: 0, Investigating: 1, Resolved: 2 };

export interface Discrepancy {
  id: string;
  sku: string;
  item: string;
  category: string;
  abc: 'A' | 'B' | 'C';
  zone: ZoneId;
  zoneName: string;
  location: string;
  type: DiscrepancyType;
  systemQty: number;
  countedQty: number;
  varQty: number;          // signed: negative = shrink
  unitCost: number;
  valueVar: number;        // signed $, varQty × unitCost
  severity: Severity;
  status: Status;
  detectedAt: number;
  owner: string | null;
  rootCause: string | null;
  /** Set when a resolution is recorded locally; absent for seeded records. */
  resolvedAt?: number;
}

export interface DayPoint {
  ts: number;
  label: string;
  accuracy: number;
  countsDone: number;
  countsPlanned: number;
  varianceValue: number;   // abs $ value of variances that day
  netUnits: number;        // signed units
}

// ── RNG ──────────────────────────────────────────────────────────────────────
function mulberry32(seed: number) {
  let a = seed | 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const between = (r: () => number, a: number, b: number) => a + r() * (b - a);
const int = (r: () => number, a: number, b: number) => Math.round(between(r, a, b));

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ── Item master ──────────────────────────────────────────────────────────────
interface ItemDef { sku: string; name: string; category: string; abc: 'A' | 'B' | 'C'; unitCost: number }
const ITEMS: ItemDef[] = [
  { sku: '1001', name: 'Organic Apple Sauce 24/12oz', category: 'Ambient Grocery', abc: 'A', unitCost: 21.6 },
  { sku: '1003', name: 'Cold-Pressed OJ 1gal', category: 'Chilled', abc: 'A', unitCost: 12.4 },
  { sku: '1004', name: 'Greek Yogurt Plain 32oz', category: 'Chilled', abc: 'A', unitCost: 5.85 },
  { sku: '1007', name: 'Sparkling Water Lime 24/16oz', category: 'Beverage', abc: 'A', unitCost: 11.25 },
  { sku: '1008', name: 'Oat Milk Barista 12/32oz', category: 'Beverage', abc: 'A', unitCost: 38.5 },
  { sku: '1012', name: 'Chicken Breast Boneless 40lb', category: 'Frozen', abc: 'A', unitCost: 96.0 },
  { sku: '1018', name: 'Olive Oil Extra Virgin 3L', category: 'Ambient Grocery', abc: 'A', unitCost: 33.2 },
  { sku: '1020', name: 'Ground Coffee Dark 12/12oz', category: 'Ambient Grocery', abc: 'A', unitCost: 84.6 },
  { sku: '1002', name: 'Quinoa Tri-Color 25lb', category: 'Ambient Grocery', abc: 'B', unitCost: 34.75 },
  { sku: '1005', name: 'Frozen Wild Salmon 10lb', category: 'Frozen', abc: 'B', unitCost: 48.2 },
  { sku: '1006', name: 'Baby Kale Mix 4lb', category: 'Produce', abc: 'B', unitCost: 9.4 },
  { sku: '1010', name: 'Pasta Penne 20lb', category: 'Ambient Grocery', abc: 'B', unitCost: 19.95 },
  { sku: '1013', name: 'Farm Eggs Large 15dz', category: 'Chilled', abc: 'B', unitCost: 42.5 },
  { sku: '1015', name: 'Paper Towels 12-Roll', category: 'Household', abc: 'B', unitCost: 22.3 },
  { sku: '1017', name: 'Vitamin D3 2000IU 240ct', category: 'Health & Beauty', abc: 'B', unitCost: 11.4 },
  { sku: '1019', name: 'Basmati Rice 25lb', category: 'Ambient Grocery', abc: 'B', unitCost: 26.8 },
  { sku: '1021', name: 'Frozen Mixed Berries 30lb', category: 'Frozen', abc: 'B', unitCost: 52.75 },
  { sku: '1022', name: 'Whole Milk 1gal (Local)', category: 'Chilled', abc: 'B', unitCost: 3.65 },
  { sku: '1024', name: 'Energy Drink Zero 24/16oz', category: 'Beverage', abc: 'B', unitCost: 29.4 },
  { sku: '1009', name: 'Almond Butter 16oz', category: 'Ambient Grocery', abc: 'C', unitCost: 8.9 },
  { sku: '1011', name: 'Fire-Roasted Tomatoes #10', category: 'Ambient Grocery', abc: 'C', unitCost: 7.35 },
  { sku: '1014', name: 'Dish Soap Concentrate 1gal', category: 'Household', abc: 'C', unitCost: 14.8 },
  { sku: '1016', name: 'Shampoo Refill 1L', category: 'Health & Beauty', abc: 'C', unitCost: 9.6 },
  { sku: '1023', name: 'Cheddar Block 10lb', category: 'Chilled', abc: 'C', unitCost: 44.9 },
];

const ZONE_WEIGHT: [ZoneId, number][] = [
  ['PKA', 0.20], ['PKB', 0.14], ['BLK', 0.18], ['HRK', 0.12],
  ['RCV', 0.10], ['CLD', 0.10], ['SHP', 0.12], ['RTN', 0.04],
];
const TYPE_WEIGHT: [DiscrepancyType, number][] = [
  ['Shortage', 0.30], ['Overage', 0.19], ['Missing', 0.12],
  ['Mislocation', 0.22], ['UOM Error', 0.17],
];
export const OWNERS = ['M. Okafor', 'L. Fernandez', 'D. Whitmore', 'A. Rahman', 'S. Petrov', 'J. Lindqvist', 'R. Castillo'];
/** Assignable identities: the operator is first. */
export const ASSIGNABLE = ['J. Kowalski', ...OWNERS];
export const ROOT_CAUSES = [
  'Picking error', 'Receiving error', 'Putaway misplacement',
  'Unrecorded transfer', 'UOM / case-qty mismatch', 'Count error', 'Damage write-off',
] as const;

function weightedPick<T>(r: () => number, entries: [T, number][]): T {
  let x = r();
  for (const [value, w] of entries) {
    if (x < w) return value;
    x -= w;
  }
  return entries[entries.length - 1][0];
}

// ── Daily series (180 days, oldest → newest) ─────────────────────────────────
export function genSeries(seed: number, days = 180): DayPoint[] {
  const r = mulberry32(seed);
  const phase = r() * Math.PI * 2;
  const now = new Date();
  const out: DayPoint[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - (days - 1 - i));
    const incident = r() < 0.07;
    let accuracy = 98.55 + 0.62 * Math.sin(i / 8.3 + phase) + (r() - 0.5) * 0.66;
    if (incident) accuracy -= between(r, 0.7, 1.35);
    accuracy = Math.min(99.6, Math.max(96.9, accuracy));

    const countsPlanned = Math.round(215 + 34 * Math.sin(i / 6.8 + phase * 0.6) + r() * 34);
    const countsDone = Math.min(countsPlanned, Math.round(countsPlanned * (0.84 + r() * 0.17)));

    const shortage = 620 + r() * 1750 + (incident ? 1050 : 0);
    const overage = 210 + r() * 640;
    const netUnits = Math.round(-118 + r() * 165 + (incident ? -85 : 0));

    out.push({
      ts: d.getTime(),
      label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      accuracy: Math.round(accuracy * 100) / 100,
      countsDone,
      countsPlanned,
      varianceValue: Math.round(shortage + overage),
      netUnits,
    });
  }
  return out;
}

/** Split a series into current / prior equal windows */
export function windowPair<T>(series: T[], days: number): { current: T[]; prior: T[] } {
  return {
    current: series.slice(-days),
    prior: series.slice(-days * 2, -days),
  };
}

// ── Discrepancy generation ───────────────────────────────────────────────────
export function genDiscrepancies(seed: number): Discrepancy[] {
  const r = mulberry32(seed ^ 0x9e3779b9);
  const now = Date.now();
  const usedIds = new Set<string>();
  const out: Discrepancy[] = [];

  for (let i = 0; i < 148; i++) {
    // item, weighted by ABC velocity
    const classRoll = r();
    const abc: 'A' | 'B' | 'C' = classRoll < 0.5 ? 'A' : classRoll < 0.85 ? 'B' : 'C';
    const pool = ITEMS.filter((it) => it.abc === abc);
    const item = pool[int(r, 0, pool.length - 1)];

    const type = weightedPick(r, TYPE_WEIGHT);
    const zone = weightedPick(r, ZONE_WEIGHT);

    const systemQty = abc === 'A' ? int(r, 40, 420) : abc === 'B' ? int(r, 20, 260) : int(r, 6, 120);
    let varQty: number;
    switch (type) {
      case 'Shortage':    varQty = -Math.max(1, Math.round(systemQty * between(r, 0.03, 0.2))); break;
      case 'Overage':     varQty =  Math.max(1, Math.round(systemQty * between(r, 0.03, 0.14))); break;
      case 'Missing':     varQty = -Math.max(1, Math.round(systemQty * between(r, 0.35, 1.0))); break;
      case 'Mislocation': varQty = -Math.max(1, Math.round(systemQty * between(r, 0.25, 0.75))); break;
      case 'UOM Error':   varQty = -Math.max(1, Math.round(systemQty * between(r, 0.06, 0.25))); break;
    }
    const countedQty = Math.max(0, systemQty + varQty);
    const valueVar = varQty * item.unitCost;
    const absValue = Math.abs(valueVar);

    // age weighted toward recent, but keep a tail of old stragglers
    const ageDays = Math.min(27, Math.floor(Math.pow(r(), 1.3) * 26));
    const detectedAt = now - ageDays * 86_400_000 - int(r, 0, 86_399) * 1000;

    let status: Status;
    const s = r();
    if (ageDays >= 12) status = s < 0.76 ? 'Resolved' : s < 0.88 ? 'Investigating' : 'Open';
    else if (ageDays >= 4) status = s < 0.45 ? 'Resolved' : s < 0.68 ? 'Investigating' : 'Open';
    else status = s < 0.08 ? 'Resolved' : s < 0.4 ? 'Investigating' : 'Open';

    const owner = status === 'Open' ? (r() < 0.55 ? null : OWNERS[int(r, 0, OWNERS.length - 1)]) : OWNERS[int(r, 0, OWNERS.length - 1)];
    const rootCause = status === 'Resolved' ? ROOT_CAUSES[int(r, 0, ROOT_CAUSES.length - 1)] : null;

    const severity: Severity = absValue >= 2000 ? 'Critical' : absValue >= 800 ? 'High' : absValue >= 250 ? 'Medium' : 'Low';

    let id = '';
    do { id = `RC-${int(r, 1000, 9999)}`; } while (usedIds.has(id));
    usedIds.add(id);

    out.push({
      id,
      sku: `SKU-${item.sku}`,
      item: item.name,
      category: item.category,
      abc: item.abc,
      zone,
      zoneName: ZONE_MAP.get(zone) ?? zone,
      location: `${zone}-${String(int(r, 1, 18)).padStart(2, '0')}-${String(int(r, 1, 30)).padStart(2, '0')}`,
      type,
      systemQty,
      countedQty,
      varQty,
      unitCost: item.unitCost,
      valueVar,
      severity,
      status,
      detectedAt,
      owner,
      rootCause,
    });
  }

  return out.sort((a, b) => b.detectedAt - a.detectedAt);
}

/** Six prior count events for a SKU — deterministic per id, for drawer history bars */
export function skuVarianceHistory(id: string): { label: string; varQty: number }[] {
  const r = mulberry32(hashStr(id));
  const now = new Date();
  const out: { label: string; varQty: number }[] = [];
  for (let i = 6; i >= 1; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i * 14);
    const v = r() < 0.42 ? 0 : Math.round((r() - 0.62) * 14);
    out.push({ label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), varQty: v });
  }
  return out;
}
// ── Worst-case fixture (dev-only, ?worst=1) ──────────────────────────────────
// Breaks the kind data: longest plausible retail names, extreme values, edge counts.
export function genWorstCaseDiscrepancies(seed: number): Discrepancy[] {
  const now = Date.now();
  const base = {
    sku: 'SKU-1001', item: 'Organic Apple Sauce 24/12oz', category: 'Ambient Grocery', abc: 'A' as const,
    unitCost: 21.6, detectedAt: now, owner: null as string | null, rootCause: null as string | null,
  };
  const mk = (over: Partial<Discrepancy>): Discrepancy => {
    const systemQty = over.systemQty ?? 100;
    const varQty = over.varQty ?? -10;
    const unitCost = over.unitCost ?? base.unitCost;
    const idNoise = hashStr(over.id ?? 'wc' + seed);
    return {
      id: over.id ?? `RC-${String(1000 + (idNoise % 9000))}`,
      ...base,
      unitCost,
      zone: 'BLK', zoneName: ZONE_MAP.get('BLK')!, location: 'BLK-01-01',
      type: 'Shortage', systemQty, countedQty: Math.max(0, systemQty + varQty),
      varQty, valueVar: varQty * unitCost,
      severity: 'Medium', status: 'Open', detectedAt: now, owner: base.owner, rootCause: base.rootCause,
      ...over,
    } as Discrepancy;
  };
  return [
    mk({ id: 'RC-9001', item: 'WHOLE MILK 1GAL (CREAMERY COOPERATIVE HALF-GALLON SUBCASE 12/1GAL, LOT 2026-W45-REPACK, ORGANIC GRADE A, LOCAL FARM COLLECTIVE) 10lb', category: 'Chilled Dairy Products', abc: 'A', systemQty: 640, varQty: -312, type: 'Shortage', status: 'Open', severity: 'Critical', zone: 'CLD', zoneName: ZONE_MAP.get('CLD')!, location: 'CLD-11-09', detectedAt: now - 26 * 86_400_000, owner: 'Bartholomew Fitzgerald-Kowalczyk (Interim Night Shift Lead, Zone 4 Oversight)' }),
    mk({ id: 'RC-9002', item: 'Fire-Roasted Tomatoes #10', abc: 'C', systemQty: 84, varQty: -12, type: 'Overage', status: 'Open', severity: 'Low', zone: 'HRK', zoneName: ZONE_MAP.get('HRK')!, location: 'HRK-14-29', detectedAt: now - 3 * 3_600_000 }),
    mk({ id: 'RC-9003', item: 'Frozen Wild Salmon 10lb', abc: 'A', systemQty: 1284, varQty: 1284, type: 'UOM Error', status: 'Investigating', severity: 'Critical', owner: 'J. Lindqvist', zone: 'HRK', zoneName: ZONE_MAP.get('HRK')!, location: 'HRK-02-17', detectedAt: now - 864_000_000, unitCost: 48.2 }),
    mk({ id: 'RC-9004', item: 'Quinoa Tri-Color 25lb', abc: 'B', systemQty: 1, varQty: -1, type: 'Missing', status: 'Open', severity: 'Low', detectedAt: now - 9 * 86_400_000 }),
    mk({ id: 'RC-9005', item: 'Greek Yogurt Plain 32oz', abc: 'A', systemQty: 96, varQty: 0, type: 'Mislocation', status: 'Open', severity: 'Low', zone: 'RCV', zoneName: ZONE_MAP.get('RCV')!, location: 'RCV-02-03', detectedAt: now - 5 * 86_400_000 }),
    mk({ id: 'RC-9006', item: 'Energy Drink Zero 24/16oz', abc: 'B', systemQty: 400, varQty: -4, type: 'Shortage', status: 'Resolved', severity: 'Low', owner: 'M. Okafor', rootCause: 'Picking error', detectedAt: now - 20 * 86_400_000 }),
    mk({ id: 'RC-9007', item: 'Pépinière de la Réserve – Confiture d’abricot d’exception, série limitée artisanale 340g (édition hiver)', category: 'Ambient Grocery', abc: 'B', systemQty: 25, varQty: -9, type: 'Mislocation', status: 'Open', severity: 'Medium', zone: 'RTN', zoneName: ZONE_MAP.get('RTN')!, location: 'RTN-01-12', detectedAt: now - 12 * 86_400_000, owner: 'S. Petrov' }),
    mk({ id: 'RC-9008', item: 'Chicken Breast Boneless 40lb', abc: 'A', systemQty: 400, varQty: -11, type: 'Overage', status: 'Open', severity: 'Medium', detectedAt: now - 2 * 86_400_000, owner: 'R. Castillo', unitCost: 96.0 }),
  ].sort((a, b) => b.detectedAt - a.detectedAt);
}

// ─────────────────────────────────────────────────────────────────────────────
// Derived statistics
// ─────────────────────────────────────────────────────────────────────────────

export interface WindowSummary {
  accuracy: number;
  priorAccuracy: number;
  accuracyDelta: number;
  countsDone: number;
  countsPlanned: number;
  completion: number;
  valueImpact: number;      // abs $ in window
  valueImpactPrior: number;
  valueDeltaPct: number;    // negative = improvement (less value at risk)
  netUnits: number;
  netUnitsPrior: number;
}

export function summarizeWindow(current: DayPoint[], prior: DayPoint[]): WindowSummary {
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const accuracy = avg(current.map((d) => d.accuracy));
  const priorAccuracy = avg(prior.map((d) => d.accuracy));
  const countsDone = current.reduce((a, d) => a + d.countsDone, 0);
  const countsPlanned = current.reduce((a, d) => a + d.countsPlanned, 0);
  const netUnits = current.reduce((a, d) => a + d.netUnits, 0);
  const netUnitsPrior = prior.reduce((a, d) => a + d.netUnits, 0);
  const valueImpact = current.reduce((a, d) => a + d.varianceValue, 0);
  const valueImpactPrior = prior.reduce((a, d) => a + d.varianceValue, 0);
  const valueDeltaPct = valueImpactPrior > 0 ? ((valueImpact - valueImpactPrior) / valueImpactPrior) * 100 : 0;

  return {
    accuracy,
    priorAccuracy,
    accuracyDelta: accuracy - priorAccuracy,
    countsDone,
    countsPlanned,
    completion: countsPlanned > 0 ? (countsDone / countsPlanned) * 100 : 0,
    valueImpact,
    valueImpactPrior,
    valueDeltaPct,
    netUnits,
    netUnitsPrior,
  };
}

export interface ZoneStat {
  zone: ZoneId;
  name: string;
  items: number;
  value: number;          // abs $
  shortageValue: number;  // abs $, negative-variance side
  overageValue: number;   // abs $, positive-variance side
  critical: number;
}

export function zoneStats(unresolved: Discrepancy[]): ZoneStat[] {
  const map = new Map<ZoneId, ZoneStat>();
  for (const z of ZONES) map.set(z.id, { zone: z.id, name: z.name, items: 0, value: 0, shortageValue: 0, overageValue: 0, critical: 0 });
  for (const d of unresolved) {
    const s = map.get(d.zone)!;
    const abs = Math.abs(d.valueVar);
    s.items += 1;
    s.value += abs;
    if (d.valueVar < 0) s.shortageValue += abs; else s.overageValue += abs;
    if (d.severity === 'Critical') s.critical += 1;
  }
  return [...map.values()].sort((a, b) => b.value - a.value);
}

export interface TypeStat { type: DiscrepancyType; items: number; value: number }

export function typeStats(unresolved: Discrepancy[]): TypeStat[] {
  const map = new Map<DiscrepancyType, TypeStat>(TYPE_ORDER.map((t) => [t, { type: t, items: 0, value: 0 }]));
  for (const d of unresolved) {
    const s = map.get(d.type)!;
    s.items += 1;
    s.value += Math.abs(d.valueVar);
  }
  return TYPE_ORDER.map((t) => map.get(t)!);
}

export interface Insight { tone: 'bad' | 'warn' | 'good' | 'info'; title: string; detail: string; action?: { label: string; query: string } }

export function buildInsights(unresolved: Discrepancy[], window: WindowSummary, rangeDays: number): Insight[] {
  const out: Insight[] = [];
  const totalValue = unresolved.reduce((a, d) => a + Math.abs(d.valueVar), 0);

  // 1 · Critical aging
  const criticals = unresolved.filter((d) => d.severity === 'Critical').sort((a, b) => a.detectedAt - b.detectedAt);
  const stale = criticals.filter((d) => Date.now() - d.detectedAt > 48 * 3_600_000);
  if (stale.length > 0) {
    const oldest = stale[0];
    out.push({
      tone: 'bad',
      title: `${stale.length} critical ${stale.length === 1 ? 'item' : 'items'} past their 48h SLA`,
      detail: `Oldest: ${oldest.id} · ${oldest.zoneName} · $${Math.abs(oldest.valueVar).toLocaleString('en-US', { maximumFractionDigits: 0 })} at risk. Route to a lead now — sign-off before root cause is how adjustments go wrong.`,
      action: { label: 'View criticals', query: 'critical' },
    });
  }

  // 2 · Accuracy vs prior window
  const delta = window.accuracyDelta;
  out.push({
    tone: delta >= 0 ? 'good' : 'warn',
    title: `Accuracy ${delta >= 0 ? 'gained' : 'lost'} ${Math.abs(delta).toFixed(2)} pts vs prior ${rangeDays} days`,
    detail: `Now ${window.accuracy.toFixed(2)}% against a 98.5% target${window.accuracy >= 98.5 ? '. Above target — lock in the counting procedure and move on.' : ` — ${(98.5 - window.accuracy).toFixed(2)} pts short. Find the zone eating the gap; a single procedure fix recovers most of it.`}`,
  });

  // 3 · Zone concentration
  const zones = zoneStats(unresolved).filter((z) => z.value > 0);
  if (zones.length > 0 && totalValue > 0) {
    const top = zones[0];
    const pct = (top.value / totalValue) * 100;
    out.push({
      tone: 'warn',
      title: `${top.name} holds ${pct.toFixed(0)}% of unresolved value`,
      detail: `${top.items} open items, $${top.value.toLocaleString('en-US', { maximumFractionDigits: 0 })}${top.critical ? `, ${top.critical} critical` : ''}. This is the highest leverage per audit-hour; putaway scans are the failure point.`,
      action: { label: `View ${top.zone}`, query: top.zone },
    });
  }

  // 4 · Mislocation share vs value share
  const mis = unresolved.filter((d) => d.type === 'Mislocation');
  if (unresolved.length > 10 && mis.length > 0) {
    const countShare = (mis.length / unresolved.length) * 100;
    const misValue = mis.reduce((a, d) => a + Math.abs(d.valueVar), 0);
    const valueShare = totalValue > 0 ? (misValue / totalValue) * 100 : 0;
    if (countShare - valueShare > 6) {
      out.push({
        tone: 'info',
        title: `Mislocations are ${countShare.toFixed(0)}% of items, ${valueShare.toFixed(0)}% of value`,
        detail: `High volume, low severity. One scan-to-slot rule at the pick face clears most of these — don't spend investigator time here yet.`,
        action: { label: 'View mislocations', query: 'Mislocation' },
      });
    }
  }

  // 5 · Unassigned queue
  const unassigned = unresolved.filter((d) => d.status === 'Open' && !d.owner);
  const abcA = unassigned.filter((d) => d.abc === 'A').length;
  if (unassigned.length > 0) {
    out.push({
      tone: abcA >= 5 ? 'warn' : 'info',
      title: `${unassigned.length} open items are unassigned — ${abcA} are ABC-A`,
      detail: `ABC-A velocity items age into lead-time misses when nobody owns them. Assign here; they clear two to three times faster with an owner attached.`,
      action: { label: 'View unassigned', query: 'unassigned' },
    });
  }

  return out.slice(0, 5);
}
