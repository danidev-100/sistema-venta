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

  loadBultos: (storeId?: string) => Promise<void>;
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

  loadBultos: async (storeId?: string) => {
    set({ loading: true });
    try {
      const query = storeId ? `?storeId=${encodeURIComponent(storeId)}` : "";
      const rows = await api.get<any[]>(`/bultos${query}`);
      const normalized: Bulto[] = rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        productId: r.product_id,
        quantity: r.quantity,
        bultoPrice: r.bulto_price ?? 0,
        storeId: r.store_id,
      }));
      set({ bultos: normalized, loading: false });
    } catch (err) {
      console.error("[bultos] loadBultos failed:", err);
      set({ loading: false });
    }
  },

  addBulto: async (data) => {
    const body = {
      name: data.name,
      product_id: data.productId,
      quantity: data.quantity,
      bulto_price: data.bultoPrice,
      store_id: data.storeId,
    };
    const bulto = await api.post<any>("/bultos", body);
    const normalized: Bulto = {
      id: bulto.id,
      name: bulto.name,
      productId: bulto.product_id ?? bulto.productId,
      quantity: bulto.quantity,
      bultoPrice: bulto.bulto_price ?? bulto.bultoPrice,
      storeId: bulto.store_id,
    };
    set({ bultos: [...get().bultos, normalized] });
    return normalized;
  },

  updateBulto: async (id, data) => {
    const body = {
      name: data.name,
      product_id: data.productId,
      quantity: data.quantity,
      bulto_price: data.bultoPrice,
    };
    const updated = await api.put<any>(`/bultos/${id}`, body);
    const normalized: Bulto = {
      id: updated.id,
      name: updated.name,
      productId: updated.product_id ?? updated.productId,
      quantity: updated.quantity,
      bultoPrice: updated.bulto_price ?? updated.bultoPrice,
      storeId: updated.store_id,
    };
    set({
      bultos: get().bultos.map((b) => (b.id === id ? normalized : b)),
    });
  },

  deleteBulto: async (id) => {
    await api.del(`/bultos/${id}`);
    set({ bultos: get().bultos.filter((b) => b.id !== id) });
  },

  getBulto: (id) => get().bultos.find((b) => b.id === id),
}));
