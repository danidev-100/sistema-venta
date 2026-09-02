import { create } from "zustand";
import { api } from "@/lib/api";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type StoreInfo = {
  id: string;
  name: string;
  active: boolean;
  created_at?: string;
  updated_at?: string;
};

// ──────────────────────────────────────────────
// Store shape
// ──────────────────────────────────────────────

export type StoresStore = {
  /** Tiendas activas — usadas por el selector de punto de venta. */
  activeStores: StoreInfo[];
  /** Todas las tiendas (activas e inactivas) — gestión en Admin. */
  allStores: StoreInfo[];
  loading: boolean;
  loaded: boolean;
  error: string | null;

  loadActiveStores: () => Promise<void>;
  loadAllStores: () => Promise<void>;
  refreshAll: () => Promise<void>;
  createStore: (name: string) => Promise<StoreInfo>;
  updateStore: (
    id: string,
    updates: { name?: string; active?: boolean },
  ) => Promise<StoreInfo>;
};

// ──────────────────────────────────────────────
// Store implementation
// ──────────────────────────────────────────────

export const useStoresStore = create<StoresStore>((set, get) => ({
  activeStores: [],
  allStores: [],
  loading: false,
  loaded: false,
  error: null,

  loadActiveStores: async () => {
    set({ loading: true, error: null });
    try {
      const rows = await api.get<StoreInfo[]>("/stores/active");
      set({ activeStores: rows, loaded: true });
    } catch (err) {
      console.error("[stores] loadActiveStores failed:", err);
      set({ error: err instanceof Error ? err.message : "Error al cargar tiendas" });
    } finally {
      set({ loading: false });
    }
  },

  loadAllStores: async () => {
    set({ loading: true, error: null });
    try {
      const rows = await api.get<StoreInfo[]>("/stores");
      set({ allStores: rows });
    } catch (err) {
      console.error("[stores] loadAllStores failed:", err);
      set({ error: err instanceof Error ? err.message : "Error al cargar tiendas" });
    } finally {
      set({ loading: false });
    }
  },

  refreshAll: async () => {
    await Promise.all([get().loadActiveStores(), get().loadAllStores()]);
  },

  createStore: async (name) => {
    const store = await api.post<StoreInfo>("/stores", { name });
    await get().refreshAll();
    return store;
  },

  updateStore: async (id, updates) => {
    const store = await api.put<StoreInfo>(`/stores/${id}`, updates);
    await get().refreshAll();
    return store;
  },
}));
