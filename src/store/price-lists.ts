import { create } from "zustand";
import { api } from "@/lib/api";
import { useProductsStore } from "@/store/products";

export type PriceList = {
  id: number;
  name: string;
  storeId: string;
};

export type PriceListItem = {
  id: number;
  listId: number;
  productId: number;
  price: number | null;
  percentage: number | null;
  storeId: string;
};

let nextItemId = 1;

export function setNextPriceListItemId(id: number) { nextItemId = id; }

type PriceListsStore = {
  priceLists: PriceList[];
  loading: boolean;
  itemsByList: Record<number, PriceListItem[]>;
  loadingItems: Record<number, boolean>;

  loadPriceLists: () => Promise<void>;
  loadListItems: (listId: number) => Promise<PriceListItem[]>;
  createPriceList: (name: string, storeId: string) => Promise<PriceList>;
  updateItem: (listId: number, productId: number, data: { price?: number | null; percentage?: number | null }) => void;
  updateListName: (id: number, name: string) => void;
  bulkSetPercentage: (listId: number, percentage: number) => Promise<void>;
  clearOverrides: (listId: number) => Promise<void>;
  deletePriceList: (id: number) => void;
  getEffectivePrice: (listId: number, productId: number, basePrice: number) => number;
  getPriceList: (id: number) => PriceList | undefined;
};

export const usePriceListsStore = create<PriceListsStore>((set, get) => ({
  priceLists: [],
  loading: false,
  itemsByList: {},
  loadingItems: {},

  loadPriceLists: async () => {
    set({ loading: true });
    try {
      let rows: any[];
      try {
        rows = await api.get<any[]>("/price-lists");
      } catch {
        rows = [];
      }

      const priceLists: PriceList[] = rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        storeId: r.store_id,
      }));

      let storeId = "store_1";
      if (priceLists.length > 0) {
        storeId = priceLists[0].storeId;
      }

      if (priceLists.length < 10) {
        const existing: PriceList[] = [...priceLists];
        let nextId = priceLists.reduce((max, pl) => Math.max(max, pl.id), 0) + 1;
        for (let i = existing.length + 1; i <= 10; i++) {
          const name = `Lista ${i}`;
          try {
            const created = await api.post<any>("/price-lists", { name, storeId });
            existing.push({ id: created.id ?? nextId++, name, storeId });
          } catch { /* skip */ }
        }
        set({ priceLists: existing, loading: false });
      } else {
        set({ priceLists, loading: false });
      }
    } catch (err) {
      console.error("[price-lists] loadPriceLists failed:", err);
      set({ loading: false });
    }
  },

  loadListItems: async (listId) => {
    set((s) => ({ loadingItems: { ...s.loadingItems, [listId]: true } }));
    try {
      const rows = await api.get<any[]>(
        `/price-list-items?listId=${listId}`,
      );
      const items: PriceListItem[] = rows.map((r: any) => ({
        id: r.id,
        listId: r.list_id,
        productId: r.product_id,
        price: r.price,
        percentage: r.percentage,
        storeId: r.store_id,
      }));

      const maxId = items.reduce((m: number, i: PriceListItem) => Math.max(m, i.id), 0);
      if (maxId >= nextItemId) nextItemId = maxId + 1;

      set((s) => ({ itemsByList: { ...s.itemsByList, [listId]: items } }));
      return items;
    } finally {
      set((s) => ({ loadingItems: { ...s.loadingItems, [listId]: false } }));
    }
  },

  createPriceList: async (name, storeId) => {
    const created = await api.post<any>("/price-lists", { name, storeId });
    const listId = created.id;

    const list: PriceList = { id: listId, name, storeId };
    set((s) => ({ priceLists: [...s.priceLists, list] }));

    // Auto-populate items from all products (empty overrides — no DB writes needed)
    const products = useProductsStore.getState().products.filter((p) => p.store_id === storeId);
    const items: PriceListItem[] = products.map((p: any) => ({
      id: nextItemId++,
      listId,
      productId: p.id,
      price: null,
      percentage: null,
      storeId,
    }));

    set((s) => ({ itemsByList: { ...s.itemsByList, [listId]: items } }));
    return list;
  },

  updateItem: (listId, productId, data) => {
    if (data.price !== undefined) data.percentage = null;
    else if (data.percentage !== undefined) data.price = null;

    const state = get();
    const items = [...(state.itemsByList[listId] ?? [])];
    const idx = items.findIndex((i) => i.productId === productId);
    const existing = items[idx];
    const list = state.priceLists.find((pl) => pl.id === listId);
    if (!list) return;

    if (existing) {
      const updated = { ...existing, ...data };
      items[idx] = updated;
      set({ itemsByList: { ...state.itemsByList, [listId]: items } });
      api.put(`/price-list-items/${updated.id}`, {
        price: updated.price,
        percentage: updated.percentage,
      });
    } else {
      const newItem: PriceListItem = {
        id: nextItemId++,
        listId,
        productId,
        price: null,
        percentage: null,
        storeId: list.storeId,
        ...data,
      };
      items.push(newItem);
      set({ itemsByList: { ...state.itemsByList, [listId]: items } });
      api.post("/price-list-items", {
        id: newItem.id,
        listId,
        productId,
        price: newItem.price,
        percentage: newItem.percentage,
        storeId: list.storeId,
      });
    }
  },

  updateListName: (id, name) => {
    const list = get().priceLists.find((pl) => pl.id === id);
    if (!list) return;
    set({
      priceLists: get().priceLists.map((pl) =>
        pl.id === id ? { ...pl, name } : pl,
      ),
    });
    api.put(`/price-lists/${id}`, { name });
  },

  bulkSetPercentage: async (listId, percentage) => {
    const list = get().priceLists.find((pl) => pl.id === listId);
    if (!list) return;

    const products = useProductsStore.getState().products.filter((p) => p.store_id === list.storeId);
    const existingItems = get().itemsByList[listId] ?? [];

    const updated: PriceListItem[] = products.map((p) => {
      const existing = existingItems.find((i) => i.productId === p.id);
      return {
        id: existing?.id ?? nextItemId++,
        listId,
        productId: p.id,
        price: null,
        percentage,
        storeId: list.storeId,
      };
    });

    set((s) => ({
      itemsByList: { ...s.itemsByList, [listId]: updated },
    }));

    try {
      await api.del(`/price-list-items?listId=${listId}`);
      for (const item of updated) {
        await api.post("/price-list-items", {
          id: item.id,
          listId,
          productId: item.productId,
          price: null,
          percentage,
          storeId: list.storeId,
        });
      }
    } catch (err) {
      console.error("[price-lists] bulkSetPercentage api failed:", err);
    }
  },

  clearOverrides: async (listId) => {
    const state = get();
    const list = state.priceLists.find((pl) => pl.id === listId);
    if (!list) return;

    const items = state.itemsByList[listId];
    if (items) {
      const reset = items.map((item) => ({ ...item, price: null, percentage: null }));
      set({ itemsByList: { ...state.itemsByList, [listId]: reset } });
    }

    try {
      await api.del(`/price-list-items?listId=${listId}`);
    } catch (err) {
      console.error("[price-lists] clearOverrides api failed:", err);
    }
  },

  deletePriceList: (id) => {
    const list = get().priceLists.find((pl) => pl.id === id);
    if (!list) return;

    set({
      priceLists: get().priceLists.filter((pl) => pl.id !== id),
    });
    const { [id]: _, ...rest } = get().itemsByList;
    set({ itemsByList: rest });

    api.del(`/price-lists/${id}`);
    api.del(`/price-list-items?listId=${id}`);
  },

  getEffectivePrice: (listId, productId, basePrice) => {
    const items = get().itemsByList[listId];
    if (!items) return basePrice;
    const item = items.find((i) => i.productId === productId);
    if (!item) return basePrice;
    if (item.price !== null) return Math.round(item.price * 100) / 100;
    if (item.percentage !== null) return Math.round(basePrice * (1 + item.percentage / 100) * 100) / 100;
    return basePrice;
  },

  getPriceList: (id) => get().priceLists.find((pl) => pl.id === id),
}));
