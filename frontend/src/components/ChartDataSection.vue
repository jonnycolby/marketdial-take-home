<script setup lang="ts">
/** Handles loading, error, empty, and content states for charts so we don't repeat the same v-if chain everywhere. */
withDefaults(
  defineProps<{
    loading?: boolean;
    error?: string | null;
    hasData?: boolean;
    loadingMinHeight?: string;
    loadingMessage?: string;
    emptyMessage?: string;
  }>(),
  {
    loading: false,
    error: null,
    hasData: false,
    loadingMinHeight: "280px",
    loadingMessage: "Loading…",
    emptyMessage: "No data for the current filters.",
  },
);

const emit = defineEmits<{ (e: "retry"): void }>();
</script>

<template>
  <!-- Initial load: no data yet -->
  <p
    v-if="loading && !hasData && !error"
    class="text-slate-500 text-sm py-8 flex items-center gap-2"
    :style="{ minHeight: loadingMinHeight }"
  >
    <span
      class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600"
    />
    {{ loadingMessage }}
  </p>
  <!-- Error with no data -->
  <div
    v-else-if="error && !hasData"
    class="py-8 flex flex-col items-center gap-3 min-h-[200px] justify-center"
    role="alert"
  >
    <p class="text-red-600 text-sm font-medium">{{ error }}</p>
    <button
      type="button"
      class="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-100 transition-colors"
      @click="emit('retry')"
    >
      Try again
    </button>
  </div>
  <!-- Empty (no data, not loading, no error) -->
  <p v-else-if="!hasData" class="py-8 text-sm text-slate-500">
    {{ emptyMessage }}
  </p>
  <!-- Content: optional error banner + optional loading overlay + default slot -->
  <template v-else>
    <div
      v-if="error"
      class="flex flex-wrap items-center justify-between gap-3 mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-100 text-red-800 text-sm"
      role="alert"
    >
      <span>{{ error }}</span>
      <button
        type="button"
        class="rounded border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
        @click="emit('retry')"
      >
        Try again
      </button>
    </div>
    <div class="relative w-full">
      <div
        v-if="loading"
        class="absolute inset-0 z-10 flex items-center justify-center bg-white/70 rounded-lg"
        aria-busy="true"
      >
        <span
          class="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 shadow-sm border border-slate-200 text-slate-600 text-sm"
        >
          <span
            class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600"
          />
          Updating...
        </span>
      </div>
      <slot />
    </div>
  </template>
</template>
