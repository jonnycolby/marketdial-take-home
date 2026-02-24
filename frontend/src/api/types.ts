/** One store-day result row from GET /results */
export interface ResultRow {
  store_id: string;
  region: string;
  date: string;
  baseline_revenue: number;
  actual_revenue: number;
  delta: number;
  ci_low: number;
  ci_high: number;
  transactions: number;
  uncertain: boolean;
  notes: string | null;
}

/** GET /results response */
export interface ResultsResponse {
  page: number;
  page_size: number;
  total: number;
  results: ResultRow[];
}

/** One point in summary.delta_over_time (chart series) */
export interface DeltaOverTimePoint {
  date: string;
  avg_delta: number;
  count: number;
  /** Avg actual revenue (from backend when available) */
  avg_actual?: number;
  /** Avg expected/baseline revenue (from backend when available) */
  avg_expected?: number;
  /** Share of rows for this date where CI crosses 0 (0-1) */
  uncertain_rate?: number;
}

/** One excluded outlier reported by GET /summary */
export interface OutlierWarning {
  date: string;
  store_id: string;
  region: string;
  reason: string;
}

/** GET /summary response */
export interface SummaryResponse {
  total: number;
  delta: { min: number; max: number; avg: number };
  uncertain_rate: number;
  regions: { region: string; count: number }[];
  delta_over_time: DeltaOverTimePoint[];
  /** When exclude_outliers was used and some rows were excluded */
  outlier_warnings?: OutlierWarning[];
  /** Total rows before excluding outliers (only when outlier_warnings.length > 0) */
  total_full?: number;
}
