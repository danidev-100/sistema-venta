import { create } from "zustand";
import type { CompletedSale } from "@/store";
import { api } from "@/lib/api";

export type InvoiceItem = {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
};

export type Invoice = {
  id: number;
  invoiceNumber: string;
  sequentialNumber: number;
  saleId: number;
  customer: string;
  items: InvoiceItem[];
  total: number;
  paymentMethod: "cash" | "card" | "mixed" | "credit" | "mercadopago";
  date: string;
  storeId: string;
  createdBy: string;
};

export type InvoicesStore = {
  invoices: Invoice[];

  loadInvoices: (storeId: string) => Promise<void>;
  generateInvoice: (
    sale: CompletedSale,
    customerName?: string,
    createdBy?: string,
  ) => Promise<Invoice>;

  getInvoicesByStore: (storeId: string) => Invoice[];
  getInvoiceById: (id: number) => Invoice | null;

  searchInvoices: (
    storeId: string,
    query?: string,
    dateFrom?: string,
    dateTo?: string,
    userName?: string,
  ) => Invoice[];

  getNextSequentialNumber: (storeId: string) => number;
};

/** Extrae el número secuencial del invoice_number generado por el server (ej. "INV-0003" → 3). */
function parseSequentialNumber(invoiceNumber: string): number {
  const match = /(\d+)$/.exec(invoiceNumber);
  if (match) return parseInt(match[1], 10);
  return 0;
}

/** Normaliza una fila del server (snake_case) al tipo Invoice (camelCase). */
function normalizeInvoice(raw: any): Invoice {
  return {
    id: raw.id,
    invoiceNumber: raw.invoice_number,
    sequentialNumber: parseSequentialNumber(raw.invoice_number ?? ""),
    saleId: raw.sale_id,
    customer: raw.customer_name ?? "Consumidor Final",
    items: Array.isArray(raw.items)
      ? raw.items.map((i: any, idx: number) => ({
          productId: i.product_id ?? idx,
          productName: i.product_name,
          quantity: i.quantity,
          unitPrice: i.unit_price,
          subtotal: i.subtotal,
        }))
      : [],
    total: raw.total ?? 0,
    paymentMethod: raw.payment_method ?? "cash",
    date: raw.created_at ?? new Date().toISOString(),
    storeId: raw.store_id,
    createdBy: raw.created_by ?? "—",
  };
}

export const useInvoicesStore = create<InvoicesStore>((set, get) => ({
  invoices: [],

  loadInvoices: async (storeId) => {
    try {
      const rows = await api.get<any[]>(
        `/invoices?storeId=${encodeURIComponent(storeId)}`,
      );
      set({ invoices: rows.map(normalizeInvoice) });
    } catch (err) {
      console.error("[invoices] loadInvoices failed:", err);
    }
  },

  generateInvoice: async (sale, customerName, createdBy) => {
    const payload = {
      sale_id: sale.id,
      store_id: sale.storeId,
      customer_name: customerName ?? sale.customerName ?? "Consumidor Final",
      created_by: createdBy ?? sale.createdBy,
      total: sale.total,
      payment_method: sale.paymentMethod,
      items: sale.items.map((i) => ({
        product_id: i.productId >= 0 ? i.productId : null,
        product_name: i.productName,
        quantity: i.quantity,
        unit_price: i.unitPrice,
        subtotal: i.subtotal,
      })),
    };
    const invoice = normalizeInvoice(await api.post<any>("/invoices", payload));
    set({ invoices: [...get().invoices, invoice] });
    return invoice;
  },

  getInvoicesByStore: (storeId) =>
    get()
      .invoices.filter((inv) => inv.storeId === storeId)
      .sort((a, b) => b.id - a.id),

  getInvoiceById: (id) =>
    get().invoices.find((inv) => inv.id === id) ?? null,

  searchInvoices: (storeId, query, dateFrom, dateTo, userName) => {
    let results = get().invoices.filter((inv) => inv.storeId === storeId);

    if (userName) {
      results = results.filter((inv) => inv.createdBy === userName);
    }

    if (query) {
      const lower = query.toLowerCase();
      results = results.filter(
        (inv) =>
          inv.invoiceNumber.toLowerCase().includes(lower) ||
          inv.customer.toLowerCase().includes(lower),
      );
    }

    if (dateFrom) {
      const from = new Date(dateFrom).getTime();
      results = results.filter((inv) => new Date(inv.date).getTime() >= from);
    }

    if (dateTo) {
      const to = new Date(dateTo + "T23:59:59.999").getTime();
      results = results.filter((inv) => new Date(inv.date).getTime() <= to);
    }

    return results.sort((a, b) => b.id - a.id);
  },

  getNextSequentialNumber: (storeId) => {
    const max = get()
      .invoices.filter((inv) => inv.storeId === storeId)
      .reduce((m, inv) => Math.max(m, inv.sequentialNumber), 0);
    return max + 1;
  },
}));
