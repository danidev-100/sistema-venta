import { describe, it, expect } from "vitest";
import { salesInShift, shiftPaymentTotals, shiftProducts } from "@/lib/shift-sales";
import type { CompletedSale } from "@/store";

function sale(overrides: Partial<CompletedSale> = {}): CompletedSale {
  return {
    id: 1,
    items: [],
    total: 0,
    subtotal: 0,
    paymentMethod: "cash",
    date: "2026-01-10T12:00:00.000Z",
    storeId: "s1",
    createdBy: "admin",
    status: "completed",
    ...overrides,
  } as CompletedSale;
}

describe("salesInShift", () => {
  it("keeps only the sales inside the shift window, edges included", () => {
    const shift = {
      openTime: "2026-01-10T10:00:00.000Z",
      closeTime: "2026-01-10T14:00:00.000Z",
    };
    const inside = sale({ id: 1, date: "2026-01-10T12:00:00.000Z" });
    const atOpen = sale({ id: 2, date: "2026-01-10T10:00:00.000Z" });
    const atClose = sale({ id: 3, date: "2026-01-10T14:00:00.000Z" });
    const before = sale({ id: 4, date: "2026-01-10T09:59:59.000Z" });
    const after = sale({ id: 5, date: "2026-01-10T14:00:01.000Z" });

    const result = salesInShift([inside, atOpen, atClose, before, after], shift);

    expect(result.map((s) => s.id)).toEqual([1, 2, 3]);
  });

  it("trusts the sale shift id over the clock, in both directions", () => {
    const shift = {
      id: 7,
      openTime: "2026-01-10T10:00:00.000Z",
      closeTime: "2026-01-10T14:00:00.000Z",
    };
    // Inside the window but belongs to another shift -> excluded
    const otherShift = sale({ id: 1, shiftId: 8, date: "2026-01-10T12:00:00.000Z" });
    // Outside the window but explicitly linked to this shift -> included
    const lateLinked = sale({ id: 2, shiftId: 7, date: "2026-01-10T16:00:00.000Z" });
    // No shift id -> falls back to the window
    const legacy = sale({ id: 3, shiftId: null, date: "2026-01-10T12:30:00.000Z" });

    const result = salesInShift([otherShift, lateLinked, legacy], shift);

    expect(result.map((s) => s.id)).toEqual([2, 3]);
  });

  it("uses the reference time as the end of an open shift", () => {
    const shift = { openTime: "2026-01-10T10:00:00.000Z", closeTime: null };
    const inside = sale({ id: 1, date: "2026-01-10T11:00:00.000Z" });
    const later = sale({ id: 2, date: "2026-01-10T15:00:00.000Z" });

    const result = salesInShift([inside, later], shift, new Date("2026-01-10T12:00:00.000Z").getTime());

    expect(result.map((s) => s.id)).toEqual([1]);
  });
});

describe("shiftPaymentTotals", () => {
  it("splits each payment method and counts the cash part of a mixed sale", () => {
    const sales = [
      sale({ id: 1, paymentMethod: "cash", total: 100 }),
      sale({ id: 2, paymentMethod: "card", total: 200 }),
      sale({ id: 3, paymentMethod: "mercadopago", total: 50 }),
      sale({ id: 4, paymentMethod: "mixed", total: 300, cashAmount: 100, cardAmount: 150, mercadopagoAmount: 50 }),
    ];

    expect(shiftPaymentTotals(sales)).toEqual({ cash: 200, card: 350, mercadopago: 100, total: 650, count: 4 });
  });

  it("ignores a credit sale when counting money collected and rounds to cents", () => {
    const sales = [
      sale({ id: 1, paymentMethod: "cash", total: 33.333 }),
      sale({ id: 2, paymentMethod: "cash", total: 33.333 }),
      sale({ id: 3, paymentMethod: "credit", total: 500 }),
    ];

    const totals = shiftPaymentTotals(sales);

    expect(totals.cash).toBe(66.67);
    expect(totals.total).toBe(66.67);
    expect(totals.count).toBe(3);
  });

  it("returns zeroed totals for a shift without sales", () => {
    expect(shiftPaymentTotals([])).toEqual({ cash: 0, card: 0, mercadopago: 0, total: 0, count: 0 });
  });
});

describe("shiftProducts", () => {
  it("adds the same product across sales and sorts by money sold", () => {
    const sales = [
      sale({
        id: 1,
        items: [
          { productId: 1, productName: "Coca-Cola 500ml", quantity: 2, unitPrice: 1400, subtotal: 2800, discountPercent: 0, saleUnit: "unit" },
          { productId: 2, productName: "toner", quantity: 1, unitPrice: 10000, subtotal: 10000, discountPercent: 0, saleUnit: "unit" },
        ],
      }),
      sale({
        id: 2,
        items: [{ productId: 1, productName: "Coca-Cola 500ml", quantity: 3, unitPrice: 1400, subtotal: 4200, discountPercent: 0, saleUnit: "unit" }],
      }),
    ];

    expect(shiftProducts(sales)).toEqual([
      { name: "Coca-Cola 500ml", quantity: 5, total: 7000 },
      { name: "toner", quantity: 1, total: 10000 },
    ].sort((a, b) => b.total - a.total));
  });

  it("returns an empty list when nothing was sold", () => {
    expect(shiftProducts([])).toEqual([]);
  });
});
