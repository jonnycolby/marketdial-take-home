<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import IconUser from "./icons/IconUser.vue";

const userMenuOpen = ref(false);
const triggerRef = ref<HTMLElement | null>(null);
const menuRef = ref<HTMLElement | null>(null);

function toggleMenu() {
  userMenuOpen.value = !userMenuOpen.value;
}

function closeMenu() {
  userMenuOpen.value = false;
}

function handleClickOutside(e: MouseEvent) {
  const target = e.target as Node;
  if (
    userMenuOpen.value &&
    triggerRef.value &&
    !triggerRef.value.contains(target) &&
    menuRef.value &&
    !menuRef.value.contains(target)
  ) {
    closeMenu();
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
  <header
    class="flex items-center justify-end h-14 px-4 sm:px-6 border-b border-slate-200 bg-white shrink-0"
  >
    <div class="relative" ref="triggerRef">
      <button
        type="button"
        class="flex items-center justify-center w-9 h-9 rounded-full text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
        aria-label="User menu"
        :aria-expanded="userMenuOpen"
        aria-haspopup="true"
        @click="toggleMenu"
      >
        <IconUser class="w-5 h-5" />
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
          ref="menuRef"
          class="absolute right-0 top-full mt-2 w-56 rounded-lg border border-slate-200 bg-white py-2 shadow-lg z-50"
          role="menu"
        >
          <div class="px-4 py-2 border-b border-slate-100">
            <p class="text-sm font-semibold text-slate-900">John Appleseed</p>
          </div>
          <button
            type="button"
            class="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            role="menuitem"
            @click="closeMenu"
          >
            Logout
          </button>
        </div>
      </Transition>
    </div>
  </header>
</template>
