export function nearestPointIndex(
  chartX: number,
  padLeft: number,
  pointCount: number,
  chartWidth: number,
  padRight: number,
): number {
  if (pointCount <= 0) return 0;
  const plotWidth = chartWidth - padLeft - padRight;
  const step = plotWidth / Math.max(1, pointCount - 1);
  const relativeX = chartX - padLeft;
  const rawIndex = relativeX / step;
  const idx = Math.round(rawIndex);
  return Math.max(0, Math.min(pointCount - 1, idx));
}
