import { create } from "zustand";
import { api } from "@/lib/api";

export type Bulto = {
  id: number;
  name: string;
  productId: number;
  quantity: number;
  bultoPrice: number;
  storeId: string;
};

export type BultosStore = {
  bultos: Bulto[];
  loading: boolean;

  loadBultos: () => Promise<void>;
  addBulto: (data: {
    name: string;
    productId: number;
    quantity: number;
    bultoPrice: number;
    storeId: string;
  }) => Promise<Bulto>;
  updateBulto: (
    id: number,
    data: {
      name: string;
      productId: number;
      quantity: number;
      bultoPrice: number;
    },
  ) => Promise<void>;
  deleteBulto: (id: number) => Promise<void>;
  getBulto: (id: number) => Bulto | undefined;
};

export const useBultosStore = create<BultosStore>((set, get) => ({
  bultos: [],
  loading: false,

  loadBultos: async () => {
    set({ loading: true });
    try {
      const bultos = await api.get<Bulto[]>("/bultos");
      set({ bultos, loading: false });
    } catch (err) {
      console.error("[bultos] loadBultos failed:", err);
      set({ loading: false });
    }
  },

  addBulto: async (data) => {
    const bulto = await api.post<Bulto>("/bultos", data);
    set({ bultos: [...get().bultos, bulto] });
    return bulto;
  },

  updateBulto: async (id, data) => {
    const updated = await api.put<Bulto>(`/bultos/${id}`, data);
    set({
      bultos: get().bultos.map((b) => (b.id === id ? updated : b)),
    });
  },

  deleteBulto: async (id) => {
    await api.del(`/bultos/${id}`);
    set({ bultos: get().bultos.filter((b) => b.id !== id) });
  },

  getBulto: (id) => get().bultos.find((b) => b.id === id),
}));
