import { describe, it, expect, beforeEach } from "vitest";
import { useCashClosingStore, computeExpectedCash, computeVariance } from "@/store/cash-closing";
import { useAppStore, type CompletedSale } from "@/store";

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Helpers
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function resetCashStore() {
  useCashClosingStore.setState({ shifts: [] });
}

function resetAppStore() {
  useAppStore.setState({
    items: [],
    lastCompletedSale: null,
    completedSales: [],
    busy: false,
    notification: null,
  });
}

beforeEach(() => {
  resetCashStore();
  resetAppStore();
});

/** Create a completed sale for testing. */
function makeSale(
  id: number,
  total: number,
  method: "cash" | "card",
  date: Date,
  items: { name: string; qty: number; subtotal: number }[] = [
    { name: "Product A", qty: 1, subtotal: total },
  ],
): CompletedSale {
  return {
    id,
    items: items.map((i) => ({
      productId: id,
      productName: i.name,
      quantity: i.qty,
      unitPrice: i.subtotal / i.qty,
      subtotal: i.subtotal,
      discountPercent: 0,
      saleUnit: "unit",
    })),
    createdBy: "admin",
    total,
    subtotal: total,
    discountPercent: 0,
    discountAmount: 0,
    paymentMethod: method,
    amountPaid: method === "cash" ? total : null,
    change: method === "cash" ? 0 : null,
    cashAmount: method === "cash" ? total : null,
    cardAmount: method === "card" ? total : null,
    mercadopagoAmount: null,
    date: date.toISOString(),
    storeId: "store_1",
    customerName: null,
    status: "completed" as const,
    priceListId: null,
  };
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// 4.5 â€” Shift lifecycle: open â†’ close
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("Shift lifecycle: open â†’ close", () => {
  it("opens a new shift with employee and store", () => {
    const shift = useCashClosingStore.getState().openShift("Juan PÃ©rez", "store_1");

    expect(shift.employee).toBe("Juan PÃ©rez");
    expect(shift.storeId).toBe("store_1");
    expect(shift.status).toBe("open");
    expect(shift.openTime).toBeTruthy();
    expect(shift.closeTime).toBeNull();
  });

  it("marks the shift as the open shift for the store", () => {
    useCashClosingStore.getState().openShift("Maria", "store_1");

    const open = useCashClosingStore.getState().getOpenShift("store_1");
    expect(open).not.toBeNull();
    expect(open!.employee).toBe("Maria");
    expect(open!.status).toBe("open");
  });

  it("is not visible as open for a different store", () => {
    useCashClosingStore.getState().openShift("Maria", "store_1");

    const open = useCashClosingStore.getState().getOpenShift("store_2");
    expect(open).toBeNull();
  });

  it("closes an open shift with a close timestamp", () => {
    const shift = useCashClosingStore.getState().openShift("Juan", "store_1");
    useCashClosingStore.getState().closeShift(shift.id);

    const closed = useCashClosingStore.getState().shifts.find((s) => s.id === shift.id)!;
    expect(closed.status).toBe("closed");
    expect(closed.closeTime).not.toBeNull();
    // Verify it's no longer the open shift
    expect(useCashClosingStore.getState().getOpenShift("store_1")).toBeNull();
  });

  it("lists all shifts for a store, newest first", () => {
    const s1 = useCashClosingStore.getState().openShift("Shift 1", "store_1");
    useCashClosingStore.getState().closeShift(s1.id);
    const s2 = useCashClosingStore.getState().openShift("Shift 2", "store_1");

    const storeShifts = useCashClosingStore.getState().getShiftsByStore("store_1");
    expect(storeShifts).toHaveLength(2);
    // Newest first (higher id = more recent)
    expect(storeShifts[0].employee).toBe("Shift 2");
    expect(storeShifts[1].employee).toBe("Shift 1");
  });

  it("does not return shifts from other stores", () => {
    useCashClosingStore.getState().openShift("Store 1 shift", "store_1");
    useCashClosingStore.getState().openShift("Store 2 shift", "store_2");

    const store1Shifts = useCashClosingStore.getState().getShiftsByStore("store_1");
    expect(store1Shifts).toHaveLength(1);
    expect(store1Shifts[0].employee).toBe("Store 1 shift");
  });
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// 4.5 â€” Double-open rejection
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("Double-open rejection", () => {
  it("throws when trying to open a second shift for the same store", () => {
    useCashClosingStore.getState().openShift("First", "store_1");

    expect(() => {
      useCashClosingStore.getState().openShift("Second", "store_1");
    }).toThrow(/close current shift first/i);
  });

  it("allows opening a shift for a different store while another is open", () => {
    useCashClosingStore.getState().openShift("Store 1 shift", "store_1");

    expect(() => {
      useCashClosingStore.getState().openShift("Store 2 shift", "store_2");
    }).not.toThrow();
  });

  it("allows opening a new shift after closing the previous one", () => {
    const s1 = useCashClosingStore.getState().openShift("First", "store_1");
    useCashClosingStore.getState().closeShift(s1.id);

    expect(() => {
      useCashClosingStore.getState().openShift("Second", "store_1");
    }).not.toThrow();
  });

  it("getOpenShift returns null after closing", () => {
    const s = useCashClosingStore.getState().openShift("Test", "store_1");
    useCashClosingStore.getState().closeShift(s.id);

    expect(useCashClosingStore.getState().getOpenShift("store_1")).toBeNull();
  });
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// 4.5 â€” Variance calculation
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("Variance calculation", () => {
  it("computeVariance returns positive variance", () => {
    expect(computeVariance(1000, 950)).toBe(50);
  });

  it("computeVariance returns negative variance", () => {
    expect(computeVariance(950, 1000)).toBe(-50);
  });

  it("computeVariance returns zero for exact match", () => {
    expect(computeVariance(1000, 1000)).toBe(0);
  });

  it("computeVariance handles cent precision", () => {
    expect(computeVariance(100.01, 99.99)).toBe(0.02);
    expect(computeVariance(99.99, 100.01)).toBe(-0.02);
  });

  it("computeExpectedCash sums only cash sales within time window", () => {
    const now = new Date();
    const before = new Date(now.getTime() - 3600000); // 1 hour ago
    const after = new Date(now.getTime() + 3600000);  // 1 hour later

    const sales: CompletedSale[] = [
      makeSale(1, 500, "cash", now),
      makeSale(2, 300, "card", now),
      makeSale(3, 200, "cash", before), // outside window (before open)
      makeSale(4, 100, "cash", after),  // outside window (after close)
    ];

    const expected = computeExpectedCash(sales, now.toISOString(), now.toISOString());
    // Only sale 1 is within window AND is cash
    expect(expected).toBe(500);
  });

  it("computeExpectedCash returns 0 when no cash sales in window", () => {
    const now = new Date();
    const sales: CompletedSale[] = [
      makeSale(1, 300, "card", now),
      makeSale(2, 500, "card", now),
    ];

    const expected = computeExpectedCash(sales, now.toISOString(), now.toISOString());
    expect(expected).toBe(0);
  });

  it("computeExpectedCash handles infinite close time (open shift)", () => {
    const now = new Date();
    const sales: CompletedSale[] = [
      makeSale(1, 400, "cash", now),
      makeSale(2, 200, "cash", new Date(now.getTime() + 86400000)), // 1 day later â€” within open shift
    ];

    const expected = computeExpectedCash(sales, now.toISOString(), null);
    expect(expected).toBe(600);
  });
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// 4.5 â€” Shift reconciliation
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("Shift reconciliation", () => {
  it("reconcile marks as matched when variance is zero", () => {
    const now = new Date();
    const shift = useCashClosingStore.getState().openShift("Juan", "store_1");
    useCashClosingStore.getState().closeShift(shift.id);

    const sales: CompletedSale[] = [
      makeSale(1, 1000, "cash", now),
    ];

    useCashClosingStore.getState().reconcile(shift.id, 1000, sales);

    const reconciled = useCashClosingStore.getState().shifts.find((s) => s.id === shift.id)!;
    expect(reconciled.reconciliationStatus).toBe("matched");
    expect(reconciled.declaredCash).toBe(1000);
    expect(reconciled.variance).toBe(0);
    expect(reconciled.reconciledAt).not.toBeNull();
  });

  it("reconcile marks as mismatched when variance is non-zero", () => {
    const now = new Date();
    const shift = useCashClosingStore.getState().openShift("Juan", "store_1");
    useCashClosingStore.getState().closeShift(shift.id);

    const sales: CompletedSale[] = [
      makeSale(1, 1000, "cash", now),
    ];

    useCashClosingStore.getState().reconcile(shift.id, 950, sales);

    const reconciled = useCashClosingStore.getState().shifts.find((s) => s.id === shift.id)!;
    expect(reconciled.reconciliationStatus).toBe("mismatch");
    expect(reconciled.declaredCash).toBe(950);
    expect(reconciled.variance).toBe(-50);
  });

  it("throws when reconciling an open shift", () => {
    const shift = useCashClosingStore.getState().openShift("Juan", "store_1");

    expect(() => {
      useCashClosingStore.getState().reconcile(shift.id, 500, []);
    }).toThrow(/cannot reconcile an open shift/i);
  });

  it("throws when shift does not exist", () => {
    expect(() => {
      useCashClosingStore.getState().reconcile(999, 500, []);
    }).toThrow(/shift not found/i);
  });

  it("card sales do not affect variance", () => {
    const now = new Date();
    const shift = useCashClosingStore.getState().openShift("Juan", "store_1");
    useCashClosingStore.getState().closeShift(shift.id);

    const sales: CompletedSale[] = [
      makeSale(1, 800, "cash", now),
      makeSale(2, 400, "card", now),
    ];

    // Cash in drawer = 800 (card doesn't go in drawer)
    useCashClosingStore.getState().reconcile(shift.id, 800, sales);

    const reconciled = useCashClosingStore.getState().shifts.find((s) => s.id === shift.id)!;
    expect(reconciled.reconciliationStatus).toBe("matched");
    expect(reconciled.variance).toBe(0);
  });
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// 4.5 â€” Shift Summary / Closure Report
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("Shift closure summary", () => {
  it("generates summary with sales breakdown", () => {
    const now = new Date();
    const shift = useCashClosingStore.getState().openShift("Juan", "store_1");
    useCashClosingStore.getState().closeShift(shift.id);

    const sales: CompletedSale[] = [
      makeSale(1, 800, "cash", now, [
        { name: "Coca-Cola", qty: 2, subtotal: 300 },
        { name: "Arroz", qty: 1, subtotal: 500 },
      ]),
      makeSale(2, 400, "card", now, [
        { name: "Leche", qty: 3, subtotal: 400 },
      ]),
    ];

    useCashClosingStore.getState().reconcile(shift.id, 800, sales);

    const summary = useCashClosingStore.getState().getShiftSummary(shift.id, sales);
    expect(summary).not.toBeNull();
    expect(summary!.totalSales).toBe(1200); // 800 + 400
    expect(summary!.cashTotal).toBe(800);
    expect(summary!.cardTotal).toBe(400);
    expect(summary!.transactionCount).toBe(2);
    expect(summary!.itemCount).toBe(6); // 2 + 1 + 3
  });

  it("returns top products sorted by quantity", () => {
    const now = new Date();
    const shift = useCashClosingStore.getState().openShift("Juan", "store_1");
    useCashClosingStore.getState().closeShift(shift.id);

    const sales: CompletedSale[] = [
      makeSale(1, 400, "cash", now, [
        { name: "Arroz", qty: 5, subtotal: 250 },
        { name: "Fideos", qty: 3, subtotal: 150 },
      ]),
      makeSale(2, 300, "cash", now, [
        { name: "Arroz", qty: 3, subtotal: 150 },
        { name: "Aceite", qty: 2, subtotal: 150 },
      ]),
    ];

    const summary = useCashClosingStore.getState().getShiftSummary(shift.id, sales);
    expect(summary!.topProducts).toHaveLength(3);
    expect(summary!.topProducts[0].name).toBe("Arroz");
    expect(summary!.topProducts[0].quantity).toBe(8);
    expect(summary!.topProducts[1].name).toBe("Fideos");
    expect(summary!.topProducts[1].quantity).toBe(3);
    expect(summary!.topProducts[2].name).toBe("Aceite");
    expect(summary!.topProducts[2].quantity).toBe(2);
  });

  it("returns empty top products for empty shift", () => {
    const shift = useCashClosingStore.getState().openShift("Juan", "store_1");
    useCashClosingStore.getState().closeShift(shift.id);

    const summary = useCashClosingStore.getState().getShiftSummary(shift.id, []);
    expect(summary).not.toBeNull();
    expect(summary!.totalSales).toBe(0);
    expect(summary!.transactionCount).toBe(0);
    expect(summary!.topProducts).toHaveLength(0);
  });

  it("returns null for non-existent shift", () => {
    const summary = useCashClosingStore.getState().getShiftSummary(999, []);
    expect(summary).toBeNull();
  });
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// 4.5 â€” Edge: No open shift cannot reconcile
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("Cannot reconcile without a closed shift", () => {
  it("throws if no shifts exist", () => {
    expect(() => {
      useCashClosingStore.getState().reconcile(999, 100, []);
    }).toThrow(/shift not found/i);
  });

  it("throws when trying to reconcile an open shift", () => {
    const shift = useCashClosingStore.getState().openShift("Juan", "store_1");
    expect(() => {
      useCashClosingStore.getState().reconcile(shift.id, 100, []);
    }).toThrow(/cannot reconcile an open shift/i);
  });
});
