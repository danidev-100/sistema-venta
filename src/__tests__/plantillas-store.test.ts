import { describe, it, expect, beforeEach, vi } from "vitest";
import { usePlantillasStore } from "@/store/plantillas";
import { api } from "@/lib/api";
import { getDefaultTemplate } from "@/lib/default-templates";

// ──────────────────────────────────────────────
// Mock API layer
// ──────────────────────────────────────────────

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(() => Promise.resolve([])),
    post: vi.fn((_path: string, data: unknown) => Promise.resolve({ ...(data as object), id: 42 })),
    put: vi.fn(() => Promise.resolve(undefined)),
    del: vi.fn(() => Promise.resolve(undefined)),
  },
}));

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function resetStore() {
  usePlantillasStore.setState({
    plantillas: {},
  });
}

beforeEach(() => {
  resetStore();
  vi.clearAllMocks();
});

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

const STORE_ID = "store_1";
const TIPOS = ["factura", "boleta", "ticket", "nota_credito", "nota_debito"] as const;

describe("usePlantillasStore — getPlantilla", () => {
  it("returns null for a tipo that was never saved", async () => {
    vi.mocked(api.get).mockResolvedValueOnce([]);
    const result = await usePlantillasStore.getState().getPlantilla("factura", STORE_ID);
    expect(result).toBeNull();
  });

  it("returns the saved template HTML when it exists", async () => {
    const html = "<h1>Custom Factura</h1>";
    vi.mocked(api.get).mockResolvedValueOnce([
      { id: 1, store_id: STORE_ID, tipo: "factura", template_html: html },
    ]);
    const result = await usePlantillasStore.getState().getPlantilla("factura", STORE_ID);
    expect(result).toBe(html);
  });
});

describe("usePlantillasStore — upsertPlantilla", () => {
  it("inserts a new template via POST", async () => {
    const html = "<h1>Custom Ticket</h1>";
    await usePlantillasStore.getState().upsertPlantilla("ticket", html, STORE_ID);

    expect(api.get).toHaveBeenCalledWith(`/plantillas?storeId=${STORE_ID}&tipo=ticket`);
    expect(api.post).toHaveBeenCalledWith("/plantillas", {
      tipo: "ticket",
      template_html: html,
      store_id: STORE_ID,
    });
    expect(api.put).not.toHaveBeenCalled();
    expect(usePlantillasStore.getState().plantillas[STORE_ID].ticket).toBe(html);
  });

  it("rejects empty HTML", async () => {
    await expect(
      usePlantillasStore.getState().upsertPlantilla("factura", "   ", STORE_ID),
    ).rejects.toThrow("HTML vacío");
    expect(api.get).not.toHaveBeenCalled();
  });

  it("updates existing template via PUT", async () => {
    const html = "<h1>V2</h1>";
    vi.mocked(api.get).mockResolvedValueOnce([{ id: 1 }]);
    await usePlantillasStore.getState().upsertPlantilla("factura", html, STORE_ID);

    expect(api.put).toHaveBeenCalledWith("/plantillas/1", {
      tipo: "factura",
      template_html: html,
      store_id: STORE_ID,
    });
    expect(api.post).not.toHaveBeenCalled();
    expect(usePlantillasStore.getState().plantillas[STORE_ID].factura).toBe(html);
  });
});

describe("usePlantillasStore — getAllPlantillas", () => {
  it("returns the saved tipos with html, the rest as null", async () => {
    vi.mocked(api.get).mockResolvedValueOnce([
      { id: 1, store_id: STORE_ID, tipo: "factura", template_html: "<h1>Custom</h1>" },
    ]);
    const all = await usePlantillasStore.getState().getAllPlantillas(STORE_ID);
    expect(all).toHaveLength(TIPOS.length);
    const factura = all.find((e) => e.tipo === "factura")!;
    expect(factura.template_html).toBe("<h1>Custom</h1>");
    const boleta = all.find((e) => e.tipo === "boleta")!;
    expect(boleta.template_html).toBeNull();
  });
});

describe("usePlantillasStore — getPlantillaOrDefault", () => {
  it("returns saved template when one exists", async () => {
    const html = "<h1>Custom Factura</h1>";
    vi.mocked(api.get).mockResolvedValueOnce([
      { id: 1, store_id: STORE_ID, tipo: "factura", template_html: html },
    ]);
    const result = await usePlantillasStore.getState().getPlantillaOrDefault("factura", STORE_ID);
    expect(result).toBe(html);
  });

  it("returns default template when none saved", async () => {
    vi.mocked(api.get).mockResolvedValueOnce([]);
    const result = await usePlantillasStore.getState().getPlantillaOrDefault("ticket", STORE_ID);
    expect(result).toBe(getDefaultTemplate("ticket"));
  });
});