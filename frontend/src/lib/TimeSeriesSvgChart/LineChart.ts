import { linearScale, paddedDomain } from "./scales";
import { monotoneCubicPath } from "./monotone";
import { everyStepIndices, niceTicks } from "./ticks";
import { nearestPointIndex } from "./nearestPoint";
import {
  appendOffScreenPoints,
  copyPoints,
  easeInOut,
  expandRightPathToLength,
  lerpPoints,
  type Point,
} from "./morph";
import type { ChartDataPoint, LineChartOptions } from "./types";
import { DEFAULT_LINE_CHART_OPTIONS } from "./types";

const MORPH_DURATION_MS = 350;
const PAD_LEFT = 72;
const PAD_RIGHT = 16;
const PAD_TOP = 12;
const PAD_BOTTOM = 36;
const MIN_LABEL_WIDTH_PX = 44;
const Y_AXIS_LABEL_OFFSET = 12;

function mergeOptions<T extends ChartDataPoint>(
  opts: LineChartOptions<T>,
): LineChartOptions<T> & {
  formatYAxis: (v: number) => string;
  formatXAxis: (d: string) => string;
} {
  return {
    ...DEFAULT_LINE_CHART_OPTIONS,
    ...opts,
    formatYAxis: opts.formatYAxis ?? DEFAULT_LINE_CHART_OPTIONS.formatYAxis!,
    formatXAxis: opts.formatXAxis ?? DEFAULT_LINE_CHART_OPTIONS.formatXAxis!,
  };
}

export interface LineChartInstance<T extends ChartDataPoint = ChartDataPoint> {
  update(options: Partial<LineChartOptions<T>>): void;
  destroy(): void;
}

export function createLineChart<T extends ChartDataPoint>(
  container: HTMLElement,
  options: LineChartOptions<T>,
): LineChartInstance<T> {
  let opts = mergeOptions(options);
  let width = Math.max(200, container.clientWidth);
  let hoveredIndex: number | null = null;
  let pathPrimaryEl: SVGPathElement | null = null;
  let pathSecondaryEl: SVGPathElement | null = null;
  let morphFromPrimary: Point[] = [];
  let morphToPrimary: Point[] = [];
  let morphFromSecondary: Point[] | null = null;
  let morphToSecondary: Point[] = [];
  let animating = false;
  let morphStartTime = 0;
  let rafId = 0;
  let resizeObserver: ResizeObserver | null = null;
  /** Previous path points so we can morph when series (and thus x positions) change. */
  let lastPrimaryPoints: Point[] = [];
  let lastSecondaryPoints: Point[] | null = null;
  /** Refs to circle elements so we can animate them during morph. */
  let circlePrimaryEls: SVGCircleElement[] = [];
  let circleSecondaryEls: SVGCircleElement[] = [];
  let primaryCirclesG: SVGGElement | null = null;
  let secondaryCirclesG: SVGGElement | null = null;

  const height: number = opts.height ?? DEFAULT_LINE_CHART_OPTIONS.height ?? 280;
  const plotWidth = () => width - PAD_LEFT - PAD_RIGHT;
  const plotHeight = height - PAD_TOP - PAD_BOTTOM;

  function getYDomain(data: T[], lines: LineChartOptions<T>["lines"]) {
    const all: number[] = [];
    for (const line of lines) {
      for (const d of data) all.push(line.getY(d));
    }
    return paddedDomain(all, 0.08, opts.includeZeroLine ?? false);
  }

  function getYScale(data: T[], lines: LineChartOptions<T>["lines"]) {
    const domain = getYDomain(data, lines);
    return linearScale(domain, [PAD_TOP + plotHeight, PAD_TOP]);
  }

  function getXScale(n: number) {
    if (n <= 1) return (_i: number) => PAD_LEFT + plotWidth() / 2;
    return linearScale([0, n - 1], [PAD_LEFT, PAD_LEFT + plotWidth()]);
  }

  function getPathPoints(
    data: T[],
    lines: LineChartOptions<T>["lines"],
    yScale: (v: number) => number,
    xScale: (i: number) => number,
  ) {
    const primary = data.map((d, i) => ({
      x: xScale(i),
      y: yScale(lines[0].getY(d)),
    }));
    const secondLine = lines.length > 1 ? lines[1] : null;
    const secondary = secondLine
      ? data.map((d, i) => ({
          x: xScale(i),
          y: yScale(secondLine.getY(d)),
        }))
      : null;
    return { primary, secondary };
  }

  function getXTickIndices(n: number) {
    if (n <= 1) return [0];
    const maxLabels = Math.max(2, Math.min(n, Math.floor(plotWidth() / MIN_LABEL_WIDTH_PX)));
    const step = Math.max(1, Math.ceil(n / maxLabels));
    return everyStepIndices(n, step);
  }

  function onPointerMove(e: PointerEvent) {
    const svgEl = container.querySelector("svg");
    const rect = svgEl
      ? (svgEl.getBoundingClientRect() as DOMRect)
      : container.getBoundingClientRect();
    const chartX = e.clientX - rect.left;
    const idx = nearestPointIndex(chartX, PAD_LEFT, opts.data.length, width, PAD_RIGHT);
    if (idx !== hoveredIndex) {
      hoveredIndex = idx;
      if (opts.data.length > 0 && !animating) render();
    }
    const point = opts.data[idx] ?? null;
    opts.onPointHover?.(idx, point, e.clientX, e.clientY);
  }

  function onPointerLeave() {
    if (hoveredIndex === null) return;
    hoveredIndex = null;
    opts.onPointHover?.(null, null, 0, 0);
    if (opts.data.length > 0 && !animating) render();
  }

  function renderPathsOnly(dPrimary: string, dSecondary: string) {
    if (pathPrimaryEl) pathPrimaryEl.setAttribute("d", dPrimary);
    if (pathSecondaryEl) {
      pathSecondaryEl.setAttribute("d", dSecondary);
      pathSecondaryEl.style.display = dSecondary ? "" : "none";
    }
  }

  function updateCirclePositions(primaryPoints: Point[], secondaryPoints: Point[] | null) {
    primaryPoints.forEach((p, i) => {
      const el = circlePrimaryEls[i];
      if (el) {
        el.setAttribute("cx", String(p.x));
        el.setAttribute("cy", String(p.y));
      }
    });
    if (secondaryPoints && secondaryPoints.length > 0) {
      secondaryPoints.forEach((p, i) => {
        const el = circleSecondaryEls[i];
        if (el) {
          el.setAttribute("cx", String(p.x));
          el.setAttribute("cy", String(p.y));
        }
      });
    }
  }

  /** Ensure we have exactly nPrimary and nSecondary (if needed) circles for morphing. */
  function ensureMorphCircles(nPrimary: number, nSecondary: number | null) {
    const colorPrimary = opts.lines[0]?.color ?? "var(--color-slate-900)";
    const colorSecondary = opts.lines[1]?.color ?? "var(--color-slate-400)";

    if (!primaryCirclesG) return;

    while (circlePrimaryEls.length < nPrimary) {
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("r", "3.5");
      circle.setAttribute("fill", "white");
      circle.setAttribute("stroke", colorPrimary);
      circle.setAttribute("stroke-width", "2.5");
      circle.setAttribute("cx", "0");
      circle.setAttribute("cy", "0");
      primaryCirclesG.appendChild(circle);
      circlePrimaryEls.push(circle);
    }
    while (circlePrimaryEls.length > nPrimary) {
      const el = circlePrimaryEls.pop()!;
      el.remove();
    }

    if (nSecondary != null && secondaryCirclesG) {
      while (circleSecondaryEls.length < nSecondary) {
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("r", "3");
        circle.setAttribute("fill", "white");
        circle.setAttribute("stroke", colorSecondary);
        circle.setAttribute("stroke-width", "2");
        circle.setAttribute("cx", "0");
        circle.setAttribute("cy", "0");
        secondaryCirclesG.appendChild(circle);
        circleSecondaryEls.push(circle);
      }
      while (circleSecondaryEls.length > nSecondary) {
        const el = circleSecondaryEls.pop()!;
        el.remove();
      }
    }
  }

  function runMorph(
    fromPrimary: Point[],
    toPrimary: Point[],
    fromSecondary: Point[] | null,
    toSecondary: Point[],
  ) {
    animating = true;
    morphFromPrimary = fromPrimary;
    morphToPrimary = toPrimary;
    morphFromSecondary = fromSecondary;
    morphToSecondary = toSecondary;
    morphStartTime = performance.now();

    const nSecondary = fromSecondary && fromSecondary.length > 0 ? fromPrimary.length : null;
    ensureMorphCircles(fromPrimary.length, nSecondary);

    function tick(now: number) {
      const elapsed = now - morphStartTime;
      const t = Math.min(1, elapsed / MORPH_DURATION_MS);
      const eased = easeInOut(t);

      const lerpedPrimary = lerpPoints(morphFromPrimary, morphToPrimary, eased);
      const dPrimary = monotoneCubicPath(lerpedPrimary);
      const lerpedSecondary =
        morphFromSecondary && morphFromSecondary.length > 0
          ? lerpPoints(morphFromSecondary, morphToSecondary, eased)
          : [];
      const dSecondary =
        morphFromSecondary && morphFromSecondary.length > 0
          ? monotoneCubicPath(lerpedSecondary)
          : "";

      renderPathsOnly(dPrimary, dSecondary);
      updateCirclePositions(lerpedPrimary, lerpedSecondary.length > 0 ? lerpedSecondary : null);

      if (t >= 1) {
        animating = false;
        morphFromSecondary = null;
        render();
        return;
      }
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
  }

  function render() {
    const data = opts.data;
    const lines = opts.lines;
    if (data.length === 0) {
      container.innerHTML = "";
      pathPrimaryEl = null;
      pathSecondaryEl = null;
      circlePrimaryEls = [];
      circleSecondaryEls = [];
      primaryCirclesG = null;
      secondaryCirclesG = null;
      return;
    }

    const yScale = getYScale(data, lines);
    const xScale = getXScale(data.length);
    const yDomain = getYDomain(data, lines);
    const yTicks = niceTicks(yDomain[0], yDomain[1], 6);
    const zeroY =
      (opts.includeZeroLine ?? false) && 0 >= yDomain[0] && 0 <= yDomain[1] ? yScale(0) : null;
    const xTickIndices = getXTickIndices(data.length);

    const { primary: primaryPoints, secondary: secondaryPoints } = getPathPoints(
      data,
      lines,
      yScale,
      xScale,
    );
    lastPrimaryPoints = copyPoints(primaryPoints);
    lastSecondaryPoints = secondaryPoints ? copyPoints(secondaryPoints) : null;
    const dPrimary = monotoneCubicPath(primaryPoints);
    const dSecondary = secondaryPoints ? monotoneCubicPath(secondaryPoints) : "";
    const showSecondary = lines.length > 1;

    const formatY = (v: number) => opts.formatYAxis?.(v) ?? "";
    const formatX = (date: string) => opts.formatXAxis?.(date) ?? "";

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "absolute left-0 top-0 overflow-visible");
    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(height));
    svg.setAttribute("aria-label", "Line chart");

    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    svg.appendChild(defs);

    const gridG = document.createElementNS("http://www.w3.org/2000/svg", "g");
    gridG.setAttribute("class", "text-slate-300");
    gridG.style.strokeOpacity = "0.4";
    yTicks.forEach((t) => {
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", String(PAD_LEFT));
      line.setAttribute("x2", String(width - PAD_RIGHT));
      line.setAttribute("y1", String(yScale(t)));
      line.setAttribute("y2", String(yScale(t)));
      line.setAttribute("stroke", "currentColor");
      line.setAttribute("stroke-width", "1");
      gridG.appendChild(line);
    });
    svg.appendChild(gridG);

    if (zeroY != null) {
      const zeroLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
      zeroLine.setAttribute("x1", String(PAD_LEFT));
      zeroLine.setAttribute("x2", String(width - PAD_RIGHT));
      zeroLine.setAttribute("y1", String(zeroY));
      zeroLine.setAttribute("y2", String(zeroY));
      zeroLine.setAttribute(
        "stroke",
        opts.colorZero ?? DEFAULT_LINE_CHART_OPTIONS.colorZero ?? "var(--color-slate-400)",
      );
      zeroLine.setAttribute("stroke-width", "1");
      zeroLine.setAttribute("stroke-dasharray", "4");
      zeroLine.style.opacity = "0.7";
      svg.appendChild(zeroLine);
    }

    const path1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const line1 = lines[0];
    path1.setAttribute("d", dPrimary);
    path1.setAttribute("fill", "none");
    path1.setAttribute("stroke", line1.color);
    path1.setAttribute("stroke-width", String(line1.strokeWidth ?? 2.5));
    path1.setAttribute("stroke-linecap", "round");
    path1.setAttribute("stroke-linejoin", "round");
    if (line1.strokeDasharray) path1.setAttribute("stroke-dasharray", line1.strokeDasharray);
    svg.appendChild(path1);
    pathPrimaryEl = path1;

    const path2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const line2 = lines[1];
    path2.setAttribute("d", dSecondary);
    path2.setAttribute("fill", "none");
    path2.setAttribute("stroke", line2?.color ?? "var(--color-slate-400)");
    path2.setAttribute("stroke-width", String(line2?.strokeWidth ?? 2));
    path2.setAttribute("stroke-dasharray", line2?.strokeDasharray ?? "6 4");
    path2.setAttribute("stroke-linecap", "round");
    path2.setAttribute("stroke-linejoin", "round");
    if (!showSecondary) path2.style.display = "none";
    svg.appendChild(path2);
    pathSecondaryEl = path2;

    circlePrimaryEls = [];
    circleSecondaryEls = [];
    const primaryG = document.createElementNS("http://www.w3.org/2000/svg", "g");
    primaryCirclesG = primaryG;
    const secondaryG = document.createElementNS("http://www.w3.org/2000/svg", "g");
    secondaryCirclesG = showSecondary ? secondaryG : null;

    data.forEach((d, i) => {
      const yVal = lines[0].getY(d);
      const cx = xScale(i);
      const cy = yScale(yVal);
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      const r = hoveredIndex === i ? 5 : 3.5;
      circle.setAttribute("cx", String(cx));
      circle.setAttribute("cy", String(cy));
      circle.setAttribute("r", String(r));
      circle.setAttribute("fill", "white");
      circle.setAttribute("stroke", lines[0].color);
      circle.setAttribute("stroke-width", hoveredIndex === i ? "3" : "2.5");
      primaryG.appendChild(circle);
      circlePrimaryEls.push(circle);

      if (showSecondary && lines[1]) {
        const y2 = yScale(lines[1].getY(d));
        const circle2 = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle2.setAttribute("cx", String(cx));
        circle2.setAttribute("cy", String(y2));
        circle2.setAttribute("r", String(hoveredIndex === i ? 4 : 3));
        circle2.setAttribute("fill", "white");
        circle2.setAttribute("stroke", lines[1].color);
        circle2.setAttribute("stroke-width", "2");
        secondaryG.appendChild(circle2);
        circleSecondaryEls.push(circle2);
      }
    });
    svg.appendChild(primaryG);
    if (showSecondary) svg.appendChild(secondaryG);

    if (hoveredIndex != null) {
      const vLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
      const x = xScale(hoveredIndex);
      vLine.setAttribute("x1", String(x));
      vLine.setAttribute("x2", String(x));
      vLine.setAttribute("y1", String(PAD_TOP));
      vLine.setAttribute("y2", String(PAD_TOP + plotHeight));
      vLine.setAttribute(
        "stroke",
        opts.colorZero ?? DEFAULT_LINE_CHART_OPTIONS.colorZero ?? "var(--color-slate-400)",
      );
      vLine.setAttribute("stroke-width", "1");
      vLine.setAttribute("stroke-dasharray", "2 2");
      vLine.style.opacity = "0.6";
      svg.appendChild(vLine);
    }

    const yLabelsG = document.createElementNS("http://www.w3.org/2000/svg", "g");
    yLabelsG.setAttribute("class", "fill-slate-500 text-slate-600");
    yLabelsG.setAttribute("font-size", "11");
    yLabelsG.setAttribute("font-family", "inherit");
    yTicks.forEach((t) => {
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", String(PAD_LEFT - Y_AXIS_LABEL_OFFSET));
      text.setAttribute("y", String(yScale(t)));
      text.setAttribute("text-anchor", "end");
      text.setAttribute("dominant-baseline", "middle");
      text.textContent = formatY(t) || "";
      yLabelsG.appendChild(text);
    });
    svg.appendChild(yLabelsG);

    const xLabelsG = document.createElementNS("http://www.w3.org/2000/svg", "g");
    xLabelsG.setAttribute("class", "fill-slate-500 text-slate-600");
    xLabelsG.setAttribute("font-size", "11");
    xLabelsG.setAttribute("font-family", "inherit");
    xTickIndices.forEach((idx) => {
      const pt = data[idx];
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", String(xScale(idx)));
      text.setAttribute("y", String(height - PAD_BOTTOM + 18));
      text.setAttribute("text-anchor", "middle");
      text.textContent = pt ? formatX(pt.date) || "" : "";
      xLabelsG.appendChild(text);
    });
    svg.appendChild(xLabelsG);

    const overlayRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    overlayRect.setAttribute("x", "0");
    overlayRect.setAttribute("y", "0");
    overlayRect.setAttribute("width", String(width));
    overlayRect.setAttribute("height", String(height));
    overlayRect.setAttribute("fill", "transparent");
    overlayRect.setAttribute("pointer-events", "all");
    overlayRect.setAttribute("aria-hidden", "true");
    svg.appendChild(overlayRect);

    const wrapper = document.createElement("div");
    wrapper.className = "relative w-full overflow-visible";
    wrapper.style.height = `${height}px`;
    wrapper.appendChild(svg);

    container.innerHTML = "";
    container.appendChild(wrapper);
  }

  function resize() {
    width = Math.max(200, container.clientWidth);
    if (opts.data.length > 0 && !animating) render();
  }

  const instance: LineChartInstance<T> = {
    update(newOpts) {
      const prevData = opts.data;
      const prevLines = opts.lines;
      opts = mergeOptions({ ...opts, ...newOpts } as LineChartOptions<T>);
      if (opts.data.length === 0) {
        lastPrimaryPoints = [];
        lastSecondaryPoints = null;
        circlePrimaryEls = [];
        circleSecondaryEls = [];
        primaryCirclesG = null;
        secondaryCirclesG = null;
        container.innerHTML = "";
        pathPrimaryEl = null;
        pathSecondaryEl = null;
        return;
      }
      const data = opts.data;
      const lines = opts.lines;
      const dataChanged = prevData.length !== data.length || prevData.some((p, i) => data[i] !== p);
      const linesChanged =
        newOpts.lines != null &&
        (prevLines.length !== lines.length ||
          prevLines[0] !== lines[0] ||
          prevLines[1] !== lines[1]);

      if (
        linesChanged &&
        data.length > 0 &&
        lastPrimaryPoints.length > 0 &&
        pathPrimaryEl &&
        !animating
      ) {
        const yScaleFrom = getYScale(prevData, prevLines);
        const xScaleFrom = getXScale(prevData.length);
        const fromPaths = getPathPoints(prevData, prevLines, yScaleFrom, xScaleFrom);
        const yScaleTo = getYScale(data, lines);
        const xScaleTo = getXScale(data.length);
        const toPaths = getPathPoints(data, lines, yScaleTo, xScaleTo);
        const fromPrimary = copyPoints(fromPaths.primary);
        // When going 1→2: both new lines start from the same path (fromPrimary duplicated).
        // When going 2→1: both old lines converge into the single new path (toPrimary duplicated for secondary target).
        const fromSecondary = fromPaths.secondary
          ? copyPoints(fromPaths.secondary)
          : copyPoints(fromPaths.primary);
        const toSecondary = lines.length > 1 ? toPaths.secondary! : toPaths.primary;
        runMorph(fromPrimary, toPaths.primary, fromSecondary, toSecondary);
        return;
      }

      if (dataChanged && lastPrimaryPoints.length > 0 && pathPrimaryEl && !animating) {
        const yScale = getYScale(data, lines);
        const xScale = getXScale(data.length);
        const { primary: toPrimaryRaw, secondary: toSecondaryRaw } = getPathPoints(
          data,
          lines,
          yScale,
          xScale,
        );
        const nFrom = lastPrimaryPoints.length;
        const nTo = toPrimaryRaw.length;
        const xLeft = PAD_LEFT;
        const xRight = PAD_LEFT + plotWidth();

        let fromP: Point[];
        let toP: Point[];
        let fromS: Point[] | null;
        let toS: Point[];

        if (nFrom > nTo) {
          fromP = copyPoints(lastPrimaryPoints);
          toP = expandRightPathToLength(toPrimaryRaw, nFrom, nTo, xLeft, xRight);
          fromS =
            lastSecondaryPoints && lastSecondaryPoints.length > 0
              ? copyPoints(lastSecondaryPoints)
              : null;
          toS =
            toSecondaryRaw && toSecondaryRaw.length > 0
              ? expandRightPathToLength(toSecondaryRaw, nFrom, nTo, xLeft, xRight)
              : toP.map((p) => ({ ...p }));
        } else if (nFrom < nTo) {
          const lastY = lastPrimaryPoints[lastPrimaryPoints.length - 1]?.y ?? 0;
          fromP = appendOffScreenPoints(lastPrimaryPoints, nTo - nFrom, xRight + 20, lastY, 40);
          toP = copyPoints(toPrimaryRaw);
          const lastSY = lastSecondaryPoints?.[lastSecondaryPoints.length - 1]?.y ?? 0;
          fromS =
            lastSecondaryPoints && lastSecondaryPoints.length > 0
              ? appendOffScreenPoints(lastSecondaryPoints, nTo - nFrom, xRight + 20, lastSY, 40)
              : null;
          toS =
            toSecondaryRaw && toSecondaryRaw.length > 0
              ? copyPoints(toSecondaryRaw)
              : toP.map((p) => ({ ...p }));
        } else {
          fromP = copyPoints(lastPrimaryPoints);
          toP = copyPoints(toPrimaryRaw);
          fromS =
            lastSecondaryPoints && lastSecondaryPoints.length > 0
              ? copyPoints(lastSecondaryPoints)
              : null;
          toS =
            toSecondaryRaw && toSecondaryRaw.length > 0
              ? copyPoints(toSecondaryRaw)
              : toP.map((p) => ({ ...p }));
        }

        runMorph(fromP, toP, fromS, toS);
        return;
      }
      render();
    },

    destroy() {
      if (rafId) cancelAnimationFrame(rafId);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerleave", onPointerLeave);
      container.innerHTML = "";
      pathPrimaryEl = null;
      pathSecondaryEl = null;
      circlePrimaryEls = [];
      circleSecondaryEls = [];
      primaryCirclesG = null;
      secondaryCirclesG = null;
      resizeObserver = null;
    },
  };

  if (opts.data.length > 0) render();

  container.addEventListener("pointermove", onPointerMove);
  container.addEventListener("pointerleave", onPointerLeave);
  resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);

  return instance;
}
