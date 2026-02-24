<script setup lang="ts">
defineProps<{ open: boolean }>();
defineEmits<{ (e: "click"): void }>();
</script>

<template>
  <button
    type="button"
    class="w-6 h-6 p-0 border-0 bg-transparent cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 rounded shrink-0 flex items-center justify-center"
    aria-label="Menu"
    :aria-expanded="open"
    @click="$emit('click')"
  >
    <!-- Inset so hit area stays 24x24 but bars are slightly smaller -->
    <span class="flex flex-col justify-between items-center w-5 h-5 m-0.5">
      <span
        class="w-full h-0.5 bg-current rounded-full origin-center transition-all duration-[480ms] ease-in-out"
        :class="open ? 'translate-y-[9px] rotate-45' : 'translate-y-0 rotate-0'"
      />
      <span
        class="w-full h-0.5 bg-current rounded-full origin-center transition-all duration-[480ms] ease-in-out"
        :class="open ? 'scale-x-0' : 'scale-x-100'"
      />
      <span
        class="w-full h-0.5 bg-current rounded-full origin-center transition-all duration-[480ms] ease-in-out"
        :class="open ? '-translate-y-[9px] -rotate-45' : 'translate-y-0 rotate-0'"
      />
    </span>
  </button>
</template>
