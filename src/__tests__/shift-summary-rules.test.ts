import { describe, it, expect, beforeEach } from "vitest";
import { useCashClosingStore, computeExpectedCash } from "@/store/cash-closing";
import type { Shift } from "@/store/cash-closing";
import { useAppStore, type CompletedSale } from "@/store";

/**
 * Pins the arithmetic the shift reports depends on after it was consolidated
 * into lib/shift-sales: one rule per behaviour, so a future "cleanup" cannot
 * silently change the money.
 */

beforeEach(() => {
  useCashClosingStore.setState({ shifts: [], cashMovements: [], loading: false });
  useAppStore.setState({
    items: [],
    lastCompletedSale: null,
    completedSales: [],
    busy: false,
    notification: null,
  });
});

interface SaleOptions {
  method?: CompletedSale["paymentMethod"];
  date: string;
  total?: number;
  cashAmount?: number | null;
  cardAmount?: number | null;
  mercadopagoAmount?: number | null;
  shiftId?: number | null;
  items?: { productName: string; quantity: number; subtotal: number }[];
}

function sale(id: number, options: SaleOptions): CompletedSale {
  const total = options.total ?? 0;
  return {
    id,
    items: (options.items ?? [{ productName: `P${id}`, quantity: 1, subtotal: total }]).map((i) => ({
      productId: id,
      productName: i.productName,
      quantity: i.quantity,
      unitPrice: i.subtotal / i.quantity,
      subtotal: i.subtotal,
      discountPercent: 0,
      saleUnit: "unit" as const,
    })),
    total,
    subtotal: total,
    iva: 0,
    discountPercent: 0,
    discountAmount: 0,
    paymentMethod: options.method ?? "cash",
    amountPaid: total,
    cashAmount: options.cashAmount ?? null,
    cardAmount: options.cardAmount ?? null,
    mercadopagoAmount: options.mercadopagoAmount ?? null,
    change: 0,
    date: options.date,
    storeId: "store_1",
    customerName: null,
    createdBy: "cajero",
    status: "completed",
    priceListId: null,
    shiftId: options.shiftId ?? null,
  };
}

function shift(overrides: Partial<Record<string, unknown>> = {}): Shift {
  return {
    id: 1,
    employee: "cajero",
    openTime: "2026-01-10T10:00:00.000Z",
    closeTime: "2026-01-10T14:00:00.000Z",
    status: "closed",
    openingBalance: 0,
    declaredCash: null,
    variance: null,
    reconciliationStatus: "pending",
    storeId: "store_1",
    ...overrides,
  } as unknown as Shift;
}

describe("computeExpectedCash — the money in the drawer", () => {
  it("counts only the cash portion of a mixed sale", () => {
    const sales = [
      sale(1, { date: "2026-01-10T11:00:00.000Z", method: "mixed", total: 300, cashAmount: 100, cardAmount: 200 }),
      sale(2, { date: "2026-01-10T11:30:00.000Z", method: "card", total: 500 }),
      sale(3, { date: "2026-01-10T12:00:00.000Z", method: "mercadopago", total: 400 }),
    ];

    expect(computeExpectedCash(sales, "2026-01-10T10:00:00.000Z", "2026-01-10T14:00:00.000Z")).toBe(100);
  });

  it("ignores a credit sale: it brings no cash to the drawer", () => {
    const sales = [
      sale(1, { date: "2026-01-10T11:00:00.000Z", method: "credit", total: 900 }),
      sale(2, { date: "2026-01-10T11:10:00.000Z", method: "cash", total: 50 }),
    ];

    expect(computeExpectedCash(sales, "2026-01-10T10:00:00.000Z", "2026-01-10T14:00:00.000Z")).toBe(50);
  });

  it("rounds the drawer to cents instead of carrying float residue", () => {
    const sales = [
      sale(1, { date: "2026-01-10T11:00:00.000Z", method: "cash", total: 33.333 }),
      sale(2, { date: "2026-01-10T11:05:00.000Z", method: "cash", total: 33.333 }),
    ];

    expect(computeExpectedCash(sales, "2026-01-10T10:00:00.000Z", "2026-01-10T14:00:00.000Z")).toBe(66.67);
  });
});

describe("getShiftSummary — report numbers", () => {
  it("keeps an open shift unbounded: a sale dated after now still belongs to it", () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    useCashClosingStore.setState({
      shifts: [shift({ id: 1, closeTime: null, status: "open" })],
    });
    const sales = [sale(1, { date: future, method: "cash", total: 700 })];

    const summary = useCashClosingStore.getState().getShiftSummary(1, sales);

    expect(summary?.transactionCount).toBe(1);
    expect(summary?.cashTotal).toBe(700);
    expect(summary?.totalSales).toBe(700);
  });

  it("splits cash, card and Mercado Pago, factoring in the mixed portions", () => {
    useCashClosingStore.setState({ shifts: [shift({ id: 1 })] });
    const sales = [
      sale(1, { date: "2026-01-10T11:00:00.000Z", method: "cash", total: 100 }),
      sale(2, { date: "2026-01-10T11:10:00.000Z", method: "card", total: 200 }),
      sale(3, { date: "2026-01-10T11:20:00.000Z", method: "mercadopago", total: 50 }),
      sale(4, {
        date: "2026-01-10T11:30:00.000Z",
        method: "mixed",
        total: 300,
        cashAmount: 100,
        cardAmount: 150,
        mercadopagoAmount: 50,
      }),
    ];

    const summary = useCashClosingStore.getState().getShiftSummary(1, sales);

    expect(summary?.cashTotal).toBe(200);
    expect(summary?.cardTotal).toBe(350);
    expect(summary?.mercadopagoTotal).toBe(100);
    expect(summary?.totalSales).toBe(650);
    expect(summary?.transactionCount).toBe(4);
  });

  it("ranks the top ten by UNITS sold, not by money", () => {
    // 12 products: the cheapest one sells the most units, the priciest sells one.
    const items = Array.from({ length: 12 }, (_, i) => ({
      productName: `Producto ${i + 1}`,
      quantity: i === 11 ? 20 : 1,
      subtotal: i === 0 ? 90000 : 1000,
    }));
    useCashClosingStore.setState({ shifts: [shift({ id: 1 })] });
    const sales = [sale(1, { date: "2026-01-10T11:00:00.000Z", method: "cash", total: 111000, items })];

    const summary = useCashClosingStore.getState().getShiftSummary(1, sales);
    const top = summary?.topProducts ?? [];

    // 12 products sold, the report shows only its top ten
    expect(top).toHaveLength(10);
    // First by units (20) even though the priciest product made 90x more money
    expect(top[0]).toEqual({ name: "Producto 12", quantity: 20, total: 1000 });
    expect(top.some((p) => p.total === 90000)).toBe(true);
  });

  it("trusts an explicit shift id over the clock, both ways", () => {
    useCashClosingStore.setState({ shifts: [shift({ id: 1 })] });
    const sales = [
      // Outside the window but linked to this shift
      sale(1, { date: "2026-01-10T18:00:00.000Z", method: "cash", total: 100, shiftId: 1 }),
      // Inside the window but belonging to another shift
      sale(2, { date: "2026-01-10T11:00:00.000Z", method: "cash", total: 500, shiftId: 2 }),
      // Legacy row without a shift id: the window decides
      sale(3, { date: "2026-01-10T12:00:00.000Z", method: "cash", total: 50 }),
    ];

    const summary = useCashClosingStore.getState().getShiftSummary(1, sales);

    expect(summary?.transactionCount).toBe(2);
    expect(summary?.cashTotal).toBe(150);
  });
});
