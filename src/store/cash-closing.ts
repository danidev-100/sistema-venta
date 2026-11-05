import { create } from "zustand";
import type { CompletedSale } from "@/store";
import { api } from "@/lib/api";
import { salesInShift, shiftPaymentTotals, shiftProducts } from "@/lib/shift-sales";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type Shift = {
  id: number;
  employee: string;
  openTime: string;
  closeTime: string | null;
  status: "open" | "closed";
  storeId: string;
  openingBalance: number;
  declaredCash: number | null;
  variance: number | null;
  reconciliationStatus: "pending" | "matched" | "mismatch" | null;
  reconciledAt: string | null;
};

export type CashMovementMethod = "cash" | "card" | "transfer" | "other";
export type CashMovementType = "withdrawal" | "deposit";

export type CashMovement = {
  id: number;
  shiftId: number;
  type: CashMovementType;
  amount: number;
  method: CashMovementMethod;
  reason: string;
  createdBy: string;
  storeId: string;
  createdAt: string;
};

export type ShiftSummary = {
  shift: Shift;
  totalSales: number;
  cashTotal: number;
  cardTotal: number;
  mercadopagoTotal: number;
  transactionCount: number;
  itemCount: number;
  topProducts: { name: string; quantity: number; total: number }[];
  /** Total cash withdrawn from the shift */
  withdrawalsTotal: number;
  /** Total cash deposited into the shift */
  depositsTotal: number;
};

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

/**
 * Compute expected cash — sum of cash-method sales + mixed cash portions within
 * a time window. The association and the cash split come from
 * `@/lib/shift-sales`; `closeTime: null` (open shift) keeps an unbounded window,
 * so the reference time is `Infinity` instead of the helper's `Date.now()`.
 */
export function computeExpectedCash(
  sales: CompletedSale[],
  openTime: string,
  closeTime: string | null,
): number {
  return shiftPaymentTotals(
    salesInShift(sales, { openTime, closeTime }, Infinity),
  ).cash;
}

/** Compute variance: declared - expected. */
export function computeVariance(
  declaredCash: number,
  expectedCash: number,
): number {
  return Math.round((declaredCash - expectedCash) * 100) / 100;
}

// ──────────────────────────────────────────────
// Store shape
// ──────────────────────────────────────────────

export type CashClosingStore = {
  shifts: Shift[];
  cashMovements: CashMovement[];
  loading: boolean;

  /** Load shifts for a store from the API. */
  loadShifts: (storeId: string) => Promise<void>;

  /** Open a new shift with an opening cash balance. Throws if an open shift exists. */
  openShift: (employee: string, storeId: string, openingBalance?: number) => Promise<Shift>;

  /** Close an open shift. */
  closeShift: (shiftId: number) => Promise<void>;

  /** Record a cash movement (withdrawal or deposit) for a shift. */
  recordCashMovement: (
    shiftId: number,
    type: CashMovementType,
    amount: number,
    reason: string,
    createdBy: string,
    storeId: string,
    method?: CashMovementMethod,
  ) => Promise<CashMovement>;

  /** Get all cash movements for a shift, newest first. */
  getShiftCashMovements: (shiftId: number) => CashMovement[];

  /** Reconcile a closed shift with declared cash amount. */
  reconcile: (
    shiftId: number,
    declaredCash: number,
    completedSales: CompletedSale[],
  ) => Promise<void>;

  /** Build a summary for a given shift. */
  getShiftSummary: (
    shiftId: number,
    completedSales: CompletedSale[],
  ) => ShiftSummary | null;

  /** Get the currently open shift for a store, or null. */
  getOpenShift: (storeId: string) => Shift | null;

  /** Get all shifts for a store, newest first. */
  getShiftsByStore: (storeId: string) => Shift[];
};

// ──────────────────────────────────────────────
// Normalize server responses (snake_case → camelCase)
// ──────────────────────────────────────────────

function normalizeShift(raw: Record<string, unknown>): Shift {
  return {
    id: raw.id as number,
    employee: raw.employee as string,
    openTime: (raw.open_time ?? raw.openTime) as string,
    closeTime: (raw.close_time ?? raw.closeTime ?? null) as string | null,
    status: raw.status as "open" | "closed",
    storeId: (raw.store_id ?? raw.storeId) as string,
    openingBalance: (raw.opening_balance ?? raw.openingBalance ?? 0) as number,
    declaredCash: (raw.declared_cash ?? raw.declaredCash ?? null) as number | null,
    variance: (raw.variance ?? null) as number | null,
    reconciliationStatus: (raw.reconciliation_status ?? raw.reconciliationStatus ?? null) as Shift["reconciliationStatus"],
    reconciledAt: (raw.reconciled_at ?? raw.reconciledAt ?? null) as string | null,
  };
}

function normalizeMovement(raw: Record<string, unknown>): CashMovement {
  return {
    id: raw.id as number,
    shiftId: (raw.shift_id ?? raw.shiftId) as number,
    type: raw.type as CashMovementType,
    amount: raw.amount as number,
    method: (raw.method ?? "cash") as CashMovementMethod,
    reason: (raw.reason ?? "") as string,
    createdBy: (raw.created_by ?? raw.createdBy ?? "") as string,
    storeId: (raw.store_id ?? raw.storeId) as string,
    createdAt: (raw.created_at ?? raw.createdAt) as string,
  };
}

// ──────────────────────────────────────────────
// Store implementation
// ──────────────────────────────────────────────

export const useCashClosingStore = create<CashClosingStore>((set, get) => ({
  shifts: [],
  cashMovements: [],
  loading: false,

  loadShifts: async (storeId) => {
    set({ loading: true });
    try {
      const raw = await api.get<Record<string, unknown>[]>(`/cash/shifts?storeId=${encodeURIComponent(storeId)}`);
      set({ shifts: raw.map(normalizeShift), loading: false });
    } catch (err) {
      console.error("[api] cash-closing.loadShifts failed:", err);
      set({ loading: false });
    }
  },

  openShift: async (employee, storeId, openingBalance = 0) => {
    const open = get().shifts.find(
      (s) => s.storeId === storeId && s.status === "open",
    );
    if (open) {
      throw new Error("Close current shift first");
    }

    try {
      const raw = await api.post<Record<string, unknown>>("/cash/shifts", {
        employee,
        storeId,
        openingBalance: Math.max(0, openingBalance),
      });
      const shift = normalizeShift(raw);
      set({ shifts: [...get().shifts, shift] });
      return shift;
    } catch (err) {
      console.error("[api] cash-closing.openShift failed:", err);
      throw err;
    }
  },

  closeShift: async (shiftId) => {
    const shift = get().shifts.find((s) => s.id === shiftId);
    if (!shift) return;

    const now = new Date().toISOString();
    set({
      shifts: get().shifts.map((s) =>
        s.id === shiftId
          ? {
              ...s,
              status: "closed" as const,
              closeTime: now,
            }
          : s,
      ),
    });

    try {
      await api.put(`/cash/shifts/${shiftId}/close`, { closeTime: now });
    } catch (err) {
      console.error("[api] cash-closing.closeShift failed:", err);
    }
  },

  recordCashMovement: async (shiftId, type, amount, reason, createdBy, storeId, method = "cash") => {
    try {
      const raw = await api.post<Record<string, unknown>>("/cash/movements", {
        shiftId,
        type,
        amount,
        method,
        reason,
        createdBy,
        storeId,
      });
      const movement = normalizeMovement(raw);
      set({ cashMovements: [...get().cashMovements, movement] });
      return movement;
    } catch (err) {
      console.error("[api] cash-closing.recordCashMovement failed:", err);
      throw err;
    }
  },

  getShiftCashMovements: (shiftId) => {
    return get()
      .cashMovements.filter((m) => m.shiftId === shiftId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  reconcile: async (shiftId, declaredCash, completedSales) => {
    const shift = get().shifts.find((s) => s.id === shiftId);
    if (!shift) throw new Error("Shift not found");
    if (shift.status !== "closed")
      throw new Error("Cannot reconcile an open shift");

    const salesCash = computeExpectedCash(
      completedSales,
      shift.openTime,
      shift.closeTime!,
    );

    // Include cash movements in expected total
    const movements = get().cashMovements.filter(
      (m) => m.shiftId === shiftId && m.method === "cash",
    );
    const withdrawalsTotal = movements
      .filter((m) => m.type === "withdrawal")
      .reduce((sum, m) => sum + m.amount, 0);
    const depositsTotal = movements
      .filter((m) => m.type === "deposit")
      .reduce((sum, m) => sum + m.amount, 0);

    // Expected = sales in cash + opening balance - withdrawals + deposits
    const expectedTotal = salesCash + (shift.openingBalance ?? 0) - withdrawalsTotal + depositsTotal;
    const variance = computeVariance(declaredCash, expectedTotal);
    const reconciliationStatus = variance === 0 ? "matched" : "mismatch";

    const reconciledAt = new Date().toISOString();
    set({
      shifts: get().shifts.map((s) =>
        s.id === shiftId
          ? {
              ...s,
              declaredCash,
              variance,
              reconciliationStatus,
              reconciledAt,
            }
          : s,
      ),
    });

    try {
      await api.post("/cash/reconcile", {
        shiftId,
        declaredCash,
        expectedTotal,
        variance,
        reconciliationStatus,
        storeId: shift.storeId,
        reconciledAt,
      });
    } catch (err) {
      console.error("[api] cash-closing.reconcile failed:", err);
    }
  },

  getShiftSummary: (shiftId, completedSales) => {
    const shift = get().shifts.find((s) => s.id === shiftId);
    if (!shift) return null;

    // Open shifts keep the unbounded window they always had (referenceTime =
    // Infinity), so a sale dated after "now" still belongs to the shift.
    const shiftSales = salesInShift(completedSales, shift, Infinity);
    const totals = shiftPaymentTotals(shiftSales);

    // Cash movements
    const movements = get().cashMovements.filter((m) => m.shiftId === shiftId);
    const withdrawalsTotal = movements
      .filter((m) => m.type === "withdrawal")
      .reduce((sum, m) => sum + m.amount, 0);
    const depositsTotal = movements
      .filter((m) => m.type === "deposit")
      .reduce((sum, m) => sum + m.amount, 0);

    // Product aggregation comes from the helper; the report keeps ranking the
    // top 10 by units sold, which is its own presentation choice.
    const topProducts = shiftProducts(shiftSales)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    return {
      shift,
      totalSales: totals.total,
      cashTotal: totals.cash,
      cardTotal: totals.card,
      mercadopagoTotal: totals.mercadopago,
      transactionCount: totals.count,
      itemCount: shiftSales.reduce((sum, s) => sum + s.items.reduce((q, i) => q + i.quantity, 0), 0),
      topProducts,
      withdrawalsTotal,
      depositsTotal,
    };
  },

  getOpenShift: (storeId) => {
    return (
      get().shifts.find((s) => s.storeId === storeId && s.status === "open") ??
      null
    );
  },

  getShiftsByStore: (storeId) => {
    return get()
      .shifts.filter((s) => s.storeId === storeId)
      .sort((a, b) => b.id - a.id);
  },
}));
