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
  iva_alicuota: number;
  iva_incluido: number;
};

export type CompanyInput = {
  name: string;
  phone: string;
  address: string;
  cuit: string;
  email: string;
  web: string;
  logo_base64: string;
  iva_alicuota: number;
  iva_incluido: number;
};

export type CompanyStore = {
  data: CompanyData | null;
  loaded: boolean;

  loadCompany: (storeId: string) => Promise<void>;
  saveCompany: (storeId: string, input: CompanyInput) => Promise<void>;
};

/** Normalize server response (snake_case) to frontend types (camelCase + logo_base64) */
function normalizeCompany(raw: Record<string, unknown>): CompanyData {
  return {
    id: raw.id as number,
    store_id: raw.store_id as string,
    name: raw.name as string,
    phone: raw.phone as string,
    address: raw.address as string,
    cuit: raw.cuit as string,
    email: raw.email as string,
    web: (raw.web as string) ?? "",
    logo_base64: (raw.logo as string) ?? "",
    iva_alicuota: Number(raw.iva_alicuota ?? 0),
    iva_incluido: Number(raw.iva_incluido ?? 0),
  };
}

// ──────────────────────────────────────────────
// Store
// ──────────────────────────────────────────────

export const useCompanyStore = create<CompanyStore>((set) => ({
  data: null,
  loaded: false,

  loadCompany: async (storeId) => {
    try {
      const raw = await api.get<Record<string, unknown>>(
        `/company?storeId=${encodeURIComponent(storeId)}`,
      );
      set({ data: raw ? normalizeCompany(raw) : null, loaded: true });
    } catch {
      set({ data: null, loaded: true });
    }
  },

  saveCompany: async (storeId, input) => {
    try {
      // Map frontend fields to what the server expects
      const body: Record<string, unknown> = {
        store_id: storeId,
        name: input.name,
        address: input.address,
        phone: input.phone,
        email: input.email,
        cuit: input.cuit,
        logo: input.logo_base64,
        iva_alicuota: input.iva_alicuota,
        iva_incluido: input.iva_incluido ? 1 : 0,
      };
      const raw = await api.put<Record<string, unknown>>("/company", body);
      set({ data: normalizeCompany(raw) });
    } catch (err) {
      throw new Error(
        err instanceof Error && err.message !== "No se pudo guardar. Verificá la conexión con el servidor."
          ? err.message
          : "No se pudo guardar. Verificá la conexión con el servidor.",
      );
    }
  },
}));
