import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { fetchResults, fetchSummary, type ResultsParams, type SummaryParams } from "../api/client";
import type { ResultRow, SummaryResponse } from "../api/types";

export interface FilterState {
  region: string;
  store_id: string;
  start_date: string;
  end_date: string;
}

const defaultFilters: FilterState = {
  region: "",
  store_id: "",
  start_date: "",
  end_date: "",
};

export const useRevenueStore = defineStore("revenue", () => {
  const filters = ref<FilterState>({ ...defaultFilters });
  const appliedFilters = ref<FilterState>({ ...defaultFilters });
  const page = ref(1);
  const pageSize = ref(25);

  const regions = ref<string[]>([]);
  const summary = ref<SummaryResponse | null>(null);
  const summaryLoading = ref(false);
  const summaryError = ref<string | null>(null);

  const results = ref<ResultRow[]>([]);
  const resultsTotal = ref(0);
  const resultsLoading = ref(false);
  const resultsError = ref<string | null>(null);

  const sortBy = ref<string>("delta");
  const sortOrder = ref<"asc" | "desc">("desc");

  const excludeOutliers = ref(true); // backend drops outlier store-days from chart/summary when true (default)

  const showUncertainOnly = ref(false); // filters /results to rows where CI crosses 0; doesn't affect summary or chart

  const chartSeries = computed(() => summary.value?.delta_over_time ?? []);
  const chartLoading = computed(() => summaryLoading.value);
  const chartError = computed(() => summaryError.value);
  const outlierWarnings = computed(() => summary.value?.outlier_warnings ?? []);
  const totalFull = computed(() => summary.value?.total_full ?? null);

  const totalPages = computed(() => Math.max(1, Math.ceil(resultsTotal.value / pageSize.value)));

  function toResultsParams(overrides?: {
    page?: number;
    page_size?: number;
    sort_by?: string;
    sort_dir?: string;
  }): ResultsParams {
    const a = appliedFilters.value;
    return {
      region: a.region || undefined,
      store_id: a.store_id || undefined,
      start_date: a.start_date || undefined,
      end_date: a.end_date || undefined,
      page: overrides?.page ?? page.value,
      page_size: overrides?.page_size ?? pageSize.value,
      sort_by: (overrides?.sort_by ?? sortBy.value) || undefined,
      sort_dir: (overrides?.sort_dir ?? sortOrder.value) || undefined,
      uncertain_only: showUncertainOnly.value || undefined,
    };
  }

  function toSummaryParams(): SummaryParams {
    const a = appliedFilters.value;
    return {
      region: a.region || undefined,
      store_id: a.store_id || undefined,
      start_date: a.start_date || undefined,
      end_date: a.end_date || undefined,
      exclude_outliers: excludeOutliers.value,
    };
  }

  async function loadSummary() {
    summaryLoading.value = true;
    summaryError.value = null;
    try {
      const data = await fetchSummary(toSummaryParams());
      summary.value = data;
      regions.value = [...new Set(data.regions.map((r) => r.region))].sort();
    } catch (e) {
      summaryError.value = e instanceof Error ? e.message : String(e);
    } finally {
      summaryLoading.value = false;
    }
  }

  async function loadResults(overridePage?: number, overridePageSize?: number) {
    resultsLoading.value = true;
    resultsError.value = null;
    try {
      const params = toResultsParams({
        page: overridePage ?? page.value,
        page_size: overridePageSize ?? pageSize.value,
        sort_by: sortBy.value,
        sort_dir: sortOrder.value,
      });
      const data = await fetchResults(params);
      results.value = data.results;
      resultsTotal.value = data.total;
      if (overridePage !== undefined) page.value = overridePage;
      if (overridePageSize !== undefined) pageSize.value = overridePageSize;
    } catch (e) {
      resultsError.value = e instanceof Error ? e.message : String(e);
    } finally {
      resultsLoading.value = false;
    }
  }

  async function applyFilters() {
    appliedFilters.value = { ...filters.value };
    page.value = 1;
    await Promise.all([loadSummary(), loadResults()]);
  }

  function setPage(p: number) {
    page.value = p;
    loadResults(p);
  }

  function setPageSize(size: number) {
    pageSize.value = size;
    page.value = 1;
    loadResults(1, size);
  }

  function setSort(key: string, order: "asc" | "desc") {
    sortBy.value = key;
    sortOrder.value = order;
    loadResults(1);
  }

  function setExcludeOutliers(value: boolean) {
    excludeOutliers.value = value;
  }

  function setShowUncertainOnly(value: boolean) {
    showUncertainOnly.value = value;
    page.value = 1;
    loadResults(1);
  }

  return {
    filters,
    appliedFilters,
    page,
    pageSize,
    totalPages,
    regions,
    regionsError: summaryError,
    summary,
    summaryLoading,
    summaryError,
    excludeOutliers,
    outlierWarnings,
    totalFull,
    results,
    resultsTotal,
    resultsLoading,
    resultsError,
    chartSeries,
    chartLoading,
    chartError,
    sortBy,
    sortOrder,
    applyFilters,
    loadSummary,
    loadResults,
    setPage,
    setPageSize,
    setSort,
    setExcludeOutliers,
    showUncertainOnly,
    setShowUncertainOnly,
    toResultsParams,
    toSummaryParams,
  };
});
