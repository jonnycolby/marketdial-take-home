/**
 * Monotone cubic interpolation (Fritsch-Carlson style).
 * Returns SVG path d string: M x0 y0 C ... C ...
 */

interface Point {
  x: number;
  y: number;
}

function slope(p0: Point, p1: Point): number {
  const dx = p1.x - p0.x;
  if (dx === 0) return 0;
  return (p1.y - p0.y) / dx;
}

export function monotoneCubicPath(points: Point[]): string {
  const n = points.length;
  if (n === 0) return "";
  const p0 = points[0];
  if (!p0) return "";
  if (n === 1) return `M ${p0.x} ${p0.y}`;
  const p1 = points[1];
  if (n === 2 && p1) return `M ${p0.x} ${p0.y} L ${p1.x} ${p1.y}`;

  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (a && b) slopes.push(slope(a, b));
  }

  const tangents: number[] = [];
  for (let i = 0; i < n; i++) {
    if (i === 0) {
      tangents.push(slopes[0] ?? 0);
    } else if (i === n - 1) {
      tangents.push(slopes[n - 2] ?? 0);
    } else {
      const s0 = slopes[i - 1];
      const s1 = slopes[i];
      const pi = points[i];
      const piMinus = points[i - 1];
      const piPlus = points[i + 1];
      if (s0 === undefined || s1 === undefined || !pi || !piMinus || !piPlus) {
        tangents.push(0);
      } else if (s0 * s1 <= 0) {
        tangents.push(0);
      } else {
        const h0 = pi.x - piMinus.x;
        const h1 = piPlus.x - pi.x;
        const t = (h0 + h1) / (h0 / s0 + h1 / s1);
        tangents.push(t);
      }
    }
  }

  for (let i = 0; i < n - 1; i++) {
    const s = slopes[i] ?? 0;
    const t0 = tangents[i] ?? 0;
    const t1 = tangents[i + 1] ?? 0;
    if (s === 0) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
    } else {
      const maxTan = 3 * Math.abs(s);
      if (Math.abs(t0) > maxTan) tangents[i] = t0 > 0 ? maxTan : -maxTan;
      if (Math.abs(t1) > maxTan) tangents[i + 1] = t1 > 0 ? maxTan : -maxTan;
    }
  }

  const parts: string[] = [];
  parts.push(`M ${p0.x} ${p0.y}`);
  for (let i = 0; i < n - 1; i++) {
    const pa = points[i];
    const pb = points[i + 1];
    const t0 = tangents[i] ?? 0;
    const t1 = tangents[i + 1] ?? 0;
    if (!pa || !pb) continue;
    const dx = (pb.x - pa.x) / 3;
    const cp1x = pa.x + dx;
    const cp1y = pa.y + t0 * dx;
    const cp2x = pb.x - dx;
    const cp2y = pb.y - t1 * dx;
    parts.push(`C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${pb.x} ${pb.y}`);
  }
  return parts.join(" ");
}
