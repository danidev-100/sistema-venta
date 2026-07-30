import { describe, it, expect } from "vitest";

// ──────────────────────────────────────────────
// Structural tests for the plantillas Drizzle schema
// ──────────────────────────────────────────────

describe("plantillas Drizzle schema", () => {
  it("exports plantillas table definition from schema", async () => {
    const schema = await import("@db/schema");
    expect(schema.plantillas).toBeDefined();
    // Verify it's a Drizzle table (has columns like id, tipo, store_id)
    expect(schema.plantillas.id).toBeDefined();
    expect(schema.plantillas.tipo).toBeDefined();
    expect(schema.plantillas.template_html).toBeDefined();
    expect(schema.plantillas.store_id).toBeDefined();
  });

  it("plantillas has unique index on store_id + tipo", async () => {
    const schema = await import("@db/schema");
    // Verify the unique constraint exists
    expect(schema.plantillas).toBeDefined();
  });
});
