import { describe, it, expect, beforeEach, vi } from "vitest";
import { usePlantillasStore } from "@/store/plantillas";
import * as db from "@/lib/db";
import { getDefaultTemplate } from "@/lib/default-templates";

// ──────────────────────────────────────────────
// Mock DB layer
// ──────────────────────────────────────────────

vi.mock("@/lib/db", () => ({
  execute: vi.fn(),
  select: vi.fn(),
  enqueueSync: vi.fn(),
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
    vi.mocked(db.select).mockResolvedValue([]);
    const result = await usePlantillasStore.getState().getPlantilla("factura", STORE_ID);
    expect(result).toBeNull();
  });

  it("returns the saved template HTML when it exists", async () => {
    const html = "<h1>Custom Factura</h1>";
    vi.mocked(db.select).mockResolvedValue([
      { id: 1, store_id: STORE_ID, tipo: "factura", template_html: html },
    ]);
    const result = await usePlantillasStore.getState().getPlantilla("factura", STORE_ID);
    expect(result).toBe(html);
  });
});

describe("usePlantillasStore — upsertPlantilla", () => {
  it("inserts a new template and enqueues sync", async () => {
    vi.mocked(db.execute).mockResolvedValue({ rowsAffected: 1 });
    // First SELECT (existence check) → no record; second SELECT (after insert) → ID
    vi.mocked(db.select)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 42 }]);
    vi.mocked(db.enqueueSync).mockResolvedValue(undefined);

    await usePlantillasStore.getState().upsertPlantilla("ticket", "<h1>Custom Ticket</h1>", STORE_ID);

    expect(db.execute).toHaveBeenCalledOnce();
    expect(db.enqueueSync).toHaveBeenCalledWith("plantilla", 42, "insert", STORE_ID);
  });

  it("rejects empty HTML", async () => {
    await expect(
      usePlantillasStore.getState().upsertPlantilla("factura", "   ", STORE_ID),
    ).rejects.toThrow("HTML vacío");
  });

  it("updates existing template (same tipo, same store)", async () => {
    vi.mocked(db.execute).mockResolvedValue({ rowsAffected: 1 });
    vi.mocked(db.select).mockResolvedValue([{ id: 1 }]);
    vi.mocked(db.enqueueSync).mockResolvedValue(undefined);

    // First save
    await usePlantillasStore.getState().upsertPlantilla("factura", "<h1>V1</h1>", STORE_ID);
    // Second save (update)
    await usePlantillasStore.getState().upsertPlantilla("factura", "<h1>V2</h1>", STORE_ID);

    // execute should have been called twice (two upserts)
    expect(db.execute).toHaveBeenCalledTimes(2);
    expect(db.enqueueSync).toHaveBeenLastCalledWith("plantilla", 1, "update", STORE_ID);
  });
});

describe("usePlantillasStore — getAllPlantillas", () => {
  it("returns 6 entries (custom or default)", async () => {
    vi.mocked(db.select).mockResolvedValue([
      { id: 1, store_id: STORE_ID, tipo: "factura", template_html: "<h1>Custom</h1>" },
    ]);
    const all = await usePlantillasStore.getState().getAllPlantillas(STORE_ID);
    expect(all).toHaveLength(5);
    // The saved one has html
    const factura = all.find((e) => e.tipo === "factura")!;
    expect(factura.template_html).toBe("<h1>Custom</h1>");
    // Others have null
    const boleta = all.find((e) => e.tipo === "boleta")!;
    expect(boleta.template_html).toBeNull();
  });
});

describe("usePlantillasStore — getPlantillaOrDefault", () => {
  it("returns saved template when one exists", async () => {
    const html = "<h1>Custom Factura</h1>";
    vi.mocked(db.select).mockResolvedValue([
      { id: 1, store_id: STORE_ID, tipo: "factura", template_html: html },
    ]);
    const result = await usePlantillasStore.getState().getPlantillaOrDefault("factura", STORE_ID);
    expect(result).toBe(html);
  });

  it("returns default template when none saved", async () => {
    vi.mocked(db.select).mockResolvedValue([]);
    const result = await usePlantillasStore.getState().getPlantillaOrDefault("ticket", STORE_ID);
    expect(result).toBe(getDefaultTemplate("ticket"));
  });
});
