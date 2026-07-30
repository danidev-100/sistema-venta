import { Router, Request, Response } from "express";
import { eq, desc } from "drizzle-orm";
import { getDb } from "../db.js";
import * as schema from "../../../db/cloud-schema.js";

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
    const id = parseInt(req.params.id);
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
    const { name, product_id, quantity, bulto_price, store_id } = req.body;
    if (!name || !store_id) {
      res.status(400).json({ error: "name y store_id requeridos" });
      return;
    }

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
    const id = parseInt(req.params.id);
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
    const id = parseInt(req.params.id);
    const db = getDb();
    await db.delete(schema.bultos).where(eq(schema.bultos.id, id));
    res.json({ success: true });
  } catch (err) {
    console.error("[bultos] delete error:", err);
    res.status(500).json({ error: "Error al eliminar bulto" });
  }
});

export default router;
