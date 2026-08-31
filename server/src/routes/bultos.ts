import { Router, Request, Response } from "express";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { getDb } from "../db.js";
import * as schema from "../../../db/cloud-schema.js";

const createBultoSchema = z.object({
  name: z.string().min(1, "Nombre requerido").max(200),
  product_id: z.number().int().nullable().optional().default(null),
  quantity: z.number().int().min(1).default(1),
  bulto_price: z.number().min(0).default(0),
  store_id: z.string().min(1, "Tienda requerida"),
});

const router = Router();

// GET / — list bultos for store
router.get("/", async (req: Request, res: Response) => {
  try {
    const storeId = req.query.storeId as string;
    if (!storeId) { res.status(400).json({ error: "storeId requerido" }); return; }

    const db = getDb();
    const rows = await db
      .select()
      .from(schema.bultos)
      .where(eq(schema.bultos.store_id, storeId))
      .orderBy(desc(schema.bultos.created_at));

    res.json(rows);
  } catch (err) {
    console.error("[bultos] list error:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// GET /:id
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const db = getDb();

    const [bulto] = await db
      .select()
      .from(schema.bultos)
      .where(eq(schema.bultos.id, id))
      .limit(1);

    if (!bulto) { res.status(404).json({ error: "Bulto no encontrado" }); return; }
    res.json(bulto);
  } catch (err) {
    console.error("[bultos] get error:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// POST /
router.post("/", async (req: Request, res: Response) => {
  try {
    const parsed = createBultoSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }
    const { name, product_id, quantity, bulto_price, store_id } = parsed.data;

    const db = getDb();
    const [bulto] = await db
      .insert(schema.bultos)
      .values({ name, product_id, quantity, bulto_price, store_id })
      .returning();

    res.status(201).json(bulto);
  } catch (err) {
    console.error("[bultos] create error:", err);
    res.status(500).json({ error: "Error al crear bulto" });
  }
});

// PUT /:id
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const { name, product_id, quantity, bulto_price } = req.body;
    const db = getDb();

    const [bulto] = await db
      .update(schema.bultos)
      .set({ name, product_id, quantity, bulto_price, updated_at: new Date() })
      .where(eq(schema.bultos.id, id))
      .returning();

    if (!bulto) { res.status(404).json({ error: "Bulto no encontrado" }); return; }
    res.json(bulto);
  } catch (err) {
    console.error("[bultos] update error:", err);
    res.status(500).json({ error: "Error al actualizar bulto" });
  }
});

// DELETE /:id
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const db = getDb();
    await db.delete(schema.bultos).where(eq(schema.bultos.id, id));
    res.json({ success: true });
  } catch (err) {
    console.error("[bultos] delete error:", err);
    res.status(500).json({ error: "Error al eliminar bulto" });
  }
});

export default router;
