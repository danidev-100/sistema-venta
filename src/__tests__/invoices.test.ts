import { describe, it, expect, beforeEach } from "vitest";
import { useInvoicesStore } from "@/store/invoices";
import { useAppStore, type CompletedSale } from "@/store";

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function resetStores() {
  useInvoicesStore.setState({ invoices: [], counters: {} });
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

/** Create a completed sale for testing. */
function makeSale(
  id: number,
  total: number,
  method: "cash" | "card",
  storeId: string,
  customerName: string | null = null,
): CompletedSale {
  return {
    id,
    items: [
      {
        productId: 1,
        productName: "Product A",
        quantity: 1,
        unitPrice: total,
        subtotal: total,
        discountPercent: 0,
        saleUnit: "unit",
      },
    ],
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
    date: new Date().toISOString(),
    storeId,
    customerName,
    status: "completed" as const,
    priceListId: null,
  };
}

// ──────────────────────────────────────────────
// 5.6 — Sequential numbering per store
// ──────────────────────────────────────────────

describe("Sequential numbering per store", () => {
  it("first invoice in a store gets number 1", () => {
    const sale = makeSale(1, 100, "cash", "store_1");
    const invoice = useInvoicesStore.getState().generateInvoice(sale);

    expect(invoice.sequentialNumber).toBe(1);
    expect(invoice.invoiceNumber).toBe("INV-store_1-00001");
  });

  it("second invoice increments to number 2", () => {
    const s1 = makeSale(1, 100, "cash", "store_1");
    useInvoicesStore.getState().generateInvoice(s1);

    const s2 = makeSale(2, 200, "card", "store_1");
    const inv2 = useInvoicesStore.getState().generateInvoice(s2);

    expect(inv2.sequentialNumber).toBe(2);
    expect(inv2.invoiceNumber).toBe("INV-store_1-00002");
  });

  it("numbering is per store — store B starts at 1 even if store A has 5", () => {
    // Generate 5 invoices for store A
    for (let i = 1; i <= 5; i++) {
      useInvoicesStore.getState().generateInvoice(makeSale(i, 100, "cash", "store_A"));
    }

    // First invoice for store B starts at 1
    const invB = useInvoicesStore.getState().generateInvoice(
      makeSale(101, 200, "cash", "store_B"),
    );

    expect(invB.sequentialNumber).toBe(1);
    expect(invB.invoiceNumber).toBe("INV-store_B-00001");
  });

  it("both stores can have the same sequential number", () => {
    const invA = useInvoicesStore.getState().generateInvoice(
      makeSale(1, 100, "cash", "store_A"),
    );
    const invB = useInvoicesStore.getState().generateInvoice(
      makeSale(1, 200, "card", "store_B"),
    );

    expect(invA.sequentialNumber).toBe(1);
    expect(invB.sequentialNumber).toBe(1);
    expect(invA.invoiceNumber).not.toBe(invB.invoiceNumber);
  });

  it("sequential numbers never go backwards", () => {
    for (let i = 1; i <= 10; i++) {
      useInvoicesStore.getState().generateInvoice(makeSale(i, 100, "cash", "store_1"));
    }

    const store = useInvoicesStore.getState();
    expect(store.counters["store_1"]).toBe(10);

    // All invoices have sequential numbers 1-10
    const invoices = store.getInvoicesByStore("store_1");
    const numbers = invoices.map((inv) => inv.sequentialNumber).sort((a, b) => a - b);
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("gaps are not reused", () => {
    // Simulate: store reaches #3, then we generate #4
    useInvoicesStore.getState().generateInvoice(makeSale(1, 100, "cash", "store_1"));
    useInvoicesStore.getState().generateInvoice(makeSale(2, 100, "cash", "store_1"));
    useInvoicesStore.getState().generateInvoice(makeSale(3, 100, "cash", "store_1"));

    // Next invoice should be #4, not #1 or #2
    const inv4 = useInvoicesStore.getState().generateInvoice(
      makeSale(4, 100, "cash", "store_1"),
    );
    expect(inv4.sequentialNumber).toBe(4);
  });

  it("getNextSequentialNumber returns the next available number without issuing", () => {
    useInvoicesStore.getState().generateInvoice(makeSale(1, 100, "cash", "store_1"));
    useInvoicesStore.getState().generateInvoice(makeSale(2, 100, "cash", "store_1"));

    const next = useInvoicesStore.getState().getNextSequentialNumber("store_1");
    expect(next).toBe(3);
  });
});

// ──────────────────────────────────────────────
// 5.6 — Invoice creation from sale
// ──────────────────────────────────────────────

describe("Invoice creation from sale", () => {
  it("creates an invoice referencing the sale id", () => {
    const sale = makeSale(42, 500, "cash", "store_1");
    const invoice = useInvoicesStore.getState().generateInvoice(sale);

    expect(invoice.saleId).toBe(42);
    expect(invoice.storeId).toBe("store_1");
  });

  it("uses customer name when provided", () => {
    const sale = makeSale(1, 100, "cash", "store_1", "Juan Pérez");
    const invoice = useInvoicesStore.getState().generateInvoice(sale);

    expect(invoice.customer).toBe("Juan Pérez");
  });

  it('defaults to "Consumidor Final" when no customer name', () => {
    const sale = makeSale(1, 100, "cash", "store_1", null);
    const invoice = useInvoicesStore.getState().generateInvoice(sale);

    expect(invoice.customer).toBe("Consumidor Final");
  });

  it("uses override customerName when provided to generateInvoice", () => {
    const sale = makeSale(1, 100, "cash", "store_1", "Juan Pérez");
    const invoice = useInvoicesStore.getState().generateInvoice(sale, "Override Name");

    expect(invoice.customer).toBe("Override Name");
  });

  it("stores payment method from sale", () => {
    const cashSale = makeSale(1, 100, "cash", "store_1");
    const cardSale = makeSale(2, 200, "card", "store_1");

    const invCash = useInvoicesStore.getState().generateInvoice(cashSale);
    const invCard = useInvoicesStore.getState().generateInvoice(cardSale);

    expect(invCash.paymentMethod).toBe("cash");
    expect(invCard.paymentMethod).toBe("card");
  });

  it("records the date of generation", () => {
    const before = new Date().toISOString();
    const sale = makeSale(1, 100, "cash", "store_1");
    const invoice = useInvoicesStore.getState().generateInvoice(sale);
    const after = new Date().toISOString();

    expect(invoice.date).toBeTruthy();
    expect(invoice.date >= before).toBe(true);
    expect(invoice.date <= after).toBe(true);
  });
});

// ──────────────────────────────────────────────
// 5.6 — Invoice items match sale items
// ──────────────────────────────────────────────

describe("Invoice items match sale items", () => {
  it("copies all items from the sale", () => {
    const sale: CompletedSale = {
      id: 1,
      items: [
        {
          productId: 1,
          productName: "Coca-Cola",
          quantity: 2,
          unitPrice: 150,
          subtotal: 300,
          discountPercent: 0,
          saleUnit: "unit",
        },
        {
          productId: 2,
          productName: "Papas",
          quantity: 1,
          unitPrice: 200,
          subtotal: 200,
          discountPercent: 0,
          saleUnit: "unit",
        },
        {
          productId: 3,
          productName: "Chocolate",
          quantity: 3,
          unitPrice: 80,
          subtotal: 240,
          discountPercent: 0,
          saleUnit: "unit",
        },
      ],
      createdBy: "admin",
      total: 740,
      subtotal: 740,
      discountPercent: 0,
      discountAmount: 0,
      paymentMethod: "cash",
      amountPaid: 740,
      change: 0,
      cashAmount: 740,
      cardAmount: null,
      mercadopagoAmount: null,
      date: new Date().toISOString(),
      storeId: "store_1",
      customerName: "Maria",
      status: "completed",
      priceListId: null,
    };

    const invoice = useInvoicesStore.getState().generateInvoice(sale);

    expect(invoice.items).toHaveLength(3);
    expect(invoice.items[0].productName).toBe("Coca-Cola");
    expect(invoice.items[0].quantity).toBe(2);
    expect(invoice.items[0].unitPrice).toBe(150);
    expect(invoice.items[0].subtotal).toBe(300);
  });

  it("preserves correct total from sale", () => {
    const sale: CompletedSale = {
      id: 1,
      items: [
        { productId: 1, productName: "A", quantity: 2, unitPrice: 150, subtotal: 300, discountPercent: 0, saleUnit: "unit" },
        { productId: 2, productName: "B", quantity: 1, unitPrice: 450, subtotal: 450, discountPercent: 0, saleUnit: "unit" },
      ],
      createdBy: "admin",
      total: 750,
      subtotal: 750,
      discountPercent: 0,
      discountAmount: 0,
      paymentMethod: "cash",
      amountPaid: 750,
      change: 0,
      cashAmount: 750,
      cardAmount: null,
      mercadopagoAmount: null,
      date: new Date().toISOString(),
      storeId: "store_1",
      customerName: null,
      status: "completed",
      priceListId: null,
    };

    const invoice = useInvoicesStore.getState().generateInvoice(sale);
    expect(invoice.total).toBe(750);
  });

  it("does not mutate the original sale items", () => {
    const sale = makeSale(1, 100, "cash", "store_1");
    const originalItems = [...sale.items];

    useInvoicesStore.getState().generateInvoice(sale);

    expect(sale.items).toEqual(originalItems);
  });
});

// ──────────────────────────────────────────────
// 5.6 — Searching and filtering
// ──────────────────────────────────────────────

describe("Invoice search and filter", () => {
  it("returns invoices by store only", () => {
    useInvoicesStore.getState().generateInvoice(makeSale(1, 100, "cash", "store_A"));
    useInvoicesStore.getState().generateInvoice(makeSale(2, 200, "cash", "store_B"));

    const storeAInvs = useInvoicesStore.getState().getInvoicesByStore("store_A");
    expect(storeAInvs).toHaveLength(1);
    expect(storeAInvs[0].storeId).toBe("store_A");
  });

  it("searches by invoice number", () => {
    useInvoicesStore.getState().generateInvoice(makeSale(1, 100, "cash", "store_1"));
    useInvoicesStore.getState().generateInvoice(makeSale(2, 200, "cash", "store_1"));

    const results = useInvoicesStore.getState().searchInvoices("store_1", "00002");
    expect(results).toHaveLength(1);
    expect(results[0].sequentialNumber).toBe(2);
  });

  it("searches by customer name", () => {
    useInvoicesStore.getState().generateInvoice(makeSale(1, 100, "cash", "store_1", "Juan"));
    useInvoicesStore.getState().generateInvoice(makeSale(2, 200, "cash", "store_1", "Maria"));

    const results = useInvoicesStore.getState().searchInvoices("store_1", "maria");
    expect(results).toHaveLength(1);
    expect(results[0].customer).toBe("Maria");
  });

  it("returns empty when no match", () => {
    useInvoicesStore.getState().generateInvoice(makeSale(1, 100, "cash", "store_1"));

    const results = useInvoicesStore.getState().searchInvoices("store_1", "nonexistent");
    expect(results).toHaveLength(0);
  });

  it("sorts invoices newest first", () => {
    useInvoicesStore.getState().generateInvoice(makeSale(1, 100, "cash", "store_1"));
    useInvoicesStore.getState().generateInvoice(makeSale(2, 200, "cash", "store_1"));

    const invoices = useInvoicesStore.getState().getInvoicesByStore("store_1");
    expect(invoices[0].sequentialNumber).toBe(2);
    expect(invoices[1].sequentialNumber).toBe(1);
  });
});

// ──────────────────────────────────────────────
// 5.6 — Invoice retrieval
// ──────────────────────────────────────────────

describe("Invoice retrieval", () => {
  it("getInvoiceById returns the correct invoice", () => {
    const inv = useInvoicesStore.getState().generateInvoice(
      makeSale(1, 100, "cash", "store_1"),
    );

    const found = useInvoicesStore.getState().getInvoiceById(inv.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(inv.id);
  });

  it("getInvoiceById returns null for non-existent id", () => {
    const found = useInvoicesStore.getState().getInvoiceById(999);
    expect(found).toBeNull();
  });
});
