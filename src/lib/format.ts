const intFmt = new Intl.NumberFormat('en-US');
const moneyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const money2Fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtInt = (n: number) => intFmt.format(Math.round(n));
export const fmtMoney = (n: number) => moneyFmt.format(n);
export const fmtMoney2 = (n: number) => money2Fmt.format(n);

/** $24.3K / $1.2M style compact for chart axes and tight cards */
export const fmtMoneyCompact = (n: number) => {
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
};

export const fmtSigned = (n: number) => (n > 0 ? `+${fmtInt(n)}` : n < 0 ? `−${fmtInt(Math.abs(n))}` : '0');
export const fmtSignedMoney = (n: number) => (n >= 0 ? `+${fmtMoney(n)}` : `−${fmtMoney(Math.abs(n))}`);

export const fmtPct = (n: number, digits = 1) => `${n.toFixed(digits)}%`;
export const fmtSignedPts = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(2)} pts`;

export const timeAgo = (ts: number) => {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export const fmtDate = (ts: number) =>
  new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export const fmtDateFull = (ts: number) =>
  new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Signed variance with explicit direction word for screen readers */
export const varWord = (n: number) => (n < 0 ? 'shortage' : n > 0 ? 'overage' : 'no variance');
