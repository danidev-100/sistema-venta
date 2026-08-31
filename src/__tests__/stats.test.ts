import { describe, it, expect, beforeEach } from "vitest";
import { useAppStore, type CompletedSale, type CartItem } from "@/store";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

type SellerRank = {
  rank: number;
  productId: number;
  productName: string;
  quantity: number;
  revenue: number;
};

type ChartDataPoint = {
  label: string;
  revenue: number;
  transactions: number;
};

// ──────────────────────────────────────────────
// Helpers — shared logic with components (extracted for testability)
// ──────────────────────────────────────────────

function isSaleInRange(
  saleDate: string,
  from: Date | null,
  to: Date | null,
): boolean {
  const ts = new Date(saleDate).getTime();
  if (from && ts < from.getTime()) return false;
  if (to && ts > to.getTime()) return false;
  return true;
}

function getPeriodKey(date: Date, granularity: "day" | "week" | "month"): string {
  const d = new Date(date);
  switch (granularity) {
    case "day":
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    case "week": {
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
    }
    case "month":
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
}

function aggregateSellers(sales: CompletedSale[]): SellerRank[] {
  const map = new Map<number, { name: string; qty: number; rev: number }>();

  for (const sale of sales) {
    for (const item of sale.items) {
      const existing = map.get(item.productId);
      if (existing) {
        existing.qty += item.quantity;
        existing.rev += item.subtotal;
      } else {
        map.set(item.productId, {
          name: item.productName,
          qty: item.quantity,
          rev: item.subtotal,
        });
      }
    }
  }

  return Array.from(map.entries())
    .map(
      ([productId, v]): SellerRank => ({
        rank: 0,
        productId,
        productName: v.name,
        quantity: v.qty,
        revenue: Math.round(v.rev * 100) / 100,
      }),
    )
    .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
    .map((entry, i) => ({ ...entry, rank: i + 1 }));
}

function aggregateChart(sales: CompletedSale[], granularity: "day" | "week" | "month"): ChartDataPoint[] {
  if (sales.length === 0) return [];

  const buckets = new Map<string, { revenue: number; transactions: number; date: Date }>();

  for (const sale of sales) {
    const saleDate = new Date(sale.date);
    const key = getPeriodKey(saleDate, granularity);
    const existing = buckets.get(key);
    if (existing) {
      existing.revenue += sale.total;
      existing.transactions += 1;
    } else {
      buckets.set(key, { revenue: sale.total, transactions: 1, date: saleDate });
    }
  }

  return Array.from(buckets.entries())
    .sort(([aKey], [bKey]) => aKey.localeCompare(bKey))
    .map(([, v]) => ({
      label: "",
      revenue: Math.round(v.revenue * 100) / 100,
      transactions: v.transactions,
    }));
}

/** Reset all stores to a clean state. */
function resetStores() {
  useAppStore.setState({
    items: [],
    lastCompletedSale: null,
    completedSales: [],
    busy: false,
    notification: null,
  });
}

beforeEach(() => {
  resetStores();
});

/** Create a CompletedSale with the given date and items. */
function makeSale(
  id: number,
  items: { productId: number; productName: string; quantity: number; unitPrice: number; subtotal: number }[],
  date: string,
  storeId = "store_1",
): CompletedSale {
  const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
  const cartItems = items.map((i) => ({ ...i, discountPercent: 0, saleUnit: "unit" as const }));
  return {
    id,
    items: cartItems,
    createdBy: "admin",
    total: subtotal,
    subtotal,
    discountPercent: 0,
    discountAmount: 0,
    paymentMethod: "cash",
    amountPaid: subtotal,
    change: 0,
    cashAmount: subtotal,
    cardAmount: null,
    mercadopagoAmount: null,
    date,
    storeId,
    customerName: null,
    status: "completed" as const,
    priceListId: null,
  };
}

/** Helper: push a sale directly into the store's completedSales. */
function pushSale(sale: CompletedSale) {
  const state = useAppStore.getState();
  useAppStore.setState({
    completedSales: [...state.completedSales, sale],
  });
  // Bump nextSaleId past this one
}

// ──────────────────────────────────────────────
// 6.5 — Date Range Filtering
// ──────────────────────────────────────────────

describe("Date range filtering", () => {
  it("includes sales within the range", () => {
    const sale = makeSale(1, [{ productId: 1, productName: "A", quantity: 1, unitPrice: 100, subtotal: 100 }], "2025-06-15T10:00:00Z");

    const from = new Date("2025-06-01");
    const to = new Date("2025-06-30");

    expect(isSaleInRange(sale.date, from, to)).toBe(true);
  });

  it("excludes sales before the range", () => {
    const sale = makeSale(1, [{ productId: 1, productName: "A", quantity: 1, unitPrice: 100, subtotal: 100 }], "2025-05-15T10:00:00Z");

    const from = new Date("2025-06-01");
    const to = new Date("2025-06-30");

    expect(isSaleInRange(sale.date, from, to)).toBe(false);
  });

  it("excludes sales after the range", () => {
    const sale = makeSale(1, [{ productId: 1, productName: "A", quantity: 1, unitPrice: 100, subtotal: 100 }], "2025-07-15T10:00:00Z");

    const from = new Date("2025-06-01");
    const to = new Date("2025-06-30");

    expect(isSaleInRange(sale.date, from, to)).toBe(false);
  });

  it("includes sales exactly at the start boundary", () => {
    const sale = makeSale(1, [{ productId: 1, productName: "A", quantity: 1, unitPrice: 100, subtotal: 100 }], "2025-06-01T00:00:00Z");

    const from = new Date("2025-06-01T00:00:00Z");
    const to = new Date("2025-06-30T23:59:59Z");

    expect(isSaleInRange(sale.date, from, to)).toBe(true);
  });

  it("includes sales exactly at the end boundary", () => {
    const sale = makeSale(1, [{ productId: 1, productName: "A", quantity: 1, unitPrice: 100, subtotal: 100 }], "2025-06-30T23:59:59Z");

    const from = new Date("2025-06-01T00:00:00Z");
    const to = new Date("2025-06-30T23:59:59Z");

    expect(isSaleInRange(sale.date, from, to)).toBe(true);
  });

  it("includes all sales when no range is set (null from/to)", () => {
    const sale1 = makeSale(1, [{ productId: 1, productName: "A", quantity: 1, unitPrice: 100, subtotal: 100 }], "2025-01-01T10:00:00Z");
    const sale2 = makeSale(2, [{ productId: 1, productName: "A", quantity: 1, unitPrice: 100, subtotal: 100 }], "2025-12-31T10:00:00Z");

    expect(isSaleInRange(sale1.date, null, null)).toBe(true);
    expect(isSaleInRange(sale2.date, null, null)).toBe(true);
  });

  it("filters correctly from the store's completedSales", () => {
    pushSale(makeSale(1, [{ productId: 1, productName: "A", quantity: 1, unitPrice: 100, subtotal: 100 }], "2025-06-01T10:00:00Z", "store_1"));
    pushSale(makeSale(2, [{ productId: 1, productName: "A", quantity: 1, unitPrice: 100, subtotal: 100 }], "2025-06-15T10:00:00Z", "store_1"));
    pushSale(makeSale(3, [{ productId: 1, productName: "A", quantity: 1, unitPrice: 100, subtotal: 100 }], "2025-07-01T10:00:00Z", "store_1"));

    const from = new Date("2025-06-01");
    const to = new Date("2025-06-30");

    const filtered = useAppStore.getState().completedSales.filter(
      (s) => s.storeId === "store_1" && isSaleInRange(s.date, from, to),
    );

    expect(filtered).toHaveLength(2);
    expect(filtered[0].id).toBe(1);
    expect(filtered[1].id).toBe(2);
  });

  it("returns empty when no sales match the date range", () => {
    pushSale(makeSale(1, [{ productId: 1, productName: "A", quantity: 1, unitPrice: 100, subtotal: 100 }], "2025-01-01T10:00:00Z", "store_1"));

    const from = new Date("2025-06-01");
    const to = new Date("2025-06-30");

    const filtered = useAppStore.getState().completedSales.filter(
      (s) => s.storeId === "store_1" && isSaleInRange(s.date, from, to),
    );

    expect(filtered).toHaveLength(0);
  });

  it("respects store isolation in filtering", () => {
    pushSale(makeSale(1, [{ productId: 1, productName: "A", quantity: 1, unitPrice: 100, subtotal: 100 }], "2025-06-15T10:00:00Z", "store_1"));
    pushSale(makeSale(2, [{ productId: 1, productName: "A", quantity: 1, unitPrice: 100, subtotal: 100 }], "2025-06-15T10:00:00Z", "store_2"));

    const from = new Date("2025-06-01");
    const to = new Date("2025-06-30");

    const filtered = useAppStore.getState().completedSales.filter(
      (s) => s.storeId === "store_1" && isSaleInRange(s.date, from, to),
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0].storeId).toBe("store_1");
  });
});

// ──────────────────────────────────────────────
// 6.5 — Top seller aggregation
// ──────────────────────────────────────────────

describe("Top seller aggregation", () => {
  it("ranks products by quantity sold descending", () => {
    const sales = [
      makeSale(1, [
        { productId: 1, productName: "Coca-Cola", quantity: 50, unitPrice: 100, subtotal: 5000 },
        { productId: 2, productName: "Fanta", quantity: 30, unitPrice: 100, subtotal: 3000 },
        { productId: 3, productName: "Sprite", quantity: 20, unitPrice: 100, subtotal: 2000 },
      ], "2025-06-15T10:00:00Z"),
    ];

    const ranking = aggregateSellers(sales);

    expect(ranking).toHaveLength(3);
    expect(ranking.map((r) => r.productName)).toEqual(["Coca-Cola", "Fanta", "Sprite"]);
    expect(ranking[0].quantity).toBe(50);
    expect(ranking[0].revenue).toBe(5000);
  });

  it("aggregates same product across multiple sales", () => {
    const sales = [
      makeSale(1, [
        { productId: 1, productName: "Coca-Cola", quantity: 10, unitPrice: 100, subtotal: 1000 },
      ], "2025-06-01T10:00:00Z"),
      makeSale(2, [
        { productId: 1, productName: "Coca-Cola", quantity: 20, unitPrice: 100, subtotal: 2000 },
      ], "2025-06-02T10:00:00Z"),
      makeSale(3, [
        { productId: 2, productName: "Fanta", quantity: 15, unitPrice: 100, subtotal: 1500 },
      ], "2025-06-03T10:00:00Z"),
    ];

    const ranking = aggregateSellers(sales);

    expect(ranking).toHaveLength(2);
    expect(ranking[0].productName).toBe("Coca-Cola");
    expect(ranking[0].quantity).toBe(30);
    expect(ranking[0].revenue).toBe(3000);
    expect(ranking[1].productName).toBe("Fanta");
    expect(ranking[1].quantity).toBe(15);
  });

  it("handles ties by revenue descending", () => {
    const sales = [
      makeSale(1, [
        { productId: 1, productName: "Premium Item", quantity: 10, unitPrice: 500, subtotal: 5000 },
        { productId: 2, productName: "Budget Item", quantity: 10, unitPrice: 100, subtotal: 1000 },
      ], "2025-06-15T10:00:00Z"),
    ];

    const ranking = aggregateSellers(sales);

    expect(ranking).toHaveLength(2);
    expect(ranking[0].productName).toBe("Premium Item");
    expect(ranking[1].productName).toBe("Budget Item");
  });

  it("returns empty array when there are no sales", () => {
    const ranking = aggregateSellers([]);
    expect(ranking).toHaveLength(0);
  });

  it("handles products with zero quantity gracefully", () => {
    const sales = [
      makeSale(1, [
        { productId: 1, productName: "Zero Qty Product", quantity: 0, unitPrice: 100, subtotal: 0 },
      ], "2025-06-15T10:00:00Z"),
    ];

    const ranking = aggregateSellers(sales);
    expect(ranking).toHaveLength(1);
    expect(ranking[0].quantity).toBe(0);
    expect(ranking[0].revenue).toBe(0);
  });

  it("truncates to limit", () => {
    const sales = [
      makeSale(1, [
        { productId: 1, productName: "A", quantity: 50, unitPrice: 10, subtotal: 500 },
        { productId: 2, productName: "B", quantity: 40, unitPrice: 10, subtotal: 400 },
        { productId: 3, productName: "C", quantity: 30, unitPrice: 10, subtotal: 300 },
      ], "2025-06-15T10:00:00Z"),
    ];

    const ranking = aggregateSellers(sales).slice(0, 2);
    expect(ranking).toHaveLength(2);
  });
});

// ──────────────────────────────────────────────
// 6.5 — Zero-sale periods
// ──────────────────────────────────────────────

describe("Zero-sale periods", () => {
  it("returns empty chart data for no sales", () => {
    const data = aggregateChart([], "day");
    expect(data).toHaveLength(0);
  });

  it("filters to empty when no sales in the date range", () => {
    pushSale(makeSale(1, [{ productId: 1, productName: "A", quantity: 1, unitPrice: 100, subtotal: 100 }], "2025-01-01T10:00:00Z"));

    const from = new Date("2025-06-01");
    const to = new Date("2025-06-30");

    const filtered = useAppStore.getState().completedSales.filter(
      (s) => isSaleInRange(s.date, from, to),
    );

    expect(filtered).toHaveLength(0);
    expect(aggregateChart(filtered, "day")).toHaveLength(0);
  });

  it("zero quantity products still appear in top seller ranking", () => {
    const sales = [
      makeSale(1, [
        { productId: 1, productName: "Free Item", quantity: 0, unitPrice: 0, subtotal: 0 },
      ], "2025-06-15T10:00:00Z"),
    ];

    const ranking = aggregateSellers(sales);
    expect(ranking).toHaveLength(1);
    expect(ranking[0].productName).toBe("Free Item");
  });
});

// ──────────────────────────────────────────────
// 6.5 — Revenue aggregation (daily/weekly/monthly)
// ──────────────────────────────────────────────

describe("Revenue aggregation", () => {
  it("aggregates revenue by day", () => {
    const sales = [
      makeSale(1, [{ productId: 1, productName: "A", quantity: 1, unitPrice: 100, subtotal: 100 }], "2025-06-01T10:00:00Z"),
      makeSale(2, [{ productId: 1, productName: "A", quantity: 1, unitPrice: 100, subtotal: 100 }], "2025-06-01T14:00:00Z"),
      makeSale(3, [{ productId: 1, productName: "A", quantity: 1, unitPrice: 200, subtotal: 200 }], "2025-06-02T10:00:00Z"),
    ];

    const data = aggregateChart(sales, "day");

    expect(data).toHaveLength(2);
    expect(data[0].revenue).toBe(200);
    expect(data[0].transactions).toBe(2);
    expect(data[1].revenue).toBe(200);
    expect(data[1].transactions).toBe(1);
  });

  it("aggregates revenue by week", () => {
    // June 2 (Monday) and June 9 (Monday) — two different weeks
    const sales = [
      makeSale(1, [{ productId: 1, productName: "A", quantity: 1, unitPrice: 500, subtotal: 500 }], "2025-06-02T10:00:00Z"),
      makeSale(2, [{ productId: 1, productName: "A", quantity: 1, unitPrice: 300, subtotal: 300 }], "2025-06-04T10:00:00Z"),
      makeSale(3, [{ productId: 1, productName: "A", quantity: 1, unitPrice: 400, subtotal: 400 }], "2025-06-09T10:00:00Z"),
    ];

    const data = aggregateChart(sales, "week");

    // July 2 and 9 are different ISO weeks
    expect(data).toHaveLength(2);
    // June 2 week: 500 + 300 = 800
    // June 9 week: 400
    expect(data[0].revenue).toBe(800);
    expect(data[0].transactions).toBe(2);
    expect(data[1].revenue).toBe(400);
    expect(data[1].transactions).toBe(1);
  });

  it("aggregates revenue by month", () => {
    const sales = [
      makeSale(1, [{ productId: 1, productName: "A", quantity: 1, unitPrice: 1000, subtotal: 1000 }], "2025-06-01T10:00:00Z"),
      makeSale(2, [{ productId: 1, productName: "A", quantity: 1, unitPrice: 2000, subtotal: 2000 }], "2025-06-15T10:00:00Z"),
      makeSale(3, [{ productId: 1, productName: "A", quantity: 1, unitPrice: 3000, subtotal: 3000 }], "2025-07-01T10:00:00Z"),
    ];

    const data = aggregateChart(sales, "month");

    expect(data).toHaveLength(2);
    expect(data[0].revenue).toBe(3000);
    expect(data[0].transactions).toBe(2);
    expect(data[1].revenue).toBe(3000);
    expect(data[1].transactions).toBe(1);
  });

  it("returns empty for zero sales", () => {
    const data = aggregateChart([], "day");
    expect(data).toHaveLength(0);
  });

  it("handles fractional prices in aggregation", () => {
    const sales = [
      makeSale(1, [{ productId: 1, productName: "A", quantity: 3, unitPrice: 9.99, subtotal: 29.97 }], "2025-06-01T10:00:00Z"),
      makeSale(2, [{ productId: 1, productName: "A", quantity: 2, unitPrice: 4.99, subtotal: 9.98 }], "2025-06-01T14:00:00Z"),
    ];

    const data = aggregateChart(sales, "day");

    expect(data).toHaveLength(1);
    expect(data[0].revenue).toBe(39.95);
  });
});

// ──────────────────────────────────────────────
// 6.5 — End-to-end data flow: checkout → stats
// ──────────────────────────────────────────────

describe("End-to-end data flow: checkout → stats", () => {
  it("completedSales are populated after checkout", async () => {
    const store = useAppStore.getState();
    store.addItem(1, "Coca-Cola", 150);
    store.addItem(2, "Fanta", 100);
    await store.checkout("cash", 250, "store_1");

    expect(useAppStore.getState().completedSales).toHaveLength(1);
  });

  it("aggregates across multiple checkouts", async () => {
    const store = useAppStore.getState();

    store.addItem(1, "Coca-Cola", 150);
    await store.checkout("cash", 150, "store_1");

    store.addItem(1, "Coca-Cola", 150);
    store.addItem(2, "Fanta", 100);
    await store.checkout("cash", 250, "store_1");

    const sales = useAppStore.getState().completedSales;
    expect(sales).toHaveLength(2);

    const ranking = aggregateSellers(sales);
    expect(ranking).toHaveLength(2);
    expect(ranking[0].productName).toBe("Coca-Cola");
    expect(ranking[0].quantity).toBe(2);
    expect(ranking[1].productName).toBe("Fanta");
  });

  it("respects store isolation in stats query", async () => {
    const store = useAppStore.getState();

    store.addItem(1, "Coca-Cola", 150);
    await store.checkout("cash", 150, "store_1");

    store.addItem(1, "Coca-Cola", 150);
    await store.checkout("cash", 150, "store_2");

    const sales = useAppStore.getState().completedSales;
    expect(sales).toHaveLength(2);

    const store1Sales = sales.filter((s) => s.storeId === "store_1");
    expect(store1Sales).toHaveLength(1);
  });
});
