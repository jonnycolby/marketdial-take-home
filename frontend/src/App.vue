<script setup lang="ts">
import { onMounted, ref } from "vue";
import AppCheckbox from "./components/AppCheckbox.vue";
import AppSidebar from "./components/AppSidebar.vue";
import DataChart from "./components/DataChart.vue";
import RevenueTable from "./components/RevenueTable.vue";
import RowDetailModal from "./components/RowDetailModal.vue";
import AppTooltip from "./components/AppTooltip.vue";
import IconFilterSolid from "./components/icons/IconFilterSolid.vue";
import IconInfo from "./components/icons/IconInfo.vue";
import IconSearchSolid from "./components/icons/IconSearchSolid.vue";
import { useRevenueStore } from "./stores/revenue";
import { formatDelta } from "./utils/format";
import type { ResultRow } from "./api/types";

const store = useRevenueStore();
const detailRow = ref<ResultRow | null>(null);

onMounted(() => {
  store.applyFilters();
});

function onRowClick(row: ResultRow) {
  detailRow.value = row;
}

function closeDetail() {
  detailRow.value = null;
}

function onSortChange(e: Event) {
  const v = (e.target as HTMLSelectElement).value;
  const [k, o] = v.split("-") as [string, "asc" | "desc"];
  store.setSort(k, o);
}

function setPresetLast7() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 7);
  store.filters.start_date = start.toISOString().slice(0, 10);
  store.filters.end_date = end.toISOString().slice(0, 10);
  store.applyFilters();
}

function setPresetLast30() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  store.filters.start_date = start.toISOString().slice(0, 10);
  store.filters.end_date = end.toISOString().slice(0, 10);
  store.applyFilters();
}

function clearFilters() {
  store.filters.region = "";
  store.filters.store_id = "";
  store.filters.start_date = "";
  store.filters.end_date = "";
  store.applyFilters();
}

async function useFullData() {
  store.setExcludeOutliers(false);
  await store.loadSummary();
}

async function excludeOutliersAgain() {
  store.setExcludeOutliers(true);
  await store.loadSummary();
}
</script>

<template>
  <div class="flex min-h-screen bg-slate-50">
    <AppSidebar />
    <div class="flex flex-col flex-1 min-w-0">
      <main class="flex-1 overflow-auto pt-14 lg:pt-0">
        <div class="mx-auto max-w-7xl px-4 pt-6 pb-8 sm:px-6 lg:px-8 lg:pt-9 lg:pb-8 space-y-8">
          <h1 class="text-2xl font-bold tracking-tight text-slate-900 mb-6 lg:mb-10">
            Store Revenue
          </h1>
          <!-- Filters -->
          <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 class="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <IconFilterSolid class="w-4 h-4 text-slate-500" />
              Filters
            </h2>
            <div
              v-if="store.regionsError"
              class="flex flex-wrap items-center justify-between gap-3 mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-100 text-red-800 text-sm"
              role="alert"
            >
              <span>{{ store.regionsError }}</span>
              <button
                type="button"
                class="rounded border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
                @click="store.applyFilters()"
              >
                Try again
              </button>
            </div>
            <form class="flex flex-wrap items-end gap-4" @submit.prevent="store.applyFilters()">
              <label class="flex flex-col gap-1 text-sm text-slate-600">
                Region
                <select
                  v-model="store.filters.region"
                  class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 min-w-[140px]"
                >
                  <option value="">All regions</option>
                  <option v-for="r in store.regions" :key="r" :value="r">{{ r }}</option>
                </select>
              </label>
              <label class="flex flex-col gap-1 text-sm text-slate-600">
                Store ID
                <input
                  v-model="store.filters.store_id"
                  type="text"
                  placeholder="e.g. store_01"
                  class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 min-w-[120px]"
                />
              </label>
              <label class="flex flex-col gap-1 text-sm text-slate-600">
                Start date
                <input
                  v-model="store.filters.start_date"
                  type="date"
                  class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800"
                />
              </label>
              <label class="flex flex-col gap-1 text-sm text-slate-600">
                End date
                <input
                  v-model="store.filters.end_date"
                  type="date"
                  class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800"
                />
              </label>
              <button
                type="submit"
                class="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 transition-colors flex items-center gap-2"
              >
                <IconSearchSolid class="w-4 h-4" />
                Apply filters
              </button>
            </form>
            <div class="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                class="text-xs rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-slate-600 hover:bg-slate-100"
                @click="clearFilters"
              >
                Clear filters
              </button>
              <button
                type="button"
                class="text-xs rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-slate-600 hover:bg-slate-100"
                @click="setPresetLast7"
              >
                Last 7 days
              </button>
              <button
                type="button"
                class="text-xs rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-slate-600 hover:bg-slate-100"
                @click="setPresetLast30"
              >
                Last 30 days
              </button>
            </div>
          </section>

          <!-- Summary cards -->
          <section
            v-if="store.summary"
            class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            <div class="min-w-0 w-full">
              <div
                class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm w-full h-full flex flex-col"
              >
                <div
                  class="text-xs font-medium tracking-wide text-slate-500 flex items-center gap-1.5 shrink-0"
                >
                  <span class="uppercase">Total rows</span>
                  <AppTooltip
                    content="Number of store-days that match your filters."
                    position="top"
                  >
                    <span class="inline-flex text-slate-500 hover:text-slate-600 transition-colors"
                      ><IconInfo class="w-4 h-4"
                    /></span>
                  </AppTooltip>
                </div>
                <div class="flex-1 flex items-center justify-center min-h-0 py-3">
                  <p class="text-2xl font-semibold text-slate-900">
                    {{ store.summary.total.toLocaleString() }}
                  </p>
                </div>
              </div>
            </div>
            <div class="min-w-0 w-full">
              <div
                class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm w-full h-full flex flex-col"
              >
                <div
                  class="text-xs font-medium tracking-wide text-slate-500 flex items-center gap-1.5 shrink-0"
                >
                  <span class="uppercase">Avg change vs. expected</span>
                  <AppTooltip
                    content="Average difference between actual revenue and expected revenue for the filtered store-days."
                    position="top"
                  >
                    <span class="inline-flex text-slate-500 hover:text-slate-600 transition-colors"
                      ><IconInfo class="w-4 h-4"
                    /></span>
                  </AppTooltip>
                </div>
                <div class="flex-1 flex items-center justify-center min-h-0 py-3">
                  <p
                    class="text-2xl font-semibold tabular-nums"
                    :class="store.summary.delta.avg >= 0 ? 'text-emerald-700' : 'text-red-700'"
                  >
                    {{ formatDelta(store.summary.delta.avg) }}
                  </p>
                </div>
              </div>
            </div>
            <div class="min-w-0 w-full">
              <div
                class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm w-full h-full flex flex-col"
              >
                <div
                  class="text-xs font-medium tracking-wide text-slate-500 flex items-center gap-1.5 shrink-0"
                >
                  <span class="uppercase">Change range</span>
                  <AppTooltip
                    content="Smallest and largest change vs. expected revenue in the filtered set."
                    position="top"
                  >
                    <span class="inline-flex text-slate-500 hover:text-slate-600 transition-colors"
                      ><IconInfo class="w-4 h-4"
                    /></span>
                  </AppTooltip>
                </div>
                <div class="flex-1 flex items-center justify-center min-h-0 py-3">
                  <div class="flex flex-col gap-1 items-center">
                    <div class="flex items-baseline gap-2">
                      <span class="text-xs font-semibold text-slate-400">Min</span>
                      <span class="text-lg font-semibold tabular-nums text-slate-900">{{
                        formatDelta(store.summary.delta.min)
                      }}</span>
                    </div>
                    <div class="flex items-baseline gap-2">
                      <span class="text-xs font-semibold text-slate-400">Max</span>
                      <span class="text-lg font-semibold tabular-nums text-slate-900">{{
                        formatDelta(store.summary.delta.max)
                      }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="min-w-0 w-full">
              <div
                class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm w-full h-full flex flex-col"
              >
                <div
                  class="text-xs font-medium tracking-wide text-slate-500 flex items-center gap-1.5 shrink-0"
                >
                  <span class="uppercase">Uncertain rate</span>
                  <AppTooltip
                    content="Share of store-days where we can't tell if revenue went up or down vs. expected. The possible range of the change includes zero, so it's unclear."
                    position="top"
                  >
                    <span class="inline-flex text-slate-500 hover:text-slate-600 transition-colors"
                      ><IconInfo class="w-4 h-4"
                    /></span>
                  </AppTooltip>
                </div>
                <div class="flex-1 flex items-center justify-center min-h-0 py-3">
                  <p class="text-2xl font-semibold text-slate-700">
                    {{ (store.summary.uncertain_rate * 100).toFixed(1) }}%
                  </p>
                </div>
              </div>
            </div>
          </section>

          <!-- Summary load error (e.g. first load failed; regions error is shown in filters) -->
          <section
            v-if="store.summaryError && !store.summary"
            class="rounded-xl border-2 border-red-200 bg-red-50 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3"
            role="alert"
          >
            <p class="text-red-800 text-sm font-medium">{{ store.summaryError }}</p>
            <button
              type="button"
              class="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
              @click="store.loadSummary()"
            >
              Try again
            </button>
          </section>

          <!-- Outlier notice: some rows have revenue >10x typical; we can exclude them from the chart or show full data -->
          <section
            v-if="store.outlierWarnings.length > 0"
            class="rounded-xl border-2 border-amber-200 bg-amber-50 p-4 shadow-sm"
            role="alert"
          >
            <h3 class="text-sm font-semibold text-amber-900 mb-2">
              {{ store.excludeOutliers ? "Some data excluded from chart" : "Showing full data" }}
            </h3>
            <p class="text-sm text-amber-800 mb-2">
              <template v-if="store.excludeOutliers">
                {{
                  store.outlierWarnings.length === 1
                    ? "1 store-day has"
                    : `${store.outlierWarnings.length} store-days have`
                }}
                revenue more than 10x typical for this set; they're excluded from the chart and
                summary so the chart isn't dominated by a few points. Summary is based on
                {{ store.summary?.total }} of {{ store.totalFull }} rows.
              </template>
              <template v-else>
                {{
                  store.outlierWarnings.length === 1
                    ? "1 store-day has"
                    : `${store.outlierWarnings.length} store-days have`
                }}
                revenue more than 10x typical; the chart scale may be stretched.
              </template>
            </p>
            <ul class="text-sm text-amber-800 list-disc list-inside mb-3">
              <li v-for="(w, i) in store.outlierWarnings" :key="i">
                <strong>{{ w.date }}</strong> - {{ w.store_id }} ({{ w.region }}): {{ w.reason }}
              </li>
            </ul>
            <div class="flex flex-wrap gap-2">
              <button
                v-if="store.excludeOutliers"
                type="button"
                class="rounded-lg border-2 border-amber-600 bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-200 transition-colors"
                @click="useFullData"
              >
                Show full data
              </button>
              <button
                v-else
                type="button"
                class="rounded-lg border-2 border-amber-600 bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-200 transition-colors"
                @click="excludeOutliersAgain"
              >
                Exclude from chart
              </button>
            </div>
          </section>

          <!-- Charts (stacked vertically) -->
          <section class="space-y-6">
            <DataChart
              :series="store.chartSeries"
              :loading="store.chartLoading"
              :error="store.chartError"
              @retry="store.loadSummary()"
            />
          </section>

          <!-- Results table -->
          <section>
            <div class="flex flex-wrap items-center gap-6 mb-4">
              <h2 class="text-lg font-semibold text-slate-800">Results</h2>
              <AppCheckbox
                :model-value="store.showUncertainOnly"
                label="Show uncertain only"
                @update:model-value="store.setShowUncertainOnly"
              />
              <label class="flex items-center gap-2 text-sm text-slate-600">
                Sort
                <select
                  :value="`${store.sortBy}-${store.sortOrder}`"
                  class="rounded border border-slate-300 bg-white px-2 py-1 text-slate-800"
                  @change="onSortChange"
                >
                  <option value="delta-desc">Delta (high first)</option>
                  <option value="delta-asc">Delta (low first)</option>
                  <option value="date-desc">Date (newest first)</option>
                  <option value="date-asc">Date (oldest first)</option>
                  <option value="actual_revenue-desc">Actual revenue (high first)</option>
                  <option value="actual_revenue-asc">Actual revenue (low first)</option>
                </select>
              </label>
            </div>
            <RevenueTable
              :rows="store.results"
              :loading="store.resultsLoading"
              :error="store.resultsError"
              :total="store.resultsTotal"
              :page="store.page"
              :page-size="store.pageSize"
              :total-pages="store.totalPages"
              :show-uncertain-only="store.showUncertainOnly"
              @page="store.setPage"
              @page-size="store.setPageSize"
              @row-click="onRowClick"
              @retry="store.loadResults()"
            />
          </section>
        </div>
      </main>

      <RowDetailModal :row="detailRow" @close="closeDetail" />
    </div>
  </div>
</template>
