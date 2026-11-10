# DESIGN.md — Recon, WMS Reconciliation Console

Incumbent visual system (v2.4). Written after the rich-pass; read this before changing anything visual.

## The world

Night-shift instrument panel on a distribution-center dock floor. **Calm, exact, a little warm.**
Graphite surfaces tinted warm (sodium-dock amber accent), IBM Plex Sans for labels + IBM Plex Mono
for every number (tabular, slashed-zero). One bright element per screen; chrome stays silent.
Scenes, not screens, of color: the accuracy chart and the figures carry it.

## Modes

Operate surface. Precision and restraint outrank expression. No hero, no imagery, no gradients-as-decoration.

## Tokens (CSS-first, `@theme` in `src/index.css`)

Primitives → semantic (all in one block, hex notation, one warm neutral ramp):

| Role | Token | Value |
| --- | --- | --- |
| Page | `--color-ink` | `#131110` |
| Card | `--color-panel` | `#1A1815` |
| Raised | `--color-panel2` | `#1F1D1A` |
| Highest | `--color-panel3` | `#252320` |
| Hairline | `--color-edge` | `#2A2723` |
| Hairline strong | `--color-edge2` | `#3B3831` |
| Text | `--color-text` | `#ECE8DF` |
| Text dim | `--color-dim` | `#ABA69B` |
| Text faint | `--color-faint` | `#9B968C` |
| Accent | `--color-amber` | `#F2B33D` (on-amber text `#1B1408`) |
| Good / Bad / Info | `--color-good/bad/info` | `#41D99A` / `#F26D5B` / `#6FA8FF` |
| Categorical (type mix) | `TYPE_STYLE` (mock.ts) | `#3987e5` Shortage · `#d95926` Overage · `#199e70` Missing · `#c98500` Mislocation · `#d55181` UOM Error (dataviz-validated dark set, adjacent-pairs; direct labels + 2px gaps) |
| Diverging (zones) | shrink/surplus | `--color-bad` / `#3987e5` with neutral midpoint — signed by construction |

Every pair above is measured ≥ 4.5:1 for its use (`scripts/contrast-check.mjs`). Never add a new
gray; extend the ramp. Semantic hues are one meaning each — good=resolved/positive, bad=shrink/critical,
info=investigating/navigation. Amber marks interaction and live status, never meaning.

Motion: `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`, `--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)`.
Durations: 100–160ms feedback, ≤250ms interactive, ≤340ms entrances (`.rise`), one-shot only.
Radii: 8 controls / 10–12 inner / 14 cards · pills only for small controls · hairline borders only,
no shadows except the floating drawer over a scrim · no gradients except the trend area tint.

## Rules the floor enforces here

- Sentence case everywhere; no tracked caps; size + color carry hierarchy; -0.02em max tracking on display.
- One icon set (lucide), 1.75 stroke, sizes 12/13/14/16/19 only.
- Numbers: Plex Mono, tabular, always signed for variance. Counts/values never re-animate on refresh —
  they tween only on user-driven range/site change.
- No border-left accent bars, no glow chips, no gradient text, no decorative grids or noise.
- Copy names actions verb-first; errors name the fix; one vocabulary per concept
  ("discrepancy queue" everywhere). Loading copy ends with "…".
- `prefers-reduced-motion`: transforms off, opacity allowed. All entrances are `.rise` once.

## Signature

The barcode-scan glyph in the amber rounded tile + keycap-styled `⌘K`/`R`/`/` hints.
It appears in the sidebar brand, the command palette trigger, and every shortcut hint. Nothing else.

## Rich moments (do not add more)

1. **Accuracy trend** — the one bright element: 2.4px line, faint fill, labeled amber target reference.
2. **KPI figures** — Plex Mono at 26px with tuned deltas vs prior window.

Everything else — tables, chips, panels — is quiet, dense, and tabular.

## Anti-references

Not a BI tool (no drag-drop charts, no gauge forests). Not a marketing dashboard. Never: gradient
cards, icon-in-every-card, sparkline-decorated stats, purple/blue accents, light theme without a new brief.
