/** Data point needs at least a date; each line uses getY(point) for values. */
export interface ChartDataPoint {
  date: string;
}

/** Config for one line: what to plot and how it looks. */
export interface LineConfig<T extends ChartDataPoint = ChartDataPoint> {
  getY: (point: T) => number;
  color: string;
  label?: string;
  strokeDasharray?: string; // e.g. "6 4" for dashed
  strokeWidth?: number;
}

/** Options for creating/updating the chart. Data + 1 or 2 line configs. */
export interface LineChartOptions<T extends ChartDataPoint = ChartDataPoint> {
  data: T[];
  lines: [LineConfig<T>] | [LineConfig<T>, LineConfig<T>];
  height?: number;
  includeZeroLine?: boolean;
  colorZero?: string;
  formatYAxis?: (value: number) => string;
  formatXAxis?: (date: string) => string;
  onPointHover?: (index: number | null, point: T | null, clientX: number, clientY: number) => void;
}

const defaultFormatY = (v: number) =>
  v >= 0 ? `+$${v.toFixed(2)}` : `-$${Math.abs(v).toFixed(2)}`;

export const DEFAULT_LINE_CHART_OPTIONS: Partial<LineChartOptions<ChartDataPoint>> = {
  height: 280,
  colorZero: "var(--color-slate-400)",
  formatYAxis: defaultFormatY,
  formatXAxis: (d) => d,
  includeZeroLine: false,
};
