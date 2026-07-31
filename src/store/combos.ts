import { create } from "zustand";
import { api } from "@/lib/api";

export type ComboItem = {
  productId: number;
  quantity: number;
};

export type Combo = {
  id: number;
  name: string;
  comboPrice: number;
  items: ComboItem[];
  storeId: string;
};

export type CombosStore = {
  combos: Combo[];
  loading: boolean;

  loadCombos: (storeId?: string) => Promise<void>;
  addCombo: (data: {
    name: string;
    comboPrice: number;
    items: ComboItem[];
    storeId: string;
  }) => Promise<Combo>;
  updateCombo: (
    id: number,
    data: { name: string; comboPrice: number; items: ComboItem[] },
  ) => Promise<void>;
  deleteCombo: (id: number) => Promise<void>;
  getCombo: (id: number) => Combo | undefined;
};

export const useCombosStore = create<CombosStore>((set, get) => ({
  combos: [],
  loading: false,

  loadCombos: async (storeId?: string) => {
    set({ loading: true });
    try {
      const query = storeId ? `?storeId=${encodeURIComponent(storeId)}` : "";
      const rows = await api.get<any[]>(`/combos${query}`);
      const normalized: Combo[] = rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        comboPrice: r.combo_price ?? 0,
        items: (r.items ?? []).map((i: any) => ({ productId: i.product_id, quantity: i.quantity })),
        storeId: r.store_id,
      }));
      set({ combos: normalized, loading: false });
    } catch (err) {
      console.error("[combos] loadCombos failed:", err);
      set({ loading: false });
    }
  },

  addCombo: async (data) => {
    const body = {
      name: data.name,
      combo_price: data.comboPrice,
      items: data.items.map((i) => ({ product_id: i.productId, quantity: i.quantity })),
      store_id: data.storeId,
    };
    const combo = await api.post<any>("/combos", body);
    const normalized: Combo = {
      id: combo.id,
      name: combo.name,
      comboPrice: combo.combo_price ?? combo.comboPrice,
      items: (combo.items ?? []).map((i: any) => ({ productId: i.product_id, quantity: i.quantity })),
      storeId: combo.store_id,
    };
    set({ combos: [...get().combos, normalized] });
    return normalized;
  },

  updateCombo: async (id, data) => {
    const body = {
      name: data.name,
      combo_price: data.comboPrice,
      items: data.items.map((i) => ({ product_id: i.productId, quantity: i.quantity })),
    };
    const updated = await api.put<any>(`/combos/${id}`, body);
    const normalized: Combo = {
      id: updated.id,
      name: updated.name,
      comboPrice: updated.combo_price ?? updated.comboPrice,
      items: (updated.items ?? []).map((i: any) => ({ productId: i.product_id, quantity: i.quantity })),
      storeId: updated.store_id,
    };
    set({
      combos: get().combos.map((c) => (c.id === id ? normalized : c)),
    });
  },

  deleteCombo: async (id) => {
    await api.del(`/combos/${id}`);
    set({ combos: get().combos.filter((c) => c.id !== id) });
  },

  getCombo: (id) => get().combos.find((c) => c.id === id),
}));
