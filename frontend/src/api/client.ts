import type { ResultsResponse, SummaryResponse } from "./types";

const getBase = (): string =>
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export interface ResultsParams {
  region?: string;
  store_id?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_dir?: string;
  uncertain_only?: boolean;
}

export interface SummaryParams {
  region?: string;
  store_id?: string;
  start_date?: string;
  end_date?: string;
  exclude_outliers?: boolean; // default true: backend excludes outlier store-days from chart/summary
}

function searchParams(
  params: Record<string, string | number | boolean | undefined>
): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === "") continue;
    p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export async function fetchResults(
  params: ResultsParams
): Promise<ResultsResponse> {
  const base = getBase();
  const query = searchParams({
    region: params.region,
    store_id: params.store_id,
    start_date: params.start_date,
    end_date: params.end_date,
    page: params.page ?? 1,
    page_size: params.page_size ?? 25,
    sort_by: params.sort_by,
    sort_dir: params.sort_dir,
    uncertain_only: params.uncertain_only,
  });
  const res = await fetch(`${base}/results${query}`);
  if (!res.ok) {
    const msg = await getErrorMessage(res, "Results");
    throw new Error(msg);
  }
  return res.json();
}

export async function fetchSummary(
  params: SummaryParams
): Promise<SummaryResponse> {
  const base = getBase();
  const query = searchParams({
    region: params.region,
    store_id: params.store_id,
    start_date: params.start_date,
    end_date: params.end_date,
    exclude_outliers: params.exclude_outliers,
  });
  const res = await fetch(`${base}/summary${query}`);
  if (!res.ok) {
    const msg = await getErrorMessage(res, "Summary");
    throw new Error(msg);
  }
  return res.json();
}

async function getErrorMessage(res: Response, prefix: string): Promise<string> {
  const text = await res.text();
  try {
    const json = JSON.parse(text) as { detail?: string | { msg?: string }[] };
    if (typeof json.detail === "string") return `${prefix}: ${json.detail}`;
    if (Array.isArray(json.detail) && json.detail[0]?.msg)
      return `${prefix}: ${json.detail[0].msg}`;
  } catch {
    // ignore
  }
  if (text) return `${prefix}: ${text.slice(0, 200)}`;
  return `${prefix}: ${res.status} ${res.statusText}`;
}
