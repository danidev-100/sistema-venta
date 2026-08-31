import { create } from "zustand";
import { api } from "@/lib/api";
import { DEFAULT_TEMPLATES, getDefaultTemplate } from "@/lib/default-templates";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type PlantillaEntry = {
  tipo: string;
  template_html: string | null; // null = no custom template saved
};

export type PlantillasStore = {
  /** Cache: storeId -> { tipo -> html } */
  plantillas: Record<string, Record<string, string>>;

  /** Get saved template for a tipo, or null if none. */
  getPlantilla: (tipo: string, storeId: string) => Promise<string | null>;

  /** Save (insert or replace) a template for a tipo. Rejects on empty HTML. */
  upsertPlantilla: (tipo: string, html: string, storeId: string) => Promise<void>;

  /** Get all 5 tipos with their saved HTML (null if not saved). */
  getAllPlantillas: (storeId: string) => Promise<PlantillaEntry[]>;

  /** Get saved template, or fall back to default. */
  getPlantillaOrDefault: (tipo: string, storeId: string) => Promise<string>;
};

// ──────────────────────────────────────────────
// Store
// ──────────────────────────────────────────────

export const usePlantillasStore = create<PlantillasStore>((set, get) => ({
  plantillas: {},

  getPlantilla: async (tipo, storeId) => {
    const rows = await api.get<{ id: number; template_html: string }[]>(
      `/plantillas?storeId=${encodeURIComponent(storeId)}&tipo=${encodeURIComponent(tipo)}`,
    );
    if (rows.length === 0) return null;
    return rows[0].template_html;
  },

  upsertPlantilla: async (tipo, html, storeId) => {
    if (!html.trim()) {
      throw new Error("HTML vacío");
    }

    const existing = await api.get<{ id: number }[]>(
      `/plantillas?storeId=${encodeURIComponent(storeId)}&tipo=${encodeURIComponent(tipo)}`,
    );

    const payload = { tipo, template_html: html, store_id: storeId };

    if (existing.length > 0) {
      await api.put(`/plantillas/${existing[0].id}`, payload);
    } else {
      await api.post("/plantillas", payload);
    }

    // Update cache
    set({
      plantillas: {
        ...get().plantillas,
        [storeId]: { ...(get().plantillas[storeId] ?? {}), [tipo]: html },
      },
    });
  },

  getAllPlantillas: async (storeId) => {
    const rows = await api.get<{ tipo: string; template_html: string }[]>(
      `/plantillas?storeId=${encodeURIComponent(storeId)}`,
    );

    const saved = new Map(rows.map((r) => [r.tipo, r.template_html]));
    const tipos = Object.keys(DEFAULT_TEMPLATES);

    return tipos.map((tipo) => ({
      tipo,
      template_html: saved.get(tipo) ?? null,
    }));
  },

  getPlantillaOrDefault: async (tipo, storeId) => {
    const saved = await get().getPlantilla(tipo, storeId);
    return saved ?? getDefaultTemplate(tipo);
  },
}));
