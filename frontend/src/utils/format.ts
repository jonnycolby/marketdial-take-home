/** Format number as USD, e.g. $12,340.50 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Format currency so negative is -$X not $-X, e.g. -$192,406.00 */
export function formatCurrencyWithSign(value: number): string {
  const abs = Math.abs(value);
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs);
  return value < 0 ? `-$${formatted}` : `$${formatted}`;
}

/** Format delta with sign: +$320.12 or -$50.00 */
export function formatDelta(value: number): string {
  const formatted = formatCurrency(Math.abs(value));
  return value >= 0 ? `+${formatted}` : `-${formatted}`;
}

/** Format CI range for display, e.g. [-$183.64, +$400.63] */
export function formatCI(low: number, high: number): string {
  return `[${formatDelta(low)}, ${formatDelta(high)}]`;
}

/** Format a range as "Min X / Max Y" - use with formatDelta for X and Y in the template; slash in gray. */
export function formatRangeMinMax(low: number, high: number): { min: string; max: string } {
  return { min: formatDelta(low), max: formatDelta(high) };
}

/** Format YYYY-MM-DD as "Jan 12, 2026" */
export function formatDate(isoDate: string): string {
  if (!isoDate || isoDate.length < 10) return isoDate;
  const d = new Date(isoDate + "T12:00:00");
  if (Number.isNaN(d.getTime())) return isoDate;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

/** Format YYYY-MM-DD as short label, e.g. "Feb 12" */
export function formatDateLabel(isoDate: string): string {
  if (!isoDate || isoDate.length < 10) return isoDate;
  const d = new Date(isoDate + "T12:00:00");
  if (Number.isNaN(d.getTime())) return isoDate;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(d);
}

/** Format as percent, e.g. 32% */
export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
