import { useEffect, useRef, useCallback } from "react";

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

const DEBOUNCE_MS = 250;
const MIN_BARCODE_LENGTH = 6;
const SCAN_RESET_MS = 600;
const INPUT_ID = "product-barcode";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface UseBarcodeInputOptions {
  /** Enable/disable the global keydown listener */
  active: boolean;
  /** Called when a complete barcode is captured */
  onBarcode: (barcode: string) => void;
}

// ──────────────────────────────────────────────
// Hook
// ──────────────────────────────────────────────

/**
 * Captures barcode scanner input specifically for the product form.
 *
 * - Only active when `active=true` AND the barcode input has focus
 * - Accumulates digits until a debounce silence (250ms) or an Enter key
 * - Calls `onBarcode(barcode)` with the captured code
 * - Prevents the scanner's trailing Enter from submitting the form
 *
 * The scanner types digits into the input naturally, so `onBarcode` is
 * primarily used for post-scan actions (checking duplicates, etc.).
 */
export function useBarcodeInput({ active, onBarcode }: UseBarcodeInputOptions): void {
  const bufferRef = useRef("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onBarcodeRef = useRef(onBarcode);
  onBarcodeRef.current = onBarcode;
  const recentlyScannedRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const fireBarcode = useCallback((barcode: string) => {
    recentlyScannedRef.current = true;
    setTimeout(() => {
      recentlyScannedRef.current = false;
    }, SCAN_RESET_MS);
    onBarcodeRef.current(barcode);
  }, []);

  const flushBuffer = useCallback(() => {
    const buffer = bufferRef.current;
    bufferRef.current = "";

    if (buffer.length >= MIN_BARCODE_LENGTH) {
      fireBarcode(buffer);
    }
  }, [fireBarcode]);

  useEffect(() => {
    if (!active) return;

    function handleKeyDown(event: KeyboardEvent) {
      // ── Block trailing Enter from scanner ──
      if (event.key === "Enter" && recentlyScannedRef.current) {
        recentlyScannedRef.current = false;
        event.preventDefault();
        return;
      }

      // ── Only capture digits when the barcode input is focused ──
      const activeEl = document.activeElement;
      if (!activeEl || activeEl.id !== INPUT_ID) return;

      const key = event.key;

      if (key.length === 1 && key >= "0" && key <= "9") {
        // Don't prevent default — digits reach the input naturally
        bufferRef.current += key;
        clearTimer();
        timerRef.current = setTimeout(flushBuffer, DEBOUNCE_MS);
      } else if (key === "Enter") {
        // Some scanners send Enter after digits — flush immediately
        if (bufferRef.current.length >= MIN_BARCODE_LENGTH) {
          const barcode = bufferRef.current;
          bufferRef.current = "";
          clearTimer();
          fireBarcode(barcode);
          event.preventDefault(); // prevent form submission
          return;
        }
        bufferRef.current = "";
        clearTimer();
      } else {
        // Non-digit, non-Enter resets the buffer
        bufferRef.current = "";
        clearTimer();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearTimer();
    };
  }, [active, clearTimer, flushBuffer, fireBarcode]);
}
