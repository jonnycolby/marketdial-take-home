export interface Point {
  x: number;
  y: number;
}

export function copyPoints(pts: Point[]): Point[] {
  return pts.map((p) => ({ x: p.x, y: p.y }));
}

export function lerpPoints(from: Point[], to: Point[], t: number): Point[] {
  return from.map((p, i) => ({
    x: p.x + (to[i]!.x - p.x) * t,
    y: p.y + (to[i]!.y - p.y) * t,
  }));
}

/** Cumulative distance from first point to each point. */
function pathDistances(pts: Point[]): number[] {
  const out: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    out.push(out[i - 1]! + Math.hypot(b.x - a.x, b.y - a.y));
  }
  return out;
}

/** Get point at normalized distance t (0..1) along the path. */
function pointAtPathT(pts: Point[], t: number): Point {
  if (pts.length <= 1) return pts[0] ?? { x: 0, y: 0 };
  const dists = pathDistances(pts);
  const total = dists[dists.length - 1]!;
  if (total === 0) return pts[0]!;
  const d = t * total;
  let idx = 0;
  while (idx < dists.length - 1 && dists[idx + 1]! < d) idx++;
  const d0 = dists[idx]!;
  const d1 = dists[idx + 1] ?? d0;
  const seg = d1 - d0;
  const u = seg > 0 ? (d - d0) / seg : 0;
  const p0 = pts[idx]!;
  const p1 = pts[idx + 1] ?? p0;
  return {
    x: p0.x + (p1.x - p0.x) * u,
    y: p0.y + (p1.y - p0.y) * u,
  };
}

/**
 * Stretch a path to n points: x is evenly spaced from xLeft to xRight (last point at right),
 * y is interpolated along the path. Use when the NEW data has fewer points — we animate
 * the old (longer) line shrinking so the last point lands at the right, then remove the rest.
 */
export function stretchPathToLength(
  path: Point[],
  n: number,
  xLeft: number,
  xRight: number,
): Point[] {
  if (n <= 0) return [];
  if (path.length <= 1) {
    const p = path[0] ?? { x: xLeft, y: 0 };
    const y = p.y;
    return Array.from({ length: n }, (_, i) => ({
      x: n === 1 ? xLeft : xLeft + (i / (n - 1)) * (xRight - xLeft),
      y,
    }));
  }
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0 : i / (n - 1);
    const p = pointAtPathT(path, t);
    return {
      x: xLeft + t * (xRight - xLeft),
      y: p.y,
    };
  });
}

/**
 * For "fewer points" case when we want the line to expand right (not compress left).
 * Returns nFrom points: first nTo points are the new path stretched to full width
 * (xLeft to xRight), remaining points are stacked at (xRight, lastY) so the line
 * extends to the right and the animation moves the right side rightward.
 */
export function expandRightPathToLength(
  path: Point[],
  nFrom: number,
  nTo: number,
  xLeft: number,
  xRight: number,
): Point[] {
  if (nFrom <= 0 || path.length === 0) return [];
  const lastY = path[path.length - 1]!.y;
  const firstN = stretchPathToLength(path, nTo, xLeft, xRight);
  const extra = nFrom - nTo;
  if (extra <= 0) return firstN;
  const atRight = Array.from({ length: extra }, () => ({ x: xRight, y: lastY }));
  return [...firstN, ...atRight];
}

/**
 * Append points off-screen to the right so the path has path.length + count points.
 * Use when the NEW data has more points — we animate the extra points from off-screen
 * into the chart so they fit in the available x space.
 */
export function appendOffScreenPoints(
  path: Point[],
  count: number,
  xStart: number,
  yValue: number,
  stepPx?: number,
): Point[] {
  if (count <= 0) return [...path];
  const step = stepPx ?? 40;
  const extra = Array.from({ length: count }, (_, i) => ({
    x: xStart + (i + 1) * step,
    y: yValue,
  }));
  return [...path, ...extra];
}

export function easeInOut(t: number): number {
  return t * t * (3 - 2 * t);
}
