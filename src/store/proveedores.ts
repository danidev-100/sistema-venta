import { create } from "zustand";
import { api } from "@/lib/api";

export type Proveedor = {
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  cuit: string;
  store_id: string;
};

export type ProveedoresStore = {
  proveedores: Proveedor[];
  loading: boolean;

  /** Load proveedores for a store from the API. */
  loadProveedores: (storeId: string) => Promise<void>;

  addProveedor: (data: Omit<Proveedor, "id">) => Promise<Proveedor>;
  updateProveedor: (id: number, updates: Partial<Omit<Proveedor, "id">>) => Promise<void>;
  deleteProveedor: (id: number) => Promise<void>;
  getProveedoresByStore: (storeId: string) => Proveedor[];
};

export const useProveedoresStore = create<ProveedoresStore>((set, get) => ({
  proveedores: [],
  loading: false,

  loadProveedores: async (storeId) => {
    set({ loading: true });
    try {
      const proveedores = await api.get<Proveedor[]>(`/proveedores?storeId=${encodeURIComponent(storeId)}`);
      set({ proveedores, loading: false });
    } catch (err) {
      console.error("[api] proveedores.loadProveedores failed:", err);
      set({ loading: false });
    }
  },

  addProveedor: async (data) => {
    const dup = get().proveedores.find(
      (p) => p.name === data.name && p.store_id === data.store_id,
    );
    if (dup) {
      throw new Error(`Ya existe un proveedor "${data.name}" en esta tienda`);
    }

    try {
      const proveedor = await api.post<Proveedor>("/proveedores", data);
      set({ proveedores: [...get().proveedores, proveedor] });
      return proveedor;
    } catch (err) {
      console.error("[api] proveedores.addProveedor failed:", err);
      throw err;
    }
  },

  updateProveedor: async (id, updates) => {
    if (updates.name) {
      const current = get().proveedores.find((p) => p.id === id);
      if (current) {
        const dup = get().proveedores.find(
          (p) =>
            p.name === updates.name &&
            p.store_id === (updates.store_id ?? current.store_id) &&
            p.id !== id,
        );
        if (dup) {
          throw new Error(`Ya existe un proveedor "${updates.name}" en esta tienda`);
        }
      }
    }

    try {
      const updated = await api.put<Proveedor>(`/proveedores/${id}`, updates);
      set({
        proveedores: get().proveedores.map((p) =>
          p.id === id ? updated : p,
        ),
      });
    } catch (err) {
      console.error("[api] proveedores.updateProveedor failed:", err);
      throw err;
    }
  },

  deleteProveedor: async (id) => {
    const existing = get().proveedores.find((p) => p.id === id);

    try {
      await api.del(`/proveedores/${id}`);
      set({
        proveedores: get().proveedores.filter((p) => p.id !== id),
      });
    } catch (err) {
      if (existing) {
        console.error("[api] proveedores.deleteProveedor failed:", err);
      }
      throw err;
    }
  },

  getProveedoresByStore: (storeId) =>
    get()
      .proveedores.filter((p) => p.store_id === storeId)
      .sort((a, b) => a.name.localeCompare(b.name)),
}));
