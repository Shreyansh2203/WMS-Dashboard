# Recon — WMS Reconciliation Console

A warehouse reconciliation dashboard for inventory control leads. Surfaces cycle-count
variance (system-vs-count) as value at risk, and turns the discrepancy queue into an
actionable triage workflow. Data is a deterministic seeded mock (same seed → same
warehouse), structured so any component can be swapped to a live WMS extract API.

## Run

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # production bundle in dist/
npm run preview   # serve the build
npm run typecheck
node scripts/contrast-check.mjs   # measured WCAG contrast pairs for the token ramp

# optional layout probes (Python Playwright, uses installed Chrome)
pip install playwright
python scripts/responsive-check.py    # 320–1920: overflow, tap targets, RTL, reduced motion
python scripts/mobile-interactions.py # overlay geometry at 320px (set VP=1440 for desktop)
python scripts/a11y-audit.py         # keyboard order, skip link, focus trap, ARIA contracts
python scripts/resolve-flow.py        # single-item resolution flow
python scripts/revert-check.py        # resolve -> ledger -> revert
python scripts/bulk-and-log-check.py # bulk assign/resolve + ledger revert
python scripts/forced-colors-check.py # forced-colors (Windows HC) emulation via CDP
npm run e2e                          # 14 critical assertions, exits non-zero on failure
npm run verify                        # full gate: typecheck, build, all probes, e2e
```

## Keyboard

| Key | Action |
| --- | --- |
| `⌘K` / `Ctrl K` | Toggle command palette (fuzzy: refs, SKUs, items, locations, owner, actions) |
| `/` | Focus discrepancy search |
| `R` | Force-refresh the WMS feed (stream watchdog) |
| `↑` `↓` (in table) | Move between row buttons |
| `Enter` | Open discrepancy |
| `Esc` | Close palette / drawer / popovers |

## Design direction

Unslop/impeccable direction for this surface: **calm, exact, a little warm** — a
night-shift instrument panel on a distribution-center dock floor. Graphite surfaces
tinted warm, a single sodium-amber accent reserved for interaction, and two rich
moments: the accuracy trend chart (drawn with care, target reference line) and figures
set beautifully in the KPI row. Everything else is quiet.

Principles applied (see git history / README for sources):
- **Hierarchy**: one bright element per view; stat cards are numbers only (no decorative
  sparklines); moments carried by data, chrome silent.
- **Numbers**: IBM Plex Mono, tabular slashed-zero, always signed for variance.
- **Labels**: sentence case, no tracked caps; hierarchy from size and color.
- **Elevation**: hairline borders only — no shadow-under-border cards, no gradients.
- **Type**: 12px floor for functional text (no 9–10px labels); body copy always ≥12px.
- **KPI methodology**: every card documents its formula via hover tooltip (`title`) —
  window average vs endpoint, denominator, shrink+overage sign convention, Open+Investigating snapshot.
- **Color**: categorical hues are the dataviz-validated dark set (#3987e5/#d95926/#199e70/#c98500/#d55181 — adjacent-pairs pass, direct labels + 2px segment gaps as secondary encoding); status hues are reserved for state and always paired with icon+label; zone diverging pair is bad-red/#3987e5-blue with a neutral midpoint.
- **Motion**: one authored entrance (`.rise` stagger, 340ms expo-out once), 150ms press
  feedback (`scale(0.96)`), iOS-curve drawer, no persistent loops.
- **Responsive**: no page-level horizontal scroll from 320–1920; the queue swaps to a
  native card list below 640px (targets ≥40px); desktop table scrolls inside its own
  container with Ref + actions pinned; overlays clamp to the viewport; RTL shell
  mirrors (logical properties); charts stay LTR by convention.
- **Accessibility**: 100/100/100 Lighthouse, skip link, managed focus into/out of the
  drawer and palette, focus trap, `inert` background (sidebar included) while overlays
  open, named live regions, measured contrast (scripts/contrast-check.mjs), full keyboard
  order verified (`scripts/a11y-audit.py`), `prefers-reduced-motion` fully honored,
  forced-colors (Windows High Contrast) flattened to system keywords (verified with CDP
  forced-colors emulation), every chart ships an expandable data-table disclosure, and
  the discrepancy queue swaps to a native card list below 640px.

## What's inside

- **Resolution log** — persistent ledger of posted adjustments (`recon:resolutions:v1`),
  50 entries deep, on the queue page. Every resolution appends with id, value, root
  cause, resolver and timestamp; any entry can be `Revert`ed, which also undoes the
  override and marks the entry reverted rather than erasing it.
- **Overview** — 5 KPIs with explicit scope (accuracy = window avg, booked variance =
  window total, unresolved = now) set against the 98.5% target; accuracy trend with
  dashed prior, target line, endpoint marker; variance composition by type (100%
  composition bar, not a pie); diverging shrink/surplus bars per zone; actionable signals
  (jump to a pre-filtered queue); highest-value window-scoped unresolved items. Every
  chart carries an expandable `Data table` disclosure with the full underlying series.
  All aggregate cards honour the analysis window; "Unresolved · now" stays the live
  snapshot.- **Discrepancy queue** — sticky header + pinned Ref (pinned right actions); Value/Var qty
  visible on narrow widths; **row selection with bulk assign / bulk resolve / export**
  (bulk resolve is root-cause-gated and posts to GL 5310 once); CSV export of any filter,
  selection or view; type/zone/severity/status filters plus unassigned / age>48h chips;
  unassigned and zone-code search; centered Sev/Status; sortable columns; pagination;
  arrow-key row navigation; **phone gets a card list** below 640px; deep-linkable
  (`?view=discrepancies&site=atl-01`).
- **Command palette** — fuzzy search across discrepancies, navigation, warehouse
  switching, and actions (force refresh, CSV export, open first critical, range); focus
  trap; Escape restores focus to the invoker.
- **Stream watchdog** — live/stale/offline freshness pill (4-tier: Live → Syncing → Stale →
  Offline) with popover (source, rows applied, last packet, SLA) and force-refresh with
  recovery toast; window-focus re-sync; exponential backoff (`2s→30s`) while offline;
  shell-wide non-blocking freshness banner when past SLA; `R` to refresh.
- **Detail drawer** — system vs counted vs variance, variance value, per-SKU count
  history, progress timeline, inline owner assignment, and a root-cause-gated Mark
  resolved flow (variance posts to GL 5310) with undo; Copy ref. Status/owner/root
  cause persist to `localStorage` (`recon:overrides:v2`).

## Layout of the code

```
src/
  data/mock.ts          seeded generator + derived stats (window summary, zone/type stats, insights)
  views/                Overview, Discrepancies
  components/           Sidebar, TopBar, StreamWatchdog, CommandPalette, KpiStrip,
                        AccuracyTrend, TypeMix, ZoneVariance, Insights,
                        DiscrepancyTable, DetailDrawer, Toast, ChartCard, ChartTooltip
  lib/                  format, useTween, exportCsv, platform, resolutionLog, useFocusTrap, useMediaQuery
scripts/contrast-check.mjs
scripts/responsive-check.py
scripts/mobile-interactions.py
scripts/a11y-audit.py
scripts/resolve-flow.py
scripts/bulk-and-log-check.py
scripts/worst-case-mobile.py
```
