/**
 * Linear scale: map domain [dMin, dMax] to range [rMin, rMax].
 */
export function linearScale(
  domain: [number, number],
  range: [number, number],
): (value: number) => number {
  const [dMin, dMax] = domain;
  const [rMin, rMax] = range;
  const dSpan = dMax - dMin;
  const rSpan = rMax - rMin;
  if (dSpan === 0) return () => (rMin + rMax) / 2;
  return (value: number) => rMin + ((value - dMin) / dSpan) * rSpan;
}

/**
 * Build domain with padding. If includeZero is true and 0 is between min/max, ensure 0 is in the domain.
 */
export function paddedDomain(
  values: number[],
  paddingPercent: number = 0.08,
  includeZero?: boolean,
): [number, number] {
  if (values.length === 0) return [0, 1];
  const min = Math.min(...values);
  const max = Math.max(...values);
  let low = min;
  let high = max;
  if (includeZero && min <= 0 && max >= 0) {
    low = Math.min(min, 0);
    high = Math.max(max, 0);
  }
  const span = high - low || 1;
  const pad = span * paddingPercent;
  return [low - pad, high + pad];
}
