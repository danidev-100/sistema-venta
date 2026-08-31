import { describe, it, expect, beforeEach, vi } from "vitest";
import { useInvoicesStore } from "@/store/invoices";
import type { CompletedSale } from "@/store";

// ──────────────────────────────────────────────
// La numeración de facturas es SERVER-SIDE hoy: el store
// POSTea el payload y el server devuelve la factura con su
// invoice_number. El mock simula ese comportamiento.
// ──────────────────────────────────────────────

const mockState = vi.hoisted(() => ({
  /** Facturas que devolverá GET /invoices (para loadInvoices). */
  serverInvoices: [] as Array<Record<string, unknown>>,
  /** Contador para invoice_number generado en POST /invoices. */
  nextNumber: 1,
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn((path: string) =>
      Promise.resolve(path.startsWith("/invoices") ? mockState.serverInvoices : []),
    ),
    post: vi.fn((path: string, body: any) => {
      if (path === "/invoices") {
        return Promise.resolve({
          id: mockState.nextNumber * 1000,
          invoice_number: `INV-${String(mockState.nextNumber++).padStart(4, "0")}`,
          sale_id: body.sale_id,
          store_id: body.store_id,
          customer_name: body.customer_name,
          created_by: body.created_by,
          total: body.total,
          payment_method: body.payment_method,
          created_at: new Date().toISOString(),
          items: (body.items ?? []).map((i: any) => ({
            product_id: i.product_id,
            product_name: i.product_name,
            quantity: i.quantity,
            unit_price: i.unit_price,
            subtotal: i.subtotal,
          })),
        });
      }
      return Promise.resolve({});
    }),
    put: vi.fn(() => Promise.resolve(undefined)),
    del: vi.fn(() => Promise.resolve(undefined)),
  },
  setToken: vi.fn(),
  clearToken: vi.fn(),
}));

function resetStores() {
  useInvoicesStore.setState({ invoices: [] });
  mockState.serverInvoices = [];
  mockState.nextNumber = 1;
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
// 5.6 — Invoice creation from sale (server-side numbering)
// ──────────────────────────────────────────────

describe("Invoice creation from sale", () => {
  it("creates an invoice referencing the sale, with a server-assigned number", async () => {
    const sale = makeSale(42, 500, "cash", "store_1");
    const invoice = await useInvoicesStore.getState().generateInvoice(sale);

    expect(invoice.saleId).toBe(42);
    expect(invoice.storeId).toBe("store_1");
    expect(invoice.invoiceNumber).toBe("INV-0001");
    expect(invoice.sequentialNumber).toBe(1);
  });

  it("uses customer name when provided", async () => {
    const sale = makeSale(1, 100, "cash", "store_1", "Juan Pérez");
    const invoice = await useInvoicesStore.getState().generateInvoice(sale);

    expect(invoice.customer).toBe("Juan Pérez");
  });

  it('defaults to "Consumidor Final" when no customer name', async () => {
    const sale = makeSale(1, 100, "cash", "store_1", null);
    const invoice = await useInvoicesStore.getState().generateInvoice(sale);

    expect(invoice.customer).toBe("Consumidor Final");
  });

  it("uses override customerName when provided to generateInvoice", async () => {
    const sale = makeSale(1, 100, "cash", "store_1", "Juan Pérez");
    const invoice = await useInvoicesStore.getState().generateInvoice(sale, "Override Name");

    expect(invoice.customer).toBe("Override Name");
  });

  it("stores payment method from sale", async () => {
    const invCash = await useInvoicesStore.getState().generateInvoice(makeSale(1, 100, "cash", "store_1"));
    const invCard = await useInvoicesStore.getState().generateInvoice(makeSale(2, 200, "card", "store_1"));

    expect(invCash.paymentMethod).toBe("cash");
    expect(invCard.paymentMethod).toBe("card");
  });

  it("copies items from the sale into the invoice", async () => {
    const sale = makeSale(1, 100, "cash", "store_1");
    const invoice = await useInvoicesStore.getState().generateInvoice(sale);

    expect(invoice.items).toHaveLength(1);
    expect(invoice.items[0].productName).toBe("Product A");
    expect(invoice.total).toBe(100);
  });

  it("appends the generated invoice to the store", async () => {
    await useInvoicesStore.getState().generateInvoice(makeSale(1, 100, "cash", "store_1"));

    expect(useInvoicesStore.getState().invoices).toHaveLength(1);
  });
});

// ──────────────────────────────────────────────
// 5.6 — loadInvoices
// ──────────────────────────────────────────────

describe("loadInvoices", () => {
  it("loads and normalizes server invoices", async () => {
    mockState.serverInvoices = [
      {
        id: 11,
        invoice_number: "INV-0003",
        sale_id: 3,
        customer_name: "Maria",
        total: 300,
        payment_method: "card",
        created_at: "2026-06-01T10:00:00Z",
        store_id: "store_1",
        created_by: "admin",
      },
      {
        id: 12,
        invoice_number: "INV-0007",
        sale_id: 7,
        customer_name: "Juan",
        total: 700,
        payment_method: "cash",
        created_at: "2026-06-02T10:00:00Z",
        store_id: "store_1",
        created_by: "admin",
      },
    ];

    await useInvoicesStore.getState().loadInvoices("store_1");

    const invoices = useInvoicesStore.getState().invoices;
    expect(invoices).toHaveLength(2);
    expect(invoices[0].sequentialNumber).toBe(3);
    expect(invoices[1].sequentialNumber).toBe(7);
  });

  it("getNextSequentialNumber returns max+1 based on loaded invoices", async () => {
    mockState.serverInvoices = [
      {
        id: 11,
        invoice_number: "INV-0003",
        sale_id: 3,
        customer_name: "Maria",
        total: 300,
        payment_method: "card",
        created_at: "2026-06-01T10:00:00Z",
        store_id: "store_1",
        created_by: "admin",
      },
      {
        id: 12,
        invoice_number: "INV-0007",
        sale_id: 7,
        customer_name: "Juan",
        total: 700,
        payment_method: "cash",
        created_at: "2026-06-02T10:00:00Z",
        store_id: "store_1",
        created_by: "admin",
      },
    ];

    await useInvoicesStore.getState().loadInvoices("store_1");

    expect(useInvoicesStore.getState().getNextSequentialNumber("store_1")).toBe(8);
  });
});

// ──────────────────────────────────────────────
// 5.6 — Searching and filtering
// ──────────────────────────────────────────────

describe("Invoice search and filter", () => {
  beforeEach(async () => {
    await useInvoicesStore.getState().generateInvoice(makeSale(1, 100, "cash", "store_A", "Juan"));
    await useInvoicesStore.getState().generateInvoice(makeSale(2, 200, "cash", "store_B", "Maria"));
    await useInvoicesStore.getState().generateInvoice(makeSale(3, 300, "card", "store_1", "Pedro"));
  });

  it("returns invoices by store only", () => {
    const storeAInvs = useInvoicesStore.getState().getInvoicesByStore("store_A");
    expect(storeAInvs).toHaveLength(1);
    expect(storeAInvs[0].storeId).toBe("store_A");
  });

  it("searches by invoice number", () => {
    const results = useInvoicesStore.getState().searchInvoices("store_A", "INV-0001");
    expect(results).toHaveLength(1);
  });

  it("searches by customer name (case-insensitive)", () => {
    const results = useInvoicesStore.getState().searchInvoices("store_1", "pedro");
    expect(results).toHaveLength(1);
    expect(results[0].customer).toBe("Pedro");
  });

  it("returns empty when no match", () => {
    const results = useInvoicesStore.getState().searchInvoices("store_1", "nonexistent");
    expect(results).toHaveLength(0);
  });

  it("sorts invoices newest first (by id)", async () => {
    await useInvoicesStore.getState().generateInvoice(makeSale(4, 400, "cash", "store_A", "Ana"));

    const invoices = useInvoicesStore.getState().getInvoicesByStore("store_A");
    expect(invoices).toHaveLength(2);
    expect(invoices[0].customer).toBe("Ana");
    expect(invoices[1].customer).toBe("Juan");
  });
});

// ──────────────────────────────────────────────
// 5.6 — Invoice retrieval
// ──────────────────────────────────────────────

describe("Invoice retrieval", () => {
  it("getInvoiceById returns the correct invoice", async () => {
    const inv = await useInvoicesStore.getState().generateInvoice(makeSale(1, 100, "cash", "store_1"));

    const found = useInvoicesStore.getState().getInvoiceById(inv.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(inv.id);
  });

  it("getInvoiceById returns null for non-existent id", () => {
    const found = useInvoicesStore.getState().getInvoiceById(999);
    expect(found).toBeNull();
  });
});