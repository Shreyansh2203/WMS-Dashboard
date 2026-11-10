/* Measured WCAG contrast pairs for the token ramp + pill composites.
   Exits non-zero if any *required* pair fails (text 4.5, UI ≥3:1). */
const lum = (hex) => {
  const c = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const cr = (a, b) => {
  const [L1, L2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (L1 + 0.05) / (L2 + 0.05);
};
const over = (fg, alpha, bg) => {
  const p = (h) => [0, 2, 4].map((i) => parseInt(h.replace('#', '').slice(i, i + 2), 16));
  const cv = p(fg), bv = p(bg);
  const mix = (f, b) => Math.round(f * alpha + b * (1 - alpha)).toString(16).padStart(2, '0');
  return '#' + mix(cv[0], bv[0]) + mix(cv[1], bv[1]) + mix(cv[2], bv[2]);
};

const PANELS = ['#131110', '#1A1815', '#1F1D1A', '#252320'];
const TEXTS = ['#ECE8DF', '#ABA69B', '#9B968C', '#F2B33D', '#41D99A', '#F26D5B', '#6FA8FF'];

let fails = 0;
const report = (label, value, needs, verdict) => {
  const ok = value >= needs;
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${value.toFixed(2).padStart(5)} (≥${needs}) · ${label}`);
};

for (const fg of TEXTS) {
  for (const bg of PANELS) report(`${fg} on ${bg}`, cr(fg, bg), 4.5, 'text');
}
report('#1B1408 on amber #F2B33D (filled button)', cr('#1B1408', '#F2B33D'), 4.5, 'text');
report('amber #F2B33D on panel3 (active segment)', cr('#F2B33D', '#252320'), 4.5, 'text');
for (const bg of PANELS) {
  report(`focus ring amber on ${bg}`, cr('#F2B33D', bg), 3.0, 'ui');
  report(`diverge surplus #3987e5 on ${bg}`, cr('#3987e5', bg), 3.0, 'ui');
  report(`shrink #F26D5B (bar) on ${bg}`, cr('#F26D5B', bg), 3.0, 'ui');
}

// pill composites over panel2 (#1F1D1A)
const PILLS = [
  ['Open',     '#F2B33D', 'F2B33D', 0.08],
  ['High',     '#F2B33D', 'F2B33D', 0.08],
  ['Investing','#6FA8FF', '6FA8FF', 0.08],
  ['Resolved', '#41D99A', '41D99A', 0.08],
  ['Critical', '#FF8A7A', 'F26D5B', 0.10],
  ['Medium',   '#9B968C', '9B968C', 0.07],
  ['Low',      '#9B968C', '9B968C', 0.05],
  ['ABC',      '#C9C4B8', '9B968C', 0.07],
];
for (const [name, text, tint, alpha] of PILLS) {
  const bg = over('#' + tint, alpha, '#1F1D1A');
  report(`${name} pill text on tinted bg`, cr(text, bg), 4.5, 'text');
}

console.log();
if (fails) { console.error(`${fails} pair(s) failed`); process.exit(1); }
console.log('all contrast pairs pass');
