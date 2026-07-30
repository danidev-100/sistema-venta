import { useEffect } from "react";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type ShortcutHandlers = {
  onCheckout: () => void;
  onFocusSearch: () => void;
  onNewSale: () => void;
  onIncreaseQty: () => void;
  onDecreaseQty: () => void;
  onEscape: () => void;
};

// ──────────────────────────────────────────────
// Hook
// ──────────────────────────────────────────────

/**
 * Registers global keyboard shortcuts for the POS page.
 *
 * Shortcuts do NOT fire when the event target is an INPUT, TEXTAREA,
 * or contenteditable element, preventing conflicts while typing.
 *
 * Shortcut map:
 *   F1      → onCheckout
 *   F2      → onFocusSearch
 *   F3      → onNewSale (with confirm dialog)
 *   + / =   → onIncreaseQty
 *   -       → onDecreaseQty
 *   Escape  → onEscape
 */
export function useKeyboardShortcuts(handlers: ShortcutHandlers): void {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Prevent firing shortcuts while typing in inputs
      const tag = (event.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if ((event.target as HTMLElement).isContentEditable) return;

      switch (event.key) {
        case "F1":
          event.preventDefault();
          handlers.onCheckout();
          break;

        case "F2":
          event.preventDefault();
          handlers.onFocusSearch();
          break;

        case "F3":
          event.preventDefault();
          handlers.onNewSale();
          break;

        case "+":
        case "=":
          event.preventDefault();
          handlers.onIncreaseQty();
          break;

        case "-":
          event.preventDefault();
          handlers.onDecreaseQty();
          break;

        case "Escape":
          event.preventDefault();
          handlers.onEscape();
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlers]);
}
