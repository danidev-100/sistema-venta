import { useEffect, useRef, useState, useCallback } from "react";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type BarcodeScanProduct = {
  id: number;
  barcode: string | null;
  name: string;
  price: number;
};

export interface BarcodeScanCallbacks {
  onMatch: (productId: number, productName: string, price: number) => void;
  onMiss: (barcode: string) => void;
}

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

const DEBOUNCE_MS = 250;
const FLASH_DURATION_MS = 500;
const MIN_BARCODE_LENGTH = 6;

// ──────────────────────────────────────────────
// Hook
// ──────────────────────────────────────────────

/**
 * Captures barcode scanner input via a global keydown listener.
 *
 * The scanner (USB, emulates keyboard) sends rapid digit keydown events.
 * This hook accumulates digits into a buffer and attempts to match against
 * products after 250ms of silence (debounce).
 *
 * Returns `{ scanFlash }` — a boolean state that briefly goes true then
 * false to trigger a green flash CSS animation when a barcode is matched.
 */
export function useBarcodeScan(
  products: BarcodeScanProduct[],
  callbacks: BarcodeScanCallbacks,
): { scanFlash: boolean } {
  const [scanFlash, setScanFlash] = useState(false);
  const bufferRef = useRef("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep refs up to date without re-registering the listener
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;
  const productsRef = useRef(products);
  productsRef.current = products;

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clearFlashTimer = useCallback(() => {
    if (flashTimerRef.current !== null) {
      clearTimeout(flashTimerRef.current);
      flashTimerRef.current = null;
    }
  }, []);

  // ── Match logic (runs on debounce fire) ──

  const flushBuffer = useCallback(() => {
    const buffer = bufferRef.current;
    bufferRef.current = "";

    if (buffer.length < MIN_BARCODE_LENGTH) return;

    const match = productsRef.current.find((p) => p.barcode === buffer);

    if (match) {
      callbacksRef.current.onMatch(match.id, match.name, match.price);
      // Trigger green flash
      setScanFlash(true);
      clearFlashTimer();
      flashTimerRef.current = setTimeout(() => {
        setScanFlash(false);
      }, FLASH_DURATION_MS);
    } else {
      callbacksRef.current.onMiss(buffer);
    }
  }, [clearFlashTimer]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const key = event.key;

      // Only accumulate digit characters (0-9)
      if (key.length === 1 && key >= "0" && key <= "9") {
        bufferRef.current += key;

        // Reset debounce timer on each digit
        clearTimer();
        timerRef.current = setTimeout(flushBuffer, DEBOUNCE_MS);
      } else {
        // Non-digit keypress resets the buffer
        bufferRef.current = "";
        clearTimer();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearTimer();
      clearFlashTimer();
    };
  }, [clearTimer, clearFlashTimer, flushBuffer]);

  return { scanFlash };
}
