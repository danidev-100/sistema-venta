import { create } from "zustand";
import { useProductsStore } from "./products";

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type BulkPriceOpts = {
  percent: number;
  target: "cost" | "selling" | "both";
  storeId: string;
  categoryId?: number;
  brandId?: number;
};

export type BulkPreviewItem = {
  productId: number;
  name: string;
  field: "cost" | "selling";
  currentPrice: number;
  newPrice: number;
};

// ──────────────────────────────────────────────
// localStorage helpers
// ──────────────────────────────────────────────

const THEME_KEY = "admin_theme";

function loadTheme(): "light" | "dark" {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    // localStorage unavailable
  }
  return "dark";
}

function saveTheme(theme: "light" | "dark"): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // localStorage unavailable — skip
  }
}

// ──────────────────────────────────────────────
// Store shape
// ──────────────────────────────────────────────

export type AdminStore = {
  /** Current theme preference. */
  theme: "light" | "dark";

  // ── Theme ──

  toggleTheme: () => void;

  // ── Bulk price ──

  /** Cached preview items from the most recent bulkPricePreview call. */
  preview: BulkPreviewItem[] | null;

  /** The opts used to generate the current preview (needed for confirm). */
  pendingBulkOpts: BulkPriceOpts | null;

  /** Compute a price-increase preview WITHOUT mutating any products. */
  bulkPricePreview: (opts: BulkPriceOpts) => BulkPreviewItem[];

  /**
   * Apply the current preview to the products store.
   * Uses a snapshot-and-restore pattern for rollback on failure.
   * Throws if preview is stale or empty.
   */
  bulkPriceConfirm: () => void;

  /** Clear the current preview without applying changes. */
  clearBulkPreview: () => void;
};

// ──────────────────────────────────────────────
// Store implementation
// ──────────────────────────────────────────────

export const useAdminStore = create<AdminStore>((set, get) => ({
  // ── Defaults ──
  theme: loadTheme(),
  preview: null,
  pendingBulkOpts: null,

  // ── Theme ──

  toggleTheme: () => {
    set((s) => {
      const next = s.theme === "light" ? "dark" : "light";
      saveTheme(next);
      // Apply/remove dark class on <html>
      if (next === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      return { theme: next };
    });
  },

  // ── Bulk price ──

  bulkPricePreview: (opts: BulkPriceOpts): BulkPreviewItem[] => {
    const { products } = useProductsStore.getState();

    let filtered = products.filter((p) => p.store_id === opts.storeId);

    if (opts.categoryId != null) {
      filtered = filtered.filter((p) => p.category_id === opts.categoryId);
    }

    if (opts.brandId != null) {
      filtered = filtered.filter((p) => p.brandId === opts.brandId);
    }

    // 4. Calculate preview
    const multiplier = 1 + opts.percent / 100;
    const items: BulkPreviewItem[] = [];

    for (const product of filtered) {
      if (opts.target === "cost" || opts.target === "both") {
        const current = product.costPrice;
        const newPrice = round2(current * multiplier);
        items.push({
          productId: product.id,
          name: product.name,
          field: "cost",
          currentPrice: current,
          newPrice,
        });
      }
      if (opts.target === "selling" || opts.target === "both") {
        const current = product.price;
        const newPrice = round2(current * multiplier);
        items.push({
          productId: product.id,
          name: product.name,
          field: "selling",
          currentPrice: current,
          newPrice,
        });
      }
    }

    set({ preview: items, pendingBulkOpts: opts });
    return items;
  },

  bulkPriceConfirm: () => {
    const { preview, pendingBulkOpts } = get();
    if (!preview || !pendingBulkOpts) return;

    const { products } = useProductsStore.getState();

    // Snapshot affected products for rollback
    const affectedIds = [...new Set(preview.map((i) => i.productId))];
    const snapshot = products
      .filter((p) => affectedIds.includes(p.id))
      .map((p) => ({ ...p }));

    try {
      for (const item of preview) {
        if (item.field === "cost") {
          useProductsStore.getState().updateProduct(item.productId, {
            costPrice: item.newPrice,
          });
        } else {
          useProductsStore.getState().updateProduct(item.productId, {
            price: item.newPrice,
          });
        }
      }

      // Success — clear
      set({ preview: null, pendingBulkOpts: null });
    } catch {
      // Rollback: restore snapshot directly (bypass validation)
      const restoreMap = new Map(snapshot.map((p) => [p.id, p]));
      useProductsStore.setState({
        products: products.map((p) =>
          restoreMap.has(p.id) ? { ...restoreMap.get(p.id)! } : p,
        ),
      });

      set({ preview: null, pendingBulkOpts: null });
      throw new Error(
        "Bulk price update failed. All changes have been rolled back.",
      );
    }
  },

  clearBulkPreview: () => {
    set({ preview: null, pendingBulkOpts: null });
  },
}));
