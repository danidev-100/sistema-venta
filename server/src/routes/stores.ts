import { Router, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db.js";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import * as schema from "../../../db/cloud-schema.js";

const router = Router();

router.use(authMiddleware);

const trimmedName = (message: string) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z.string().min(1, message).max(120),
  );

const createStoreSchema = z.object({
  name: trimmedName("El nombre es requerido"),
});

const updateStoreSchema = z
  .object({
    name: trimmedName("El nombre no puede estar vacío").optional(),
    active: z.boolean().optional(),
  })
  .refine((data) => data.name !== undefined || data.active !== undefined, {
    message: "name o active son requeridos",
  });

function nextStoreId(ids: string[]): string {
  let max = 0;
  for (const id of ids) {
    const match = /^store_(\d+)$/.exec(id);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  return `store_${max + 1}`;
}

// GET /stores/active — cualquier usuario autenticado. Solo tiendas activas,
// usadas por el selector de punto de venta en la barra.
router.get("/active", async (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const stores = await db
      .select()
      .from(schema.stores)
      .where(eq(schema.stores.active, true))
      .orderBy(schema.stores.name);

    res.json(stores);
  } catch (err) {
    console.error("[stores] list active error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// ── Admin only ──

router.use(requireRole("admin"));

// GET /stores — admin. Lista TODAS las tiendas (activas e inactivas).
router.get("/", async (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const stores = await db
      .select()
      .from(schema.stores)
      .orderBy(schema.stores.name);

    res.json(stores);
  } catch (err) {
    console.error("[stores] list error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// POST /stores — admin. Crea una tienda con id autogenerado (store_N).
router.post("/", async (req: Request, res: Response) => {
  try {
    const parsed = createStoreSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }

    const db = getDb();
    const existing = await db.select({ id: schema.stores.id }).from(schema.stores);
    const id = nextStoreId(existing.map((s) => s.id));

    const [store] = await db
      .insert(schema.stores)
      .values({ id, name: parsed.data.name })
      .returning();

    res.status(201).json(store);
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "La tienda ya existe" });
      return;
    }
    console.error("[stores] create error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// PUT /stores/:id — admin. Renombra y/o cambia el estado active.
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const parsed = updateStoreSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }

    const { name, active } = parsed.data;
    const db = getDb();
    const [store] = await db
      .update(schema.stores)
      .set({
        ...(name !== undefined ? { name } : {}),
        ...(active !== undefined ? { active } : {}),
        updated_at: new Date(),
      })
      .where(eq(schema.stores.id, req.params.id as string))
      .returning();

    if (!store) {
      res.status(404).json({ error: "Tienda no encontrada" });
      return;
    }

    res.json(store);
  } catch (err) {
    console.error("[stores] update error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

export default router;
