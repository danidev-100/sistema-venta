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

  loadCombos: () => Promise<void>;
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

  loadCombos: async () => {
    set({ loading: true });
    try {
      const combos = await api.get<Combo[]>("/combos");
      set({ combos, loading: false });
    } catch (err) {
      console.error("[combos] loadCombos failed:", err);
      set({ loading: false });
    }
  },

  addCombo: async (data) => {
    const combo = await api.post<Combo>("/combos", data);
    set({ combos: [...get().combos, combo] });
    return combo;
  },

  updateCombo: async (id, data) => {
    const updated = await api.put<Combo>(`/combos/${id}`, data);
    set({
      combos: get().combos.map((c) => (c.id === id ? updated : c)),
    });
  },

  deleteCombo: async (id) => {
    await api.del(`/combos/${id}`);
    set({ combos: get().combos.filter((c) => c.id !== id) });
  },

  getCombo: (id) => get().combos.find((c) => c.id === id),
}));
