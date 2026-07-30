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

  loadInvoices: () => Promise<void>;
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

export const useInvoicesStore = create<InvoicesStore>((set, get) => ({
  invoices: [],

  loadInvoices: async () => {
    try {
      const invoices = await api.get<Invoice[]>("/invoices");
      set({ invoices });
    } catch (err) {
      console.error("[invoices] loadInvoices failed:", err);
    }
  },

  generateInvoice: async (sale, customerName, createdBy) => {
    const invoice = await api.post<Invoice>("/invoices", {
      sale,
      customerName,
      createdBy,
    });
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
