# TimeSeriesSvgChart

A small **custom time-series SVG line chart** library used in this app instead of ApexCharts (or similar). It does exactly what we need: one or two lines over date-based data, with configurable axes, hover, and smooth morphing when data or series change.

## Where it’s used

- **`DataChartJonny.vue`** — Renders the “Average delta” and “Actual vs expected revenue” charts in the main dashboard.
- Those components are mounted in **`App.vue`** in the “Charts” section (alongside `DataChart`).

## API overview

- **Create:** `createLineChart<T>(container: HTMLElement, options: LineChartOptions<T>): LineChartInstance<T>`
- **Update:** `instance.update(partialOptions)` — e.g. when data or filters change.
- **Cleanup:** `instance.destroy()` — call in `onUnmounted` (or equivalent).

Data points must have at least a `date` (string). Each line is defined by a **`LineConfig`**: `getY(point)`, `color`, optional `label`, `strokeDasharray`, `strokeWidth`. You pass `data` and either one or two line configs; the chart handles scales, axes, path rendering, and optional hover via `onPointHover`.

## Exports

From `./index`:

- `createLineChart`, `LineChartInstance`
- Types: `ChartDataPoint`, `LineChartOptions`, `LineConfig`
- `DEFAULT_LINE_CHART_OPTIONS`

Framework-agnostic (plain TypeScript); the Vue component owns the container ref, creates the chart on mount/watch, and destroys it on unmount.
