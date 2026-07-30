import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useBarcodeScan } from "@/hooks/useBarcodeScan";

// ──────────────────────────────────────────────
// Mock products
// ──────────────────────────────────────────────

const mockProducts = [
  { id: 1, barcode: "77912345", name: "Coca-Cola 500ml", price: 150 },
  { id: 2, barcode: "77912346", name: "Agua Mineral 1L", price: 120 },
  { id: 3, barcode: null, name: "Producto Sin Código", price: 100 },
];

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function dispatchDigit(...digits: string[]) {
  act(() => {
    digits.forEach((d) => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: d, bubbles: true }),
      );
    });
  });
}

function dispatchNonDigit(key: string) {
  act(() => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true }),
    );
  });
}

function flushTimers(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe("useBarcodeScan — 2.5 barcode accumulation & match", () => {
  let unmount: (() => void) | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    unmount?.();
    unmount = null;
    vi.useRealTimers();
  });

  // ── 2.1 Happy match ──

  it("calls onMatch with product info when barcode matches", () => {
    const onMatch = vi.fn();
    const onMiss = vi.fn();

    const { unmount: u } = renderHook(() =>
      useBarcodeScan(mockProducts, { onMatch, onMiss }),
    );
    unmount = u;

    dispatchDigit("7", "7", "9", "1", "2", "3", "4", "5");
    flushTimers(300);

    expect(onMatch).toHaveBeenCalledTimes(1);
    expect(onMatch).toHaveBeenCalledWith(1, "Coca-Cola 500ml", 150);
    expect(onMiss).not.toHaveBeenCalled();
  });

  // ── 2.2 Barcode not found → onMiss ──

  it("calls onMiss when barcode is not found", () => {
    const onMatch = vi.fn();
    const onMiss = vi.fn();

    const { unmount: u } = renderHook(() =>
      useBarcodeScan(mockProducts, { onMatch, onMiss }),
    );
    unmount = u;

    dispatchDigit("1", "1", "1", "1", "1", "1");
    flushTimers(300);

    expect(onMiss).toHaveBeenCalledTimes(1);
    expect(onMiss).toHaveBeenCalledWith("111111");
    expect(onMatch).not.toHaveBeenCalled();
  });

  // ── 2.3 Debounce prevents premature match ──

  it("does not fire until debounce timer expires (250ms silence)", () => {
    const onMatch = vi.fn();
    const onMiss = vi.fn();

    const { unmount: u } = renderHook(() =>
      useBarcodeScan(mockProducts, { onMatch, onMiss }),
    );
    unmount = u;

    // First burst
    dispatchDigit("7", "7", "9");
    flushTimers(150); // still within debounce window

    expect(onMatch).not.toHaveBeenCalled();
    expect(onMiss).not.toHaveBeenCalled();

    // Second burst — resets debounce
    dispatchDigit("1", "2", "3");
    flushTimers(150);

    expect(onMatch).not.toHaveBeenCalled();
    expect(onMiss).not.toHaveBeenCalled();

    // Third burst
    dispatchDigit("4", "5");
    flushTimers(150);

    expect(onMatch).not.toHaveBeenCalled();
    expect(onMiss).not.toHaveBeenCalled();

    // Wait for final debounce to fire
    flushTimers(300);

    expect(onMatch).toHaveBeenCalledWith(1, "Coca-Cola 500ml", 150);
    expect(onMatch).toHaveBeenCalledTimes(1);
  });

  // ── 2.3 scanFlash toggle ──

  it("toggles scanFlash on match and clears after 500ms", () => {
    const { result, unmount: u } = renderHook(() =>
      useBarcodeScan(mockProducts, {
        onMatch: vi.fn(),
        onMiss: vi.fn(),
      }),
    );
    unmount = u;

    expect(result.current.scanFlash).toBe(false);

    dispatchDigit("7", "7", "9", "1", "2", "3", "4", "5");
    flushTimers(300);
    // Debounce fires → scanFlash = true
    expect(result.current.scanFlash).toBe(true);

    // After 500ms it should clear
    // 500ms from when the match happened (during flushTimers(300))
    // We've advanced 300ms total. Timer for clear was at +500ms from t=250,
    // so at t=750. We need to advance 450 more to reach 750.
    flushTimers(500);
    expect(result.current.scanFlash).toBe(false);
  });

  // ── Minimum length guard (≥6 digits) ──

  it("does not fire for barcodes shorter than 6 digits", () => {
    const onMatch = vi.fn();
    const onMiss = vi.fn();

    const { unmount: u } = renderHook(() =>
      useBarcodeScan(mockProducts, { onMatch, onMiss }),
    );
    unmount = u;

    dispatchDigit("1", "2", "3"); // only 3 digits
    flushTimers(300);

    expect(onMatch).not.toHaveBeenCalled();
    expect(onMiss).not.toHaveBeenCalled();
  });

  // ── Non-digit resets buffer ──

  it("resets buffer on non-digit keypress", () => {
    const onMatch = vi.fn();
    const onMiss = vi.fn();

    const { unmount: u } = renderHook(() =>
      useBarcodeScan(mockProducts, { onMatch, onMiss }),
    );
    unmount = u;

    // Three digits, then non-digit, then three more
    dispatchDigit("7", "7", "9");
    dispatchNonDigit("a");

    // The buffer should have been reset, so these 3 digits don't match
    dispatchDigit("1", "2", "3");
    flushTimers(300);

    // "123" is only 3 chars, less than minimum 6 — no callback
    expect(onMatch).not.toHaveBeenCalled();
    expect(onMiss).not.toHaveBeenCalled();
  });

  // ── Buffer clears after match → sequential scans ──

  it("handles sequential scans (buffer clears after match)", () => {
    const onMatch = vi.fn();
    const onMiss = vi.fn();

    const { unmount: u } = renderHook(() =>
      useBarcodeScan(mockProducts, { onMatch, onMiss }),
    );
    unmount = u;

    // First scan: Coca-Cola 500ml
    dispatchDigit("7", "7", "9", "1", "2", "3", "4", "5");
    flushTimers(300);
    expect(onMatch).toHaveBeenCalledWith(1, "Coca-Cola 500ml", 150);
    onMatch.mockClear();

    // Second scan: Agua Mineral 1L
    dispatchDigit("7", "7", "9", "1", "2", "3", "4", "6");
    flushTimers(300);
    expect(onMatch).toHaveBeenCalledWith(2, "Agua Mineral 1L", 120);
    expect(onMiss).not.toHaveBeenCalled();
  });

  // ── Non-digit keys like F1, Enter don't corrupt buffer ──

  it("handles function keys without interfering with next scan", () => {
    const onMatch = vi.fn();
    const onMiss = vi.fn();

    const { unmount: u } = renderHook(() =>
      useBarcodeScan(mockProducts, { onMatch, onMiss }),
    );
    unmount = u;

    // Some non-digit keys pressed (simulates keyboard shortcuts F1, Enter, etc.)
    dispatchNonDigit("F1");
    dispatchNonDigit("Enter");
    dispatchNonDigit("Shift");

    // Then scan a valid barcode
    dispatchDigit("7", "7", "9", "1", "2", "3", "4", "5");
    flushTimers(300);

    // Non-digit keys reset buffer, but the fresh scan should still work
    expect(onMatch).toHaveBeenCalledWith(1, "Coca-Cola 500ml", 150);
  });

  // ── Only digits are accumulated (letters filter out) ──

  it("only accumulates digit characters", () => {
    const onMatch = vi.fn();
    const onMiss = vi.fn();

    const { unmount: u } = renderHook(() =>
      useBarcodeScan(mockProducts, { onMatch, onMiss }),
    );
    unmount = u;

    // Letters interspersed — they reset the buffer each time
    dispatchDigit("7");
    dispatchNonDigit("x");
    dispatchDigit("7");
    dispatchNonDigit("y");
    dispatchDigit("9");
    dispatchNonDigit("z");
    dispatchDigit("1");
    dispatchDigit("2");
    dispatchDigit("3");

    flushTimers(300);

    // After all the resets, only "123" remains at the end (less than 6)
    expect(onMatch).not.toHaveBeenCalled();
    expect(onMiss).not.toHaveBeenCalled();
  });

  // ── Products array can have null barcodes (not crash) ──

  it("does not crash when product barcode is null", () => {
    const onMatch = vi.fn();
    const onMiss = vi.fn();

    const { unmount: u } = renderHook(() =>
      useBarcodeScan(mockProducts, { onMatch, onMiss }),
    );
    unmount = u;

    // Scan digits that don't match any barcode
    dispatchDigit("9", "9", "9", "9", "9", "9");
    flushTimers(300);

    expect(onMiss).toHaveBeenCalledWith("999999");
    expect(onMatch).not.toHaveBeenCalled();
  });

  // ── scanFlash stays false when no match ──

  it("does not set scanFlash on miss", () => {
    const { result, unmount: u } = renderHook(() =>
      useBarcodeScan(mockProducts, {
        onMatch: vi.fn(),
        onMiss: vi.fn(),
      }),
    );
    unmount = u;

    dispatchDigit("1", "1", "1", "1", "1", "1");
    flushTimers(300);

    expect(result.current.scanFlash).toBe(false);
  });
});
