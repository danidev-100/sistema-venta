import { create } from "zustand";
import type { CompletedSale } from "@/store";
import { api } from "@/lib/api";

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

/** Compute expected cash — sum of cash-method sales + mixed cash portions within a time window. */
export function computeExpectedCash(
  sales: CompletedSale[],
  openTime: string,
  closeTime: string | null,
): number {
  const open = new Date(openTime).getTime();
  const close = closeTime ? new Date(closeTime).getTime() : Infinity;

  return sales
    .filter((s) => {
      const t = new Date(s.date).getTime();
      return t >= open && t <= close;
    })
    .reduce((sum, s) => {
      if (s.paymentMethod === "cash") return sum + s.total;
      if (s.paymentMethod === "mixed") return sum + (s.cashAmount ?? 0);
      return sum;
    }, 0);
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

    const open = new Date(shift.openTime).getTime();
    const close = shift.closeTime
      ? new Date(shift.closeTime).getTime()
      : Infinity;

    const shiftSales = completedSales.filter((s) => {
      const t = new Date(s.date).getTime();
      return t >= open && t <= close;
    });

    const cashTotal = shiftSales.reduce((sum, s) => {
      if (s.paymentMethod === "cash") return sum + s.total;
      if (s.paymentMethod === "mixed") return sum + (s.cashAmount ?? 0);
      return sum;
    }, 0);

    const cardTotal = shiftSales.reduce((sum, s) => {
      if (s.paymentMethod === "card") return sum + s.total;
      if (s.paymentMethod === "mixed") return sum + (s.cardAmount ?? 0);
      return sum;
    }, 0);

    const mercadopagoTotal = shiftSales.reduce((sum, s) => {
      if (s.paymentMethod === "mercadopago") return sum + s.total;
      if (s.paymentMethod === "mixed") return sum + (s.mercadopagoAmount ?? 0);
      return sum;
    }, 0);

    const totalSales = Math.round((cashTotal + cardTotal + mercadopagoTotal) * 100) / 100;

    // Cash movements
    const movements = get().cashMovements.filter((m) => m.shiftId === shiftId);
    const withdrawalsTotal = movements
      .filter((m) => m.type === "withdrawal")
      .reduce((sum, m) => sum + m.amount, 0);
    const depositsTotal = movements
      .filter((m) => m.type === "deposit")
      .reduce((sum, m) => sum + m.amount, 0);

    // Build product aggregation
    const productMap = new Map<string, { quantity: number; total: number }>();
    for (const sale of shiftSales) {
      for (const item of sale.items) {
        const existing = productMap.get(item.productName);
        if (existing) {
          existing.quantity += item.quantity;
          existing.total += item.subtotal;
        } else {
          productMap.set(item.productName, {
            quantity: item.quantity,
            total: item.subtotal,
          });
        }
      }
    }

    const topProducts = [...productMap.entries()]
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    return {
      shift,
      totalSales,
      cashTotal: Math.round(cashTotal * 100) / 100,
      cardTotal: Math.round(cardTotal * 100) / 100,
      mercadopagoTotal: Math.round(mercadopagoTotal * 100) / 100,
      transactionCount: shiftSales.length,
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
