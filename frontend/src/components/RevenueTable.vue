<script setup lang="ts">
import { computed, ref } from "vue";
import AppTooltip from "./AppTooltip.vue";
import IconArrowDownSolid from "./icons/IconArrowDownSolid.vue";
import IconArrowUpSolid from "./icons/IconArrowUpSolid.vue";
import IconQuestionCircle from "./icons/IconQuestionCircle.vue";
import { formatCurrency, formatDelta, formatDate } from "../utils/format";
import type { ResultRow } from "../api/types";

const props = withDefaults(
  defineProps<{
    rows: ResultRow[];
    loading: boolean;
    error: string | null;
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    showUncertainOnly: boolean;
  }>(),
  { totalPages: 1 },
);

const emit = defineEmits<{
  (e: "page", value: number): void;
  (e: "pageSize", value: number): void;
  (e: "rowClick", row: ResultRow): void;
  (e: "retry"): void;
}>();

const jumpPageInput = ref("");

function statusFor(row: ResultRow): "up" | "down" | "uncertain" {
  if (row.ci_low > 0) return "up";
  if (row.ci_high < 0) return "down";
  return "uncertain";
}

const displayRows = computed(() => props.rows);

const pageNumbers = computed(() => {
  const total = props.totalPages;
  const current = props.page;
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: number[] = [];
  pages.push(1);
  if (current > 3) pages.push(-1);
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    if (!pages.includes(i)) pages.push(i);
  }
  if (current < total - 2) pages.push(-2);
  if (total > 1) pages.push(total);
  return pages;
});

function jumpToPage() {
  const n = parseInt(jumpPageInput.value, 10);
  if (!Number.isNaN(n) && n >= 1 && n <= props.totalPages) {
    emit("page", n);
    jumpPageInput.value = "";
  }
}
</script>

<template>
  <div class="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden relative">
    <!-- Initial load: no data yet -->
    <div
      v-if="loading && rows.length === 0 && !error"
      class="flex items-center justify-center py-16 text-slate-500 min-h-[280px]"
      style="min-height: 280px"
    >
      <span class="inline-flex items-center gap-2">
        <span
          class="inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600"
        />
        Loading results...
      </span>
    </div>
    <!-- Error with no data: full error state -->
    <div
      v-else-if="error && rows.length === 0"
      class="flex flex-col items-center justify-center py-12 px-4 min-h-[200px] gap-4"
      role="alert"
    >
      <p class="text-red-600 text-sm font-medium text-center">{{ error }}</p>
      <button
        type="button"
        class="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-100 transition-colors"
        @click="emit('retry')"
      >
        Try again
      </button>
    </div>
    <!-- Empty result (not loading, no error) -->
    <div
      v-else-if="!loading && rows.length === 0"
      class="py-12 text-center text-slate-500 text-sm min-h-[120px] flex items-center justify-center"
    >
      {{ showUncertainOnly ? "No uncertain rows in this range." : "No results." }}
    </div>
    <!-- Table (with optional loading overlay or error banner when we have stale data) -->
    <template v-else>
      <!-- Error banner when we have stale data -->
      <div
        v-if="error && rows.length > 0"
        class="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-red-50 border-b border-red-100 text-red-800 text-sm"
        role="alert"
      >
        <span>{{ error }}</span>
        <button
          type="button"
          class="rounded border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 transition-colors"
          @click="emit('retry')"
        >
          Try again
        </button>
      </div>
      <!-- Loading overlay when refreshing with existing data -->
      <div
        v-if="loading && rows.length > 0"
        class="absolute inset-0 z-10 flex items-center justify-center bg-white/70 rounded-xl"
        aria-busy="true"
      >
        <span
          class="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 shadow-sm border border-slate-200 text-slate-700 text-sm"
        >
          <span
            class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600"
          />
          Updating...
        </span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm text-left">
          <thead class="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
            <tr>
              <th class="px-4 py-3">Store ID</th>
              <th class="px-4 py-3">Region</th>
              <th class="px-4 py-3">Date</th>
              <th class="px-4 py-3">Expected</th>
              <th class="px-4 py-3">Actual</th>
              <th class="px-4 py-3" title="Change vs. expected revenue">Change</th>
              <th class="px-4 py-3">
                <AppTooltip
                  content="Possible range for the change vs. expected revenue. First value is the lower bound (min), second is the upper bound (max)."
                  position="top"
                >
                  <span class="inline-flex items-center cursor-help">Uncertainty range</span>
                </AppTooltip>
              </th>
              <th class="px-4 py-3">Transactions</th>
              <th class="px-4 py-3 w-32">Interpretation</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr
              v-for="row in displayRows"
              :key="`${row.store_id}-${row.date}`"
              class="hover:bg-slate-50/80 cursor-pointer transition-colors"
              @click="emit('rowClick', row)"
            >
              <td class="px-4 py-2.5 font-mono text-slate-800">{{ row.store_id }}</td>
              <td class="px-4 py-2.5 text-slate-700">{{ row.region }}</td>
              <td class="px-4 py-2.5 text-slate-700">{{ formatDate(row.date) }}</td>
              <td class="px-4 py-2.5 tabular-nums">{{ formatCurrency(row.baseline_revenue) }}</td>
              <td class="px-4 py-2.5 tabular-nums">{{ formatCurrency(row.actual_revenue) }}</td>
              <td
                class="px-4 py-2.5 tabular-nums"
                :class="row.delta >= 0 ? 'text-emerald-700' : 'text-red-700'"
              >
                {{ formatDelta(row.delta) }}
              </td>
              <td class="px-4 py-2.5 text-slate-800 tabular-nums">
                <AppTooltip content="min" position="top" :compact="true">
                  <span class="cursor-help">{{ formatDelta(row.ci_low) }}</span>
                </AppTooltip>
                <span class="text-slate-400 mx-1.5 font-medium">/</span>
                <AppTooltip content="max" position="top" :compact="true">
                  <span class="cursor-help">{{ formatDelta(row.ci_high) }}</span>
                </AppTooltip>
              </td>
              <td class="px-4 py-2.5 text-slate-600">{{ row.transactions }}</td>
              <td class="px-4 py-2.5">
                <span
                  v-if="statusFor(row) === 'up'"
                  class="inline-flex items-center gap-1.5 shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 whitespace-nowrap"
                  title="Revenue was likely higher than expected this day"
                >
                  <IconArrowUpSolid class="w-3.5 h-3.5 shrink-0" />
                  Likely increase
                </span>
                <span
                  v-else-if="statusFor(row) === 'down'"
                  class="inline-flex items-center gap-1.5 shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 whitespace-nowrap"
                  title="Revenue was likely lower than expected this day"
                >
                  <IconArrowDownSolid class="w-3.5 h-3.5 shrink-0" />
                  Likely decrease
                </span>
                <span
                  v-else
                  class="inline-flex items-center gap-1.5 shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 whitespace-nowrap"
                  title="We're not sure if revenue went up or down vs. expected"
                >
                  <IconQuestionCircle class="w-3.5 h-3.5 shrink-0" />
                  Uncertain
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div
        class="flex flex-wrap items-center gap-4 px-4 py-3 border-t border-slate-200 bg-slate-50/50 text-sm"
      >
        <label class="flex items-center gap-2 text-slate-600">
          Rows per page
          <select
            :value="pageSize"
            class="rounded border border-slate-300 bg-white px-2 py-1 text-slate-800"
            @change="(e) => emit('pageSize', Number((e.target as HTMLSelectElement).value))"
          >
            <option :value="25">25</option>
            <option :value="50">50</option>
            <option :value="100">100</option>
            <option :value="200">200</option>
          </select>
        </label>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="rounded border border-slate-300 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="page <= 1"
            @click="emit('page', page - 1)"
          >
            Previous
          </button>
          <div class="flex items-center gap-1">
            <template v-for="p in pageNumbers" :key="p">
              <button
                v-if="p > 0"
                type="button"
                class="min-w-[2rem] rounded px-2 py-1.5 text-slate-700 hover:bg-slate-200"
                :class="p === page ? 'bg-slate-200 font-medium' : ''"
                @click="emit('page', p)"
              >
                {{ p }}
              </button>
              <span v-else class="px-1 text-slate-400">...</span>
            </template>
          </div>
          <button
            type="button"
            class="rounded border border-slate-300 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="page >= totalPages"
            @click="emit('page', page + 1)"
          >
            Next
          </button>
        </div>
        <span class="text-slate-500">{{ total }} total</span>
        <div class="flex items-center gap-2 ml-auto">
          <label class="flex items-center gap-2 text-slate-600">
            Jump to page
            <input
              v-model="jumpPageInput"
              type="number"
              :min="1"
              :max="totalPages"
              placeholder="#"
              class="w-16 rounded border border-slate-300 bg-white px-2 py-1 text-slate-800 text-center"
              @keydown.enter="jumpToPage"
            />
            <button
              type="button"
              class="rounded border border-slate-300 bg-white px-2 py-1 text-slate-700 hover:bg-slate-100"
              @click="jumpToPage"
            >
              Go
            </button>
          </label>
        </div>
      </div>
    </template>
  </div>
</template>
