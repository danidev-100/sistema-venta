import { create } from "zustand";
import { api } from "@/lib/api";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type PurchaseInvoiceItem = {
  id: number;
  purchaseInvoiceId: number;
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  salePrice: number;
  subtotal: number;
  storeId: string;
};

export type PurchaseInvoice = {
  id: number;
  storeId: string;
  proveedorId: number;
  proveedorName: string;
  invoiceNumber: string | null;
  total: number;
  notes: string | null;
  createdBy: string;
  createdAt: string;
  items: PurchaseInvoiceItem[];
};

export type CreatePurchaseInvoiceItem = {
  product_id: number;
  quantity: number;
  unit_price: number;
  sale_price: number;
};

export type CreatePurchaseInvoicePayload = {
  store_id: string;
  proveedor_id: number;
  invoice_number?: string | null;
  notes?: string | null;
  items: CreatePurchaseInvoiceItem[];
};

// ──────────────────────────────────────────────
// Normalizers (snake_case → camelCase)
// ──────────────────────────────────────────────

function normalizePurchaseInvoiceItem(raw: any): PurchaseInvoiceItem {
  return {
    id: raw.id,
    purchaseInvoiceId: raw.purchase_invoice_id,
    productId: raw.product_id,
    productName: raw.product_name,
    quantity: raw.quantity,
    unitPrice: raw.unit_price,
    salePrice: raw.sale_price ?? 0,
    subtotal: raw.subtotal,
    storeId: raw.store_id,
  };
}

function normalizePurchaseInvoice(raw: any): PurchaseInvoice {
  return {
    id: raw.id,
    storeId: raw.store_id,
    proveedorId: raw.proveedor_id,
    proveedorName: raw.proveedor_name ?? "",
    invoiceNumber: raw.invoice_number ?? null,
    total: raw.total ?? 0,
    notes: raw.notes ?? null,
    createdBy: raw.created_by ?? "—",
    createdAt: raw.created_at,
    items: (raw.items ?? []).map(normalizePurchaseInvoiceItem),
  };
}

// ──────────────────────────────────────────────
// Store shape
// ──────────────────────────────────────────────

export type PurchaseInvoicesStore = {
  purchaseInvoices: PurchaseInvoice[];
  loading: boolean;

  loadPurchaseInvoices: (storeId: string) => Promise<void>;
  createPurchaseInvoice: (payload: CreatePurchaseInvoicePayload) => Promise<PurchaseInvoice>;
};

export const usePurchaseInvoicesStore = create<PurchaseInvoicesStore>((set, get) => ({
  purchaseInvoices: [],
  loading: false,

  loadPurchaseInvoices: async (storeId) => {
    set({ loading: true });
    try {
      const rows = await api.get<any[]>(`/purchase-invoices?storeId=${encodeURIComponent(storeId)}`);
      set({ purchaseInvoices: rows.map(normalizePurchaseInvoice), loading: false });
    } catch (err) {
      console.error("[purchase-invoices] loadPurchaseInvoices failed:", err);
      set({ loading: false });
    }
  },

  createPurchaseInvoice: async (payload) => {
    const invoice = await api.post<any>("/purchase-invoices", payload);
    const normalized = normalizePurchaseInvoice(invoice);
    set({ purchaseInvoices: [normalized, ...get().purchaseInvoices] });
    return normalized;
  },
}));
