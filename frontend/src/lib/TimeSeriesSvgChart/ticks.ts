export function niceTicks(domainMin: number, domainMax: number, maxTicks: number = 6): number[] {
  const span = domainMax - domainMin;
  if (span <= 0) return [domainMin];
  const rawStep = span / (maxTicks - 1);
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  const step = (norm <= 1.5 ? 1 : norm <= 3 ? 2 : norm <= 7 ? 5 : 10) * mag;
  const start = Math.ceil(domainMin / step) * step;
  const out: number[] = [];
  for (let v = start; v <= domainMax + step * 0.001; v += step) {
    out.push(Number(v.toPrecision(12)));
  }
  return out.length ? out : [domainMin];
}

export function everyStepIndices(pointCount: number, step: number): number[] {
  if (pointCount <= 0 || step <= 0) return [];
  if (step === 1) return Array.from({ length: pointCount }, (_, i) => i);
  const indices: number[] = [];
  for (let i = 0; i < pointCount; i += step) {
    indices.push(i);
  }
  return indices;
}
