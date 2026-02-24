<script setup lang="ts">
import { computed } from "vue";
import IconXMark from "./icons/IconXMark.vue";
import { formatCurrency, formatDate, formatDelta } from "../utils/format";
import type { ResultRow } from "../api/types";

const props = defineProps<{
  row: ResultRow | null;
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

function statusFor(row: ResultRow): "up" | "down" | "uncertain" {
  if (row.ci_low > 0) return "up";
  if (row.ci_high < 0) return "down";
  return "uncertain";
}

const statusLabel = computed(() => {
  if (!props.row) return "";
  const s = statusFor(props.row);
  if (s === "up") return "Likely increase";
  if (s === "down") return "Likely decrease";
  return "Uncertain";
});

const statusClass = computed(() => {
  if (!props.row) return "";
  const s = statusFor(props.row);
  if (s === "up") return "text-emerald-700";
  if (s === "down") return "text-red-700";
  return "text-slate-600";
});

const explanationText = computed(() => {
  if (!props.row) return "";
  const r = props.row;
  if (r.uncertain) {
    return "Revenue change versus expectation is inconclusive for this day.";
  }
  if (r.ci_low > 0) {
    return "Revenue was likely higher than expected this day.";
  }
  return "Revenue was likely lower than expected this day.";
});
</script>

<template>
  <div
    v-if="row"
    class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
    @click.self="emit('close')"
  >
    <div
      class="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl max-h-[90vh] overflow-auto"
    >
      <div class="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div class="flex flex-wrap items-baseline gap-2 min-w-0">
          <span class="font-semibold text-slate-800 truncate">{{ row.store_id }}</span>
          <span
            class="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-sm font-medium shrink-0"
          >
            {{ formatDate(row.date) }}
          </span>
        </div>
        <button
          type="button"
          class="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors shrink-0"
          aria-label="Close"
          @click="emit('close')"
        >
          <IconXMark class="w-5 h-5" />
        </button>
      </div>
      <dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 px-5 py-4 text-sm">
        <dt class="font-medium text-slate-500">Store</dt>
        <dd class="font-mono text-slate-800">{{ row.store_id }}</dd>
        <dt class="font-medium text-slate-500">Region</dt>
        <dd class="text-slate-800">{{ row.region }}</dd>
        <dt class="font-medium text-slate-500">Date</dt>
        <dd class="text-slate-800">{{ formatDate(row.date) }}</dd>
        <dt class="font-medium text-slate-500">Expected revenue</dt>
        <dd class="tabular-nums text-slate-800">{{ formatCurrency(row.baseline_revenue) }}</dd>
        <dt class="font-medium text-slate-500">Actual revenue</dt>
        <dd class="tabular-nums text-slate-800">{{ formatCurrency(row.actual_revenue) }}</dd>
        <dt class="font-medium text-slate-500">Change vs. expected</dt>
        <dd class="tabular-nums" :class="row.delta >= 0 ? 'text-emerald-700' : 'text-red-700'">
          {{ formatDelta(row.delta) }}
        </dd>
        <dt class="font-medium text-slate-500">Possible range of change</dt>
        <dd class="text-slate-800 tabular-nums space-y-1">
          <div>Min {{ formatDelta(row.ci_low) }}</div>
          <div>Max {{ formatDelta(row.ci_high) }}</div>
        </dd>
        <dt class="font-medium text-slate-500">Transactions</dt>
        <dd class="text-slate-800">{{ row.transactions }}</dd>
        <dt class="font-medium text-slate-500">What this means</dt>
        <dd :class="statusClass" class="font-medium">
          {{ statusLabel }}
        </dd>
        <dt class="font-medium text-slate-500 text-xs col-span-2 sr-only">Explanation</dt>
        <dd class="text-slate-600 text-sm col-span-2">
          {{ explanationText }}
        </dd>
        <template v-if="row.notes">
          <dt class="font-medium text-slate-500">Note</dt>
          <dd class="text-slate-600 text-xs col-span-2">{{ row.notes }}</dd>
        </template>
      </dl>
    </div>
  </div>
</template>
