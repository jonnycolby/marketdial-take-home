<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from "vue";
import type { DeltaOverTimePoint } from "../api/types";
import {
  formatCurrency,
  formatCurrencyWithSign,
  formatDateLabel,
  formatDelta,
  formatPercent,
} from "../utils/format";
import {
  createLineChart,
  type LineChartInstance,
  type LineConfig,
} from "../lib/TimeSeriesSvgChart";
import AppTooltip from "./AppTooltip.vue";
import ChartDataSection from "./ChartDataSection.vue";
import IconInfo from "./icons/IconInfo.vue";

type ChartMode = "delta" | "actualVsExpected";

const props = defineProps<{
  series: DeltaOverTimePoint[];
  loading?: boolean;
  error?: string | null;
}>();

const emit = defineEmits<{ (e: "retry"): void }>();

const chartMode = ref<ChartMode>("delta");
let chartInstance: LineChartInstance<DeltaOverTimePoint> | null = null;

const LINES_DELTA: [LineConfig<DeltaOverTimePoint>] = [
  {
    getY: (d) => d.avg_delta,
    color: "var(--color-slate-900)",
    label: "Delta",
  },
];
const LINES_ACTUAL_VS_EXPECTED: [LineConfig<DeltaOverTimePoint>, LineConfig<DeltaOverTimePoint>] = [
  {
    getY: (d) => d.avg_actual ?? d.avg_delta + (d.avg_expected ?? 0),
    color: "var(--color-slate-900)",
    label: "Actual revenue",
  },
  {
    getY: (d) => d.avg_expected ?? 0,
    color: "var(--color-slate-400)",
    strokeDasharray: "6 4",
    label: "Expected revenue",
  },
];
const containerRef = ref<HTMLElement | null>(null);

const tooltipData = ref<{
  date: string;
  avgDelta: string;
  avgActual: string;
  avgExpected: string;
  uncertainRate: string;
  clientX: number;
  clientY: number;
} | null>(null);

const TOOLTIP_GAP = 12;
const TOOLTIP_EDGE_PAD = 8;
const TOOLTIP_EST_WIDTH = 200;
const TOOLTIP_EST_HEIGHT = 140;
const tooltipRef = ref<HTMLElement | null>(null);
const measuredTooltipWidth = ref(0);
const measuredTooltipHeight = ref(0);

watch(
  () => tooltipData.value,
  () => {
    nextTick(() => {
      if (tooltipRef.value) {
        const r = tooltipRef.value.getBoundingClientRect();
        measuredTooltipWidth.value = r.width;
        measuredTooltipHeight.value = r.height;
      }
    });
  },
  { flush: "post" },
);

const tooltipStyle = ref<{ left: string; top: string }>({ left: "0", top: "0" });
watch(
  () => tooltipData.value,
  (t) => {
    if (!t || typeof window === "undefined") {
      tooltipStyle.value = { left: "0", top: "0" };
      return;
    }
    const x = t.clientX;
    const y = t.clientY;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const tw = measuredTooltipWidth.value || TOOLTIP_EST_WIDTH;
    const th = measuredTooltipHeight.value || TOOLTIP_EST_HEIGHT;
    let left: number;
    if (x + TOOLTIP_GAP + tw > w - TOOLTIP_EDGE_PAD) {
      left = x - TOOLTIP_GAP - tw;
    } else {
      left = x + TOOLTIP_GAP;
    }
    if (left < TOOLTIP_EDGE_PAD) left = TOOLTIP_EDGE_PAD;
    let top = y - TOOLTIP_EDGE_PAD;
    if (top < TOOLTIP_EDGE_PAD) top = TOOLTIP_EDGE_PAD;
    if (top + th > h - TOOLTIP_EDGE_PAD) top = h - th - TOOLTIP_EDGE_PAD;
    tooltipStyle.value = { left: `${left}px`, top: `${top}px` };
  },
  { flush: "post" },
);

function getLines():
  | [LineConfig<DeltaOverTimePoint>]
  | [LineConfig<DeltaOverTimePoint>, LineConfig<DeltaOverTimePoint>] {
  return chartMode.value === "delta" ? LINES_DELTA : LINES_ACTUAL_VS_EXPECTED;
}

function setChartMode(m: ChartMode) {
  chartMode.value = m;
  chartInstance?.update({
    lines: getLines(),
    includeZeroLine: m === "delta",
  });
}

function initOrUpdateChart() {
  if (!containerRef.value || props.series.length === 0) {
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
    return;
  }
  const data = props.series;
  const lines = getLines();
  if (chartInstance) {
    chartInstance.update({ data, lines, includeZeroLine: chartMode.value === "delta" });
    return;
  }
  chartInstance = createLineChart<DeltaOverTimePoint>(containerRef.value, {
    data,
    lines,
    height: CHART_HEIGHT,
    includeZeroLine: chartMode.value === "delta",
    formatYAxis: (val) => {
      if (chartMode.value === "delta") {
        if (val >= 0) return `+$${val.toFixed(2)}`;
        return `-$${Math.abs(val).toFixed(2)}`;
      }
      return formatCurrencyWithSign(val);
    },
    formatXAxis: formatDateLabel,
    onPointHover: (index, point, clientX, clientY) => {
      if (index == null || !point) {
        tooltipData.value = null;
        return;
      }
      const avgActual = point.avg_actual ?? point.avg_delta + (point.avg_expected ?? 0);
      const avgExpected = point.avg_expected ?? 0;
      tooltipData.value = {
        date: formatDateLabel(point.date),
        avgDelta: formatDelta(point.avg_delta),
        avgActual: formatCurrency(avgActual),
        avgExpected: formatCurrency(avgExpected),
        uncertainRate: point.uncertain_rate != null ? formatPercent(point.uncertain_rate) : "-",
        clientX,
        clientY,
      };
    },
  });
}

watch(
  [containerRef, () => props.series],
  () => {
    if (props.loading || props.error) return;
    initOrUpdateChart();
  },
  { immediate: true, flush: "post" },
);

onUnmounted(() => {
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
});

const CHART_HEIGHT = 300;
const LEGEND_SLOT_HEIGHT = 36;

const chartTitle = computed(() =>
  chartMode.value === "delta" ? "Average delta" : "Actual revenue vs expected revenue",
);
const chartTooltip = computed(() =>
  chartMode.value === "delta"
    ? "Average difference between actual and expected revenue for each day in the filtered set. Positive means above expected revenue."
    : "Daily average of actual revenue (solid) and expected revenue (dashed, lighter gray) for the filtered set.",
);
</script>

<template>
  <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h3 class="text-base font-semibold text-slate-800 flex items-center gap-2">
        {{ chartTitle }}
        <AppTooltip :content="chartTooltip" position="top">
          <span
            class="inline-flex text-slate-500 hover:text-slate-600 transition-colors cursor-help"
            aria-label="Chart explanation"
            ><IconInfo class="w-4 h-4"
          /></span>
        </AppTooltip>
      </h3>
      <div
        class="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-sm"
        role="group"
        aria-label="Chart mode"
      >
        <button
          type="button"
          class="rounded-md px-3 py-1.5 font-medium transition-colors"
          :class="
            chartMode === 'delta'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-800'
          "
          @click="setChartMode('delta')"
        >
          Delta vs $0
        </button>
        <button
          type="button"
          class="rounded-md px-3 py-1.5 font-medium transition-colors"
          :class="
            chartMode === 'actualVsExpected'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-800'
          "
          @click="setChartMode('actualVsExpected')"
        >
          Actual vs Expected
        </button>
      </div>
    </div>
    <ChartDataSection
      :loading="loading"
      :error="error"
      :has-data="series.length > 0"
      loading-min-height="336px"
      loading-message="Loading chart..."
      empty-message="No data for the current filters. Adjust filters and apply to see the chart."
      @retry="emit('retry')"
    >
      <div
        class="relative flex flex-col transition-[height] duration-[960ms] ease-in-out"
        :style="{
          height:
            (chartMode === 'actualVsExpected' ? CHART_HEIGHT + LEGEND_SLOT_HEIGHT : CHART_HEIGHT) +
            'px',
        }"
      >
        <div
          class="overflow-hidden shrink-0 transition-[height,opacity] duration-[960ms] ease-in-out"
          :style="{
            height: chartMode === 'actualVsExpected' ? LEGEND_SLOT_HEIGHT + 'px' : '0',
            opacity: chartMode === 'actualVsExpected' ? 1 : 0,
          }"
          role="legend"
          aria-label="Series legend"
        >
          <div
            class="flex flex-wrap justify-end items-center gap-6 text-xs text-slate-600 pt-0.5 pb-2"
          >
            <span class="inline-flex items-center gap-2">
              <svg width="24" height="4" aria-hidden="true" class="shrink-0">
                <line
                  x1="0"
                  y1="2"
                  x2="24"
                  y2="2"
                  stroke="var(--color-slate-900)"
                  stroke-width="2"
                  stroke-linecap="round"
                />
              </svg>
              Actual revenue
            </span>
            <span class="inline-flex items-center gap-2">
              <svg width="24" height="4" aria-hidden="true" class="shrink-0">
                <line
                  x1="0"
                  y1="2"
                  x2="24"
                  y2="2"
                  stroke="var(--color-slate-400)"
                  stroke-width="2"
                  stroke-dasharray="6 4"
                  stroke-linecap="round"
                />
              </svg>
              Expected revenue
            </span>
          </div>
        </div>
        <div
          ref="containerRef"
          class="relative w-full shrink-0"
          :style="{ height: CHART_HEIGHT + 'px' }"
        />
        <Teleport to="body">
          <div
            v-if="tooltipData"
            ref="tooltipRef"
            class="chart-tooltip-fixed pointer-events-none fixed z-50 rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-lg text-left min-w-[180px]"
            :style="tooltipStyle"
          >
            <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              {{ tooltipData.date }}
            </p>
            <p class="mt-1.5 text-sm font-semibold text-slate-900">
              {{ tooltipData.avgDelta }}
            </p>
            <p class="mt-0.5 text-xs text-slate-600">Actual: {{ tooltipData.avgActual }}</p>
            <p class="text-xs text-slate-600">Expected: {{ tooltipData.avgExpected }}</p>
            <p class="mt-1 text-xs text-slate-400">
              Uncertain rows: {{ tooltipData.uncertainRate }}
            </p>
          </div>
        </Teleport>
      </div>
    </ChartDataSection>
    <p class="mt-2 text-xs text-slate-500">
      Uncertain rows are those where the confidence interval crosses $0.
    </p>
  </div>
</template>
