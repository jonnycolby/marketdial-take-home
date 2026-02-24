import { defineStore } from "pinia";
import { ref } from "vue";

export const useMobileMenuStore = defineStore("mobileMenu", () => {
  /** True when the menu is open. Drives both hamburger icons (open class) and overlay/panel. */
  const open = ref(false);
  /** True while the panel is closing so the overlay stays visible until the width transition ends. */
  const closing = ref(false);
  /** True when the panel width should be 20rem. Set one frame after open so the 0→20rem transition runs. */
  const panelExpanded = ref(false);

  function toggle() {
    if (open.value) {
      close();
    } else {
      closing.value = false;
      open.value = true;
    }
  }

  function close() {
    open.value = false;
    closing.value = true;
  }

  /** Call when the panel's width transition ends (so we can hide the overlay and reset panelExpanded). */
  function onPanelTransitionEnd() {
    if (closing.value) {
      closing.value = false;
      panelExpanded.value = false;
    }
  }

  /** Call one frame after open becomes true so the panel animates from 0 to 20rem (CSS transition needs a prior paint at 0). */
  function expandPanel() {
    panelExpanded.value = true;
  }

  return {
    open,
    closing,
    panelExpanded,
    toggle,
    close,
    onPanelTransitionEnd,
    expandPanel,
  };
});
