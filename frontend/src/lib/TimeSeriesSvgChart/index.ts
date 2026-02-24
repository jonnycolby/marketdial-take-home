/**
 * Time-series SVG line chart. Pass data and line configs (getY, color, label); chart handles rendering and animations.
 */

export { createLineChart } from "./LineChart";
export type { LineChartInstance } from "./LineChart";
export type { ChartDataPoint, LineChartOptions, LineConfig } from "./types";
export { DEFAULT_LINE_CHART_OPTIONS } from "./types";
