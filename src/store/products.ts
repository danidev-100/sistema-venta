import { create } from "zustand";
import { api } from "@/lib/api";
// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type Product = {
  id: number;
  barcode: string | null;
  name: string;
  image: string;
  price: number;
  stock: number;
  minStock: number;
  midStock: number;
  category_id: number | null;
  costPrice: number;
  brandId: number | null;
  saleUnit: "unit" | "gram" | "kilogram";
  store_id: string;
};

export type Category = {
  id: number;
  name: string;
  parent_id: number | null;
  store_id: string;
};

export type MovementType = "purchase" | "sale" | "adjustment";

export type StockMovement = {
  id: number;
  product_id: number;
  type: MovementType;
  quantity: number;
  delta: number;
  reference_id: string | null;
  user_id: string | null;
  store_id: string;
  created_at: string;
};

// ──────────────────────────────────────────────
// Store shape
// ──────────────────────────────────────────────

export type ProductsStore = {
  products: Product[];
  categories: Category[];
  stockMovements: StockMovement[];

  /** Normalize a raw product row from the API (snake_case) to the store type (camelCase). */
  normalizeProduct: (raw: any) => Product;

  loadProducts: (storeId: string) => Promise<void>;
  loadCategories: (storeId: string) => Promise<void>;
  loadStockMovements: (storeId: string) => Promise<void>;

  /** Add a product. Throws if barcode duplicate in same store. */
  addProduct: (data: Omit<Product, "id" | "costPrice" | "brandId" | "minStock" | "midStock" | "saleUnit" | "image"> & { costPrice?: number; brandId?: number | null; minStock?: number; midStock?: number; saleUnit?: "unit" | "gram" | "kilogram"; image?: string }) => Promise<Product>;

  /** Update product fields by id. */
  updateProduct: (id: number, updates: Partial<Omit<Product, "id">>) => Promise<void>;

  /** Remove a product by id. */
  deleteProduct: (id: number) => Promise<void>;

  /** Get all products scoped to a store_id. */
  getProductsByStore: (storeId: string) => Product[];

  /** Add a category. Throws if duplicate name in same store + parent. */
  addCategory: (data: Omit<Category, "id">) => Promise<Category>;

  /** Update category fields by id. */
  updateCategory: (id: number, updates: Partial<Omit<Category, "id">>) => Promise<void>;

  /** Remove a category and all its descendants. Uncategorizes affected products. */
  deleteCategory: (id: number) => Promise<void>;

  /** Get all categories scoped to a store_id. */
  getCategoriesByStore: (storeId: string) => Category[];

  /** Get children of a given parent (null = root categories). */
  getChildCategories: (parentId: number | null) => Category[];

  /** Record a stock movement AND update the product's running quantity. */
  recordMovement: (data: Omit<StockMovement, "id" | "created_at">) => Promise<StockMovement>;

  /** Shortcut: adjust product stock to an absolute value (creates "adjustment" movement). */
  adjustStock: (productId: number, newQuantity: number, userId?: string) => Promise<void>;

  /** Get movements for a specific product. */
  getMovementsByProduct: (productId: number) => StockMovement[];

  /** Get movements scoped to a store. */
  getMovementsByStore: (storeId: string) => StockMovement[];
};

// ──────────────────────────────────────────────
// Store implementation
// ──────────────────────────────────────────────

export const useProductsStore = create<ProductsStore>((set, get) => ({
  products: [],
  categories: [],
  stockMovements: [],

  /** Normalize a raw product row from the API (snake_case) to the store type (camelCase). */
  normalizeProduct(raw: any): Product {
    return {
      id: raw.id,
      barcode: raw.barcode ?? null,
      name: raw.name,
      image: raw.image ?? "",
      price: raw.price ?? 0,
      stock: raw.stock ?? 0,
      minStock: raw.min_stock ?? 0,
      midStock: 0, // Not persisted in DB — frontend-only field
      category_id: raw.category_id ?? null,
      costPrice: raw.cost_price ?? 0,
      brandId: raw.brand_id ?? null,
      saleUnit: raw.sale_unit ?? "unit",
      store_id: raw.store_id,
    };
  },

  loadProducts: async (storeId) => {
    try {
      const rows = await api.get<any[]>(`/products?storeId=${storeId}`);
      set({ products: rows.map(get().normalizeProduct) });
    } catch (err) {
      console.error("[products] loadProducts failed:", err);
    }
  },

  loadCategories: async (storeId) => {
    try {
      const rows = await api.get<any[]>(`/categories?storeId=${storeId}`);
      set({ categories: rows as Category[] });
    } catch (err) {
      console.error("[products] loadCategories failed:", err);
    }
  },

  loadStockMovements: async (storeId) => {
    try {
      const rows = await api.get<any[]>("/products/stock-movements?storeId=" + encodeURIComponent(storeId));
      set({ stockMovements: rows as StockMovement[] });
    } catch (err) {
      console.error("[products] loadStockMovements failed:", err);
    }
  },

  // ── Products ──

  addProduct: async (data) => {
    if (data.barcode) {
      const dup = get().products.find(
        (p) => p.barcode === data.barcode && p.store_id === data.store_id,
      );
      if (dup) {
        throw new Error(
          `Product with barcode "${data.barcode}" already exists in this store`,
        );
      }
    }

    // Send snake_case — the backend Zod schema expects these names
    const body: Record<string, unknown> = {
      barcode: data.barcode ?? null,
      name: data.name,
      image: data.image ?? "",
      price: data.price ?? 0,
      stock: data.stock ?? 0,
      cost_price: data.costPrice ?? 0,
      min_stock: data.minStock ?? 0,
      sale_unit: data.saleUnit ?? "unit",
      category_id: data.category_id ?? null,
      brand_id: data.brandId ?? null,
      store_id: data.store_id,
    };

    const raw = await api.post<any>("/products", body);
    const product = get().normalizeProduct(raw);

    set({ products: [...get().products, product] });
    return product;
  },

  updateProduct: async (id, updates) => {
    if (updates.barcode) {
      const dup = get().products.find(
        (p) =>
          p.barcode === updates.barcode &&
          p.store_id === (updates.store_id ?? get().products.find((p) => p.id === id)?.store_id) &&
          p.id !== id,
      );
      if (dup) {
        throw new Error(
          `Product with barcode "${updates.barcode}" already exists in this store`,
        );
      }
    }

    // Map camelCase fields to snake_case for the server
    const serverUpdates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      const snakeKey = key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
      serverUpdates[snakeKey] = value;
    }

    await api.put(`/products/${id}`, serverUpdates);

    set({
      products: get().products.map((p) =>
        p.id === id ? { ...p, ...updates } : p,
      ),
    });
  },

  deleteProduct: async (id) => {
    await api.del(`/products/${id}`);

    set({
      products: get().products.filter((p) => p.id !== id),
      stockMovements: get().stockMovements.filter((m) => m.product_id !== id),
    });
  },

  getProductsByStore: (storeId) =>
    get().products.filter((p) => p.store_id === storeId),

  // ── Categories ──

  addCategory: async (data) => {
    const dup = get().categories.find(
      (c) =>
        c.name === data.name &&
        c.store_id === data.store_id &&
        c.parent_id === data.parent_id,
    );
    if (dup) {
      throw new Error(
        `Category "${data.name}" already exists in this store`,
      );
    }

    const category = await api.post<Category>("/categories", data);
    set({ categories: [...get().categories, category] });
    return category;
  },

  updateCategory: async (id, updates) => {
    if (updates.name) {
      const current = get().categories.find((c) => c.id === id);
      if (current) {
        const dup = get().categories.find(
          (c) =>
            c.name === updates.name &&
            c.store_id === (updates.store_id ?? current.store_id) &&
            c.parent_id === (updates.parent_id ?? current.parent_id) &&
            c.id !== id,
        );
        if (dup) {
          throw new Error(
            `Category "${updates.name}" already exists in this store`,
          );
        }
      }
    }

    await api.put(`/categories/${id}`, updates);

    set({
      categories: get().categories.map((c) =>
        c.id === id ? { ...c, ...updates } : c,
      ),
    });
  },

  deleteCategory: async (id) => {
    const idsToDelete = new Set<number>();
    const collect = (parentId: number) => {
      get().categories
        .filter((c) => c.parent_id === parentId)
        .forEach((c) => {
          idsToDelete.add(c.id);
          collect(c.id);
        });
    };
    idsToDelete.add(id);
    collect(id);

    await api.del(`/categories/${id}`);

    set({
      categories: get().categories.filter((c) => !idsToDelete.has(c.id)),
      products: get().products.map((p) =>
        p.category_id !== null && idsToDelete.has(p.category_id)
          ? { ...p, category_id: null }
          : p,
      ),
    });
  },

  getCategoriesByStore: (storeId) =>
    get().categories.filter((c) => c.store_id === storeId),

  getChildCategories: (parentId) =>
    get().categories.filter((c) => c.parent_id === parentId),

  // ── Stock Movements ──

  recordMovement: async (data) => {
    const movement = await api.post<StockMovement>("/products/stock-movement", data);

    const { products } = get();
    const product = products.find((p) => p.id === data.product_id);
    if (product) {
      set({
        stockMovements: [...get().stockMovements, movement],
        products: products.map((p) =>
          p.id === data.product_id ? { ...p, stock: product.stock + data.delta } : p,
        ),
      });
    } else {
      set({ stockMovements: [...get().stockMovements, movement] });
    }

    return movement;
  },

  adjustStock: async (productId, newQuantity, userId) => {
    const product = get().products.find((p) => p.id === productId);
    if (!product) return;

    const delta = newQuantity - product.stock;
    if (delta === 0) return;

    await get().recordMovement({
      product_id: productId,
      type: "adjustment",
      quantity: newQuantity,
      delta,
      reference_id: null,
      user_id: userId ?? null,
      store_id: product.store_id,
    });
  },

  getMovementsByProduct: (productId) =>
    get()
      .stockMovements.filter((m) => m.product_id === productId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),

  getMovementsByStore: (storeId) =>
    get()
      .stockMovements.filter((m) => m.store_id === storeId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),
}));
