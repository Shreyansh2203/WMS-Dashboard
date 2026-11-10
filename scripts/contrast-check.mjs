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
const pairs = [
  ['panel #1A1815', 'faint #9B968C', '#1A1815', '#9B968C'],
  ['panel2 #1F1D1A', 'faint #9B968C', '#1F1D1A', '#9B968C'],
  ['panel3 #252320', 'faint #9B968C', '#252320', '#9B968C'],
];
for (const [n, nx, fg, bg] of pairs) console.log(cr(fg, bg).toFixed(2), '·', n);
