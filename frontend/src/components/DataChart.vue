<script setup lang="ts">
import VueApexCharts from "vue3-apexcharts";
import { computed, onUnmounted, ref, watch } from "vue";
import type { DeltaOverTimePoint } from "../api/types";
import {
  formatCurrency,
  formatCurrencyWithSign,
  formatDateLabel,
  formatDelta,
  formatPercent,
} from "../utils/format";
import AppTooltip from "./AppTooltip.vue";
import ChartDataSection from "./ChartDataSection.vue";
import IconInfo from "./icons/IconInfo.vue";

const props = defineProps<{
  series: DeltaOverTimePoint[];
  loading?: boolean;
  error?: string | null;
}>();

const emit = defineEmits<{ (e: "retry"): void }>();

type ChartMode = "delta" | "actualVsExpected";
const chartMode = ref<ChartMode>("delta");

const chartTitle = computed(() =>
  chartMode.value === "delta" ? "Average delta" : "Actual revenue vs expected revenue",
);
const chartTooltip = computed(() =>
  chartMode.value === "delta"
    ? "Average difference between actual and expected revenue for each day in the filtered set. Positive means above expected revenue."
    : "Daily average of actual revenue (dark line) and expected revenue (lighter gray) for the filtered set.",
);

const chartColorActual = "var(--color-slate-900)";
const chartColorExpected = "var(--color-slate-400)";
const chartColorZeroLine = "var(--color-slate-400)";

const chartContainerRef = ref<HTMLElement | null>(null);
const chartWidth = ref(0);
const MIN_LABEL_WIDTH_PX = 44;

let resizeObserver: ResizeObserver | null = null;
watch(
  chartContainerRef,
  (el) => {
    if (!el) return;
    resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry?.contentRect.width) chartWidth.value = entry.contentRect.width;
    });
    resizeObserver.observe(el);
    chartWidth.value = el.clientWidth;
  },
  { flush: "post", immediate: true },
);
onUnmounted(() => {
  if (resizeObserver && chartContainerRef.value) {
    resizeObserver.unobserve(chartContainerRef.value);
  }
  resizeObserver = null;
});

const xMaxLabels = computed(() => {
  const n = props.series.length;
  if (n <= 1) return n;
  const w = chartWidth.value;
  return w > 0 ? Math.max(2, Math.min(n, Math.floor(w / MIN_LABEL_WIDTH_PX))) : Math.min(n, 8);
});

const categories = computed(() => props.series.map((d) => formatDateLabel(d.date)));

const chartSeries = computed(() => {
  if (chartMode.value === "delta") {
    return [
      {
        name: "Avg change vs expected",
        data: props.series.map((d) => Math.round(d.avg_delta * 100) / 100),
      },
    ];
  }
  return [
    {
      name: "Actual revenue",
      data: props.series.map(
        (d) => Math.round((d.avg_actual ?? d.avg_delta + (d.avg_expected ?? 0)) * 100) / 100,
      ),
    },
    {
      name: "Expected revenue",
      data: props.series.map((d) => Math.round((d.avg_expected ?? 0) * 100) / 100),
    },
  ];
});

const yAxisRange = computed(() => {
  if (chartMode.value === "delta") {
    const vals = props.series.map((d) => d.avg_delta);
    const yMin = Math.min(0, ...vals);
    const yMax = Math.max(0, ...vals);
    const padding = (yMax - yMin) * 0.1 || 50;
    return {
      min: Math.floor(yMin - padding),
      max: Math.ceil(yMax + padding),
      isDelta: true,
    };
  }
  const actuals = props.series.map((d) => d.avg_actual ?? d.avg_delta + (d.avg_expected ?? 0));
  const expecteds = props.series.map((d) => d.avg_expected ?? 0);
  const all = [...actuals, ...expecteds];
  const yMin = Math.min(...all);
  const yMax = Math.max(...all);
  const padding = (yMax - yMin) * 0.08 || 20;
  return {
    min: Math.floor(yMin - padding),
    max: Math.ceil(yMax + padding),
    isDelta: false,
  };
});

const chartOptions = computed(() => ({
  colors: chartMode.value === "delta" ? [chartColorActual] : [chartColorActual, chartColorExpected],
  chart: {
    type: "line" as const,
    fontFamily: "inherit",
    toolbar: { show: false },
    zoom: { enabled: false },
    animations: { enabled: true, speed: 400 },
    width: "100%",
  },
  stroke: {
    curve: "smooth" as const,
    width: 3,
    colors:
      chartMode.value === "delta" ? [chartColorActual] : [chartColorActual, chartColorExpected],
  },
  dataLabels: { enabled: false },
  xaxis: {
    categories: categories.value,
    tickAmount: Math.max(xMaxLabels.value - 1, 0),
    labels: {
      style: { fontSize: "12px", colors: "var(--color-slate-500)" },
      rotate: 0,
    },
    tooltip: { enabled: false },
  },
  yaxis: {
    min: yAxisRange.value.min,
    max: yAxisRange.value.max,
    forceNiceScale: true,
    tickAmount: 5,
    labels: {
      style: { fontSize: "12px", colors: "var(--color-slate-500)" },
      formatter: (val: number) => {
        if (val == null) return "";
        if (yAxisRange.value.isDelta) {
          if (val >= 0) return `+$${Number(val).toFixed(2)}`;
          return `-$${Math.abs(Number(val)).toFixed(2)}`;
        }
        return formatCurrencyWithSign(Number(val));
      },
    },
  },
  grid: {
    borderColor: "var(--color-slate-200)",
    strokeDashArray: 0,
    xaxis: { lines: { show: false } },
    yaxis: { lines: { show: true }, opacity: 0.4 },
  },
  tooltip: {
    enabled: true,
    followCursor: true,
    theme: "light",
    custom(opts: { dataPointIndex?: number }) {
      const idx = opts?.dataPointIndex ?? -1;
      const d = props.series[idx];
      if (!d) return "";
      const avgActual = d.avg_actual ?? d.avg_delta + (d.avg_expected ?? 0);
      const avgExpected = d.avg_expected ?? 0;
      const uncertainPct = d.uncertain_rate != null ? formatPercent(d.uncertain_rate) : "-";
      return `
          <div class="rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-lg text-left min-w-[180px]">
            <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide">${formatDateLabel(d.date)}</p>
            <p class="mt-1.5 text-sm font-semibold text-slate-900">${formatDelta(d.avg_delta)}</p>
            <p class="mt-0.5 text-xs text-slate-600">Actual: ${formatCurrency(avgActual)}</p>
            <p class="text-xs text-slate-600">Expected: ${formatCurrency(avgExpected)}</p>
            <p class="mt-1 text-xs text-slate-400">Uncertain rows: ${uncertainPct}</p>
          </div>
        `;
    },
  },
  annotations: {
    yaxis:
      chartMode.value === "delta" && yAxisRange.value.min <= 0 && yAxisRange.value.max >= 0
        ? [
            {
              y: 0,
              strokeDashArray: 4,
              borderColor: chartColorZeroLine,
              borderWidth: 1,
              opacity: 0.7,
            },
          ]
        : [],
  },
  markers: {
    size: chartMode.value === "delta" ? 5 : [5, 5],
    hover: { size: 8, sizeOffset: 2 },
    strokeColors: "var(--color-white)",
    strokeWidth: 3,
    colors:
      chartMode.value === "delta" ? [chartColorActual] : [chartColorActual, chartColorExpected],
  },
  legend: {
    show: chartMode.value === "actualVsExpected",
    position: "top" as const,
    horizontalAlign: "right" as const,
    fontSize: "12px",
    markers: {
      size: 10,
      fillColors:
        chartMode.value === "actualVsExpected" ? [chartColorActual, chartColorExpected] : undefined,
    },
  },
}));
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
          @click="chartMode = 'delta'"
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
          @click="chartMode = 'actualVsExpected'"
        >
          Actual vs Expected
        </button>
      </div>
    </div>
    <ChartDataSection
      :loading="loading"
      :error="error"
      :has-data="series.length > 0"
      loading-min-height="300px"
      loading-message="Loading chart..."
      empty-message="No data for the current filters. Adjust filters and apply to see the chart."
      @retry="emit('retry')"
    >
      <div class="w-full relative" style="min-height: 300px">
        <div ref="chartContainerRef" class="w-full relative" style="min-height: 300px">
          <VueApexCharts type="line" height="300" :options="chartOptions" :series="chartSeries" />
        </div>
      </div>
    </ChartDataSection>
    <p class="mt-2 text-xs text-slate-500">
      Uncertain rows are those where the confidence interval crosses $0.
    </p>
  </div>
</template>
