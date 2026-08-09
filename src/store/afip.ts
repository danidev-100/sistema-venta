import { create } from "zustand";
import { api } from "@/lib/api";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type CondicionIva = "monotributo" | "responsable_inscripto" | "exento";
export type Ambiente = "homo" | "prod";

export type AfipConfig = {
  storeId: string;
  cuit: string;
  razonSocial: string;
  domicilio: string;
  condicionIva: CondicionIva;
  puntoVenta: number;
  ambiente: Ambiente;
  activo: boolean;
  exigirCae: boolean;
  cert: string;
  key: string;
};

export type AfipConfigInput = Omit<AfipConfig, "storeId">;

export type AfipTestResult = {
  ok: boolean;
  puntosVenta?: unknown;
  error?: string;
};

const DEFAULTS: AfipConfig = {
  storeId: "",
  cuit: "",
  razonSocial: "",
  domicilio: "",
  condicionIva: "monotributo",
  puntoVenta: 1,
  ambiente: "homo",
  activo: false,
  exigirCae: false,
  cert: "",
  key: "",
};

// ──────────────────────────────────────────────
// Normalizers (snake ↔ camel)
// ──────────────────────────────────────────────

function normalizeConfig(raw: Record<string, unknown>): AfipConfig {
  return {
    storeId: (raw.store_id as string) ?? "",
    cuit: (raw.cuit as string) ?? "",
    razonSocial: (raw.razon_social as string) ?? "",
    domicilio: (raw.domicilio as string) ?? "",
    condicionIva: (raw.condicion_iva as CondicionIva) ?? "monotributo",
    puntoVenta: Number(raw.punto_venta) || 1,
    ambiente: (raw.ambiente as Ambiente) ?? "homo",
    activo: Number(raw.activo) === 1,
    exigirCae: Number(raw.exigir_cae) === 1,
    cert: (raw.cert as string) ?? "",
    key: (raw.key as string) ?? "",
  };
}

function toSnake(config: AfipConfigInput): Record<string, unknown> {
  return {
    cuit: config.cuit,
    razon_social: config.razonSocial,
    domicilio: config.domicilio,
    condicion_iva: config.condicionIva,
    punto_venta: config.puntoVenta,
    ambiente: config.ambiente,
    activo: config.activo ? 1 : 0,
    exigir_cae: config.exigirCae ? 1 : 0,
    cert: config.cert,
    key: config.key,
  };
}

// ──────────────────────────────────────────────
// Store
// ──────────────────────────────────────────────

export type AfipStore = {
  afipConfig: AfipConfig;
  loading: boolean;

  loadAfipConfig: (storeId: string) => Promise<void>;
  saveAfipConfig: (storeId: string, config: AfipConfigInput) => Promise<void>;
  testAfipConnection: (storeId: string, config?: AfipConfigInput) => Promise<AfipTestResult>;
};

export const useAfipStore = create<AfipStore>((set) => ({
  afipConfig: { ...DEFAULTS },
  loading: false,

  loadAfipConfig: async (storeId) => {
    set({ loading: true });
    try {
      const raw = await api.get<Record<string, unknown>>(
        `/afip/config?storeId=${encodeURIComponent(storeId)}`,
      );
      set({ afipConfig: normalizeConfig(raw), loading: false });
    } catch (err) {
      console.error("[afip] loadAfipConfig failed:", err);
      set({ afipConfig: { ...DEFAULTS, storeId }, loading: false });
    }
  },

  saveAfipConfig: async (storeId, config) => {
    try {
      const raw = await api.put<Record<string, unknown>>("/afip/config", {
        store_id: storeId,
        ...toSnake(config),
      });
      set({ afipConfig: normalizeConfig(raw) });
    } catch (err) {
      throw new Error(
        err instanceof Error
          ? err.message
          : "No se pudo guardar la configuración AFIP",
      );
    }
  },

  testAfipConnection: async (storeId, config) => {
    try {
      const res = await api.post<AfipTestResult>("/afip/test", {
        store_id: storeId,
        ...(config ? { config: toSnake(config) } : {}),
      });
      return res;
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Error desconocido",
      };
    }
  },
}));
