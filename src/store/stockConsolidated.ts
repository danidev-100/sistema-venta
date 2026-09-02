import { create } from "zustand";
import { api } from "@/lib/api";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type ConsolidatedPerStore = {
  store_id: string;
  store_name: string;
  stock: number;
};

export type ConsolidatedProduct = {
  barcode: string;
  name: string;
  price: number;
  total_stock: number;
  per_store: ConsolidatedPerStore[];
};

// ──────────────────────────────────────────────
// Store shape
// ──────────────────────────────────────────────

export type StockConsolidatedStore = {
  /** Stock consolidado por barcode (sumado en todas las tiendas activas). */
  consolidated: ConsolidatedProduct[];
  /** Tienda para la que se cargó el último consolidado (evita re-fetch). */
  loadedStoreId: string | null;

  /** GET /products/stock-consolidated?storeId=... */
  loadConsolidated: (storeId: string) => Promise<void>;

  /** Detalle consolidado completo de un barcode (undefined si no existe). */
  getConsolidatedByBarcode: (
    barcode: string | null | undefined,
  ) => ConsolidatedProduct | undefined;

  /** Stock total consolidado de un barcode (0 si no existe). */
  getTotalForBarcode: (barcode: string | null | undefined) => number;
};

// ──────────────────────────────────────────────
// Store implementation
// ──────────────────────────────────────────────

export const useStockConsolidatedStore = create<StockConsolidatedStore>(
  (set, get) => ({
    consolidated: [],
    loadedStoreId: null,

    loadConsolidated: async (storeId) => {
      try {
        const rows = await api.get<ConsolidatedProduct[]>(
          "/products/stock-consolidated?storeId=" + encodeURIComponent(storeId),
        );
        set({ consolidated: rows, loadedStoreId: storeId });
      } catch (err) {
        console.error("[stockConsolidated] loadConsolidated failed:", err);
      }
    },

    getConsolidatedByBarcode: (barcode) => {
      if (!barcode) return undefined;
      return get().consolidated.find((c) => c.barcode === barcode);
    },

    getTotalForBarcode: (barcode) =>
      get().getConsolidatedByBarcode(barcode)?.total_stock ?? 0,
  }),
);