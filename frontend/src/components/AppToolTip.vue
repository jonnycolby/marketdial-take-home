<script setup lang="ts">
import { ref, computed } from "vue";

const props = withDefaults(
  defineProps<{
    content: string;
    position?: "top" | "bottom" | "left" | "right";
    compact?: boolean; // no min-width, for short labels
    large?: boolean; // bigger text (e.g. sidebar nav)
  }>(),
  { compact: false, large: false },
);

const show = ref(false);

const tooltipClasses = computed(() => {
  const p = props.position ?? "top";
  const positionMap = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-6",
  };
  return [
    { "min-w-[16rem]": !props.compact },
    props.large ? "text-base font-semibold whitespace-nowrap" : "text-[11px] whitespace-normal",
    positionMap[p],
  ];
});
</script>

<template>
  <div class="relative inline-flex">
    <div
      class="inline-flex cursor-help p-0.5 -m-0.5 rounded"
      @mouseenter="show = true"
      @mouseleave="show = false"
      @pointerenter="show = true"
      @pointerleave="show = false"
    >
      <slot />
    </div>
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-show="show"
        class="absolute z-[100] px-3 py-2 text-slate-200 bg-slate-800 rounded-lg shadow-lg max-w-xs pointer-events-none"
        :class="tooltipClasses"
      >
        {{ props.content }}
      </div>
    </Transition>
  </div>
</template>
