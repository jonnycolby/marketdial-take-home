<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    label?: string;
  }>(),
  { label: "" },
);

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
}>();

const checked = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit("update:modelValue", v),
});
</script>

<template>
  <label
    class="inline-flex items-center gap-2 cursor-pointer select-none group"
    :data-checked="checked || undefined"
    @click="checked = !checked"
  >
    <span
      class="relative inline-flex items-center justify-center w-5 h-5 rounded border-2 border-slate-300 bg-white transition-all duration-200 group-hover:border-slate-400 group-hover:scale-110 group-active:scale-95"
      :class="{
        'border-slate-600': checked,
      }"
    >
      <Transition name="check" :duration="250">
        <svg
          v-if="checked"
          class="w-3.5 h-3.5 shrink-0 check-draw"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-slate-800)"
          stroke-width="3"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M5 12l5 5L19 7" pathLength="24" stroke-dasharray="100" stroke-dashoffset="0" />
        </svg>
      </Transition>
    </span>
    <span v-if="label" class="text-sm text-slate-600 group-hover:text-slate-800">{{ label }}</span>
  </label>
</template>

<style scoped>
.check-draw path {
  animation: check-in 0.48s ease-in-out forwards;
}
.check-leave-active path {
  animation: check-out 0.48s ease-in-out forwards;
}
:deep(label:not([data-checked])) .check-draw path {
  animation: none;
}
@keyframes check-in {
  from {
    stroke-dashoffset: 100;
  }
  to {
    stroke-dashoffset: 0;
  }
}
@keyframes check-out {
  from {
    stroke-dashoffset: 0;
  }
  to {
    stroke-dashoffset: -100;
  }
}
</style>
