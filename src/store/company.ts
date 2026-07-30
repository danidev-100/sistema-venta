import { create } from "zustand";
import { api } from "@/lib/api";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type CompanyData = {
  id: number;
  store_id: string;
  name: string;
  phone: string;
  address: string;
  cuit: string;
  email: string;
  web: string;
  logo_base64: string;
};

export type CompanyInput = {
  name: string;
  phone: string;
  address: string;
  cuit: string;
  email: string;
  web: string;
  logo_base64: string;
};

export type CompanyStore = {
  data: CompanyData | null;
  loaded: boolean;

  loadCompany: (storeId: string) => Promise<void>;
  saveCompany: (storeId: string, input: CompanyInput) => Promise<void>;
};

// ──────────────────────────────────────────────
// Store
// ──────────────────────────────────────────────

export const useCompanyStore = create<CompanyStore>((set) => ({
  data: null,
  loaded: false,

  loadCompany: async (storeId) => {
    try {
      const data = await api.get<CompanyData>(
        `/company?storeId=${encodeURIComponent(storeId)}`,
      );
      set({ data: data ?? null, loaded: true });
    } catch {
      // Server or route may not exist yet
      set({ data: null, loaded: true });
    }
  },

  saveCompany: async (storeId, input) => {
    try {
      const data = await api.put<CompanyData>("/company", { ...input, storeId });
      set({ data });
    } catch {
      throw new Error("No se pudo guardar. Verificá la conexión con el servidor.");
    }
  },
}));
