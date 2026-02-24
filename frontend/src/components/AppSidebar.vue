<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from "vue";
import AppTooltip from "./AppTooltip.vue";
import HamburgerButton from "./HamburgerButton.vue";
import IconHouse from "./icons/IconHouse.vue";
import IconChartBar from "./icons/IconChartBar.vue";
import IconUser from "./icons/IconUser.vue";
import { useMobileMenuStore } from "../stores/mobileMenu";

const mobileMenu = useMobileMenuStore();
const mobilePanelOuterRef = ref<HTMLElement | null>(null);

// One rAF + reflow so the panel's width transition runs (browser must paint 0 before we set 20rem)
watch(
  () => mobileMenu.open,
  (open) => {
    if (open && !mobileMenu.closing) {
      mobileMenu.panelExpanded = false;
      nextTick(() => {
        requestAnimationFrame(() => {
          mobilePanelOuterRef.value?.offsetHeight;
          mobileMenu.expandPanel();
        });
      });
    }
  },
);

const userMenuOpen = ref(false);
const userTriggerRef = ref<HTMLElement | null>(null);
const userMenuRef = ref<HTMLElement | null>(null);

function onPanelTransitionEnd(e: TransitionEvent) {
  if (e.propertyName === "width") {
    mobileMenu.onPanelTransitionEnd();
  }
}

function toggleUserMenu() {
  userMenuOpen.value = !userMenuOpen.value;
}

function closeUserMenu() {
  userMenuOpen.value = false;
}

function handleClickOutside(e: MouseEvent) {
  const target = e.target as Node;
  if (
    userMenuOpen.value &&
    userTriggerRef.value &&
    !userTriggerRef.value.contains(target) &&
    userMenuRef.value &&
    !userMenuRef.value.contains(target)
  ) {
    closeUserMenu();
  }
}

onMounted(() => {
  document.addEventListener("click", handleClickOutside);
});
onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
});
</script>

<template>
  <!-- Desktop sidebar (lg and up) -->
  <aside
    class="hidden lg:flex w-16 shrink-0 flex-col bg-slate-800 border-r border-slate-700/50 min-h-screen fixed left-0 top-0 z-30"
    aria-label="Main navigation"
  >
    <!-- Logo: softer white, full white on hover -->
    <div class="p-3 flex items-center justify-center border-b border-slate-700/50">
      <button
        type="button"
        class="w-10 h-10 rounded-full bg-slate-300 hover:bg-white flex items-center justify-center cursor-pointer transition-colors"
        aria-label="Home"
      />
    </div>

    <!-- Nav: icon-only with compact, large tooltips to the right -->
    <nav class="flex-1 flex flex-col items-center py-3 gap-1">
      <AppTooltip content="Home" position="right" :compact="true" :large="true">
        <a
          href="#"
          class="flex items-center justify-center w-10 h-10 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
          aria-current="false"
        >
          <IconHouse class="w-5 h-5" />
        </a>
      </AppTooltip>
      <AppTooltip content="Store Revenue" position="right" :compact="true" :large="true">
        <a
          href="#"
          class="flex items-center justify-center w-10 h-10 rounded-lg text-white bg-slate-700/70 hover:bg-slate-700 transition-colors"
          aria-current="page"
        >
          <IconChartBar class="w-5 h-5" />
        </a>
      </AppTooltip>
    </nav>

    <!-- Sidebar footer: user button + dropdown (to the right, bottom-aligned) -->
    <div class="border-t border-slate-700/80 py-3 px-2 relative">
      <div class="relative flex justify-center" ref="userTriggerRef">
        <button
          type="button"
          class="flex items-center justify-center w-10 h-10 rounded-full text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors cursor-pointer"
          aria-label="User menu"
          :aria-expanded="userMenuOpen"
          aria-haspopup="true"
          @click="toggleUserMenu"
        >
          <IconUser class="w-6 h-6" />
        </button>
        <Transition
          enter-active-class="transition duration-150 ease-out"
          enter-from-class="opacity-0 scale-95"
          enter-to-class="opacity-100 scale-100"
          leave-active-class="transition duration-100 ease-in"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-95"
        >
          <div
            v-show="userMenuOpen"
            ref="userMenuRef"
            class="fixed left-16 bottom-0 w-56 rounded-t-lg border border-slate-200 border-b-0 bg-white py-2 shadow-lg z-50"
            role="menu"
          >
            <div class="px-4 py-2 pb-3 border-b border-slate-100">
              <p class="text-sm font-semibold text-slate-900">John Appleseed</p>
            </div>
            <button
              type="button"
              class="w-full text-left px-4 py-2 pb-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              role="menuitem"
              @click="closeUserMenu"
            >
              Logout
            </button>
          </div>
        </Transition>
      </div>
    </div>
  </aside>

  <!-- Mobile top bar: near-black logo (left) + hamburger (right), no background/border -->
  <div class="flex lg:hidden fixed top-0 left-0 right-0 h-14 items-center justify-between p-3 z-40">
    <button
      type="button"
      class="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center cursor-pointer hover:bg-black transition-colors shrink-0"
      aria-label="Home"
    />
    <div class="text-slate-800">
      <HamburgerButton :open="mobileMenu.open" @click="mobileMenu.toggle" />
    </div>
  </div>

  <!-- Mobile menu overlay: panel opens by animating width from right -->
  <div
    v-show="mobileMenu.open || mobileMenu.closing"
    class="fixed inset-0 z-50 lg:hidden"
    :aria-hidden="!(mobileMenu.open || mobileMenu.closing)"
  >
    <!-- Backdrop (no fade; just block clicks when open) -->
    <button
      type="button"
      class="absolute inset-0 bg-slate-900/50 transition-opacity duration-[480ms] ease-in-out"
      :class="mobileMenu.panelExpanded && !mobileMenu.closing ? 'opacity-100' : 'opacity-0'"
      aria-label="Close menu"
      @click="mobileMenu.close"
    />
    <!-- Outer: fixed right-0, width animates 0 → 20rem, overflow hidden. Grows from right to reveal inner. Cleanup on transitionend. -->
    <div
      ref="mobilePanelOuterRef"
      class="fixed top-0 right-0 bottom-0 overflow-hidden max-w-[100vw]"
      style="transition: width 0.48s ease-in-out"
      :style="{ width: mobileMenu.panelExpanded && !mobileMenu.closing ? '20rem' : '0' }"
      @transitionend="onPanelTransitionEnd"
    >
      <!-- Inner: absolute right-0, fixed width 20rem, pinned right so it doesn't move when outer width changes -->
      <div
        class="absolute top-0 right-0 bottom-0 w-80 max-w-[100vw] bg-slate-800 shadow-xl flex flex-col"
      >
        <!-- Top row: logo + close (X), same color as other menu items -->
        <div
          class="flex items-center justify-between h-14 px-4 shrink-0 border-b border-slate-700/50"
        >
          <button
            type="button"
            class="w-10 h-10 rounded-full bg-slate-300 hover:bg-white flex items-center justify-center cursor-pointer transition-colors"
            aria-label="Home"
            @click="mobileMenu.close"
          />
          <div class="text-slate-200 hover:text-white transition-colors">
            <HamburgerButton :open="mobileMenu.open" @click="mobileMenu.close" />
          </div>
        </div>
        <!-- Nav items -->
        <nav class="flex-1 py-4 px-3 flex flex-col gap-1">
          <a
            href="#"
            class="flex items-center gap-3 px-3 py-3 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700/50 transition-colors"
            @click="mobileMenu.close"
          >
            <IconHouse class="w-5 h-5 shrink-0" />
            <span>Home</span>
          </a>
          <a
            href="#"
            class="flex items-center gap-3 px-3 py-3 rounded-lg text-white bg-slate-700/70 hover:bg-slate-700 transition-colors"
            @click="mobileMenu.close"
          >
            <IconChartBar class="w-5 h-5 shrink-0" />
            <span>Store Revenue</span>
          </a>
        </nav>
        <!-- User at bottom with border-top -->
        <div class="border-t border-slate-700/80 p-3">
          <button
            type="button"
            class="flex items-center gap-3 w-full px-3 py-3 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700/50 transition-colors text-left"
            @click="mobileMenu.close"
          >
            <IconUser class="w-5 h-5 shrink-0" />
            <span>John Appleseed</span>
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Spacer for desktop sidebar so main content doesn't go under it -->
  <div class="hidden lg:block w-16 shrink-0" aria-hidden="true" />
</template>
