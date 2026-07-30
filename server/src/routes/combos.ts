import { Router, Request, Response } from "express";
import { eq, desc } from "drizzle-orm";
import { getDb } from "../db.js";
import * as schema from "../../../db/cloud-schema.js";

const router = Router();

// GET / — list combos for store
router.get("/", async (req: Request, res: Response) => {
  try {
    const storeId = req.query.storeId as string;
    if (!storeId) { res.status(400).json({ error: "storeId requerido" }); return; }

    const db = getDb();
    const rows = await db
      .select()
      .from(schema.combos)
      .where(eq(schema.combos.store_id, storeId))
      .orderBy(desc(schema.combos.created_at));

    res.json(rows);
  } catch (err) {
    console.error("[combos] list error:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// GET /:id — single combo with items
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const db = getDb();

    const [combo] = await db
      .select()
      .from(schema.combos)
      .where(eq(schema.combos.id, id))
      .limit(1);

    if (!combo) { res.status(404).json({ error: "Combo no encontrado" }); return; }

    const items = await db
      .select()
      .from(schema.comboItems)
      .where(eq(schema.comboItems.combo_id, id));

    res.json({ ...combo, items });
  } catch (err) {
    console.error("[combos] get error:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// POST / — create combo with items
router.post("/", async (req: Request, res: Response) => {
  try {
    const { name, combo_price, store_id, items } = req.body;
    if (!name || !store_id) {
      res.status(400).json({ error: "name y store_id requeridos" });
      return;
    }

    const db = getDb();
    const [combo] = await db
      .insert(schema.combos)
      .values({ name, combo_price, store_id })
      .returning();

    if (items?.length) {
      for (const item of items) {
        await db.insert(schema.comboItems).values({
          combo_id: combo.id,
          product_id: item.product_id,
          quantity: item.quantity,
          store_id,
        });
      }
    }

    const allItems = await db
      .select()
      .from(schema.comboItems)
      .where(eq(schema.comboItems.combo_id, combo.id));

    res.status(201).json({ ...combo, items: allItems });
  } catch (err) {
    console.error("[combos] create error:", err);
    res.status(500).json({ error: "Error al crear combo" });
  }
});

// PUT /:id — update combo and replace items
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { name, combo_price, items } = req.body;
    const db = getDb();

    const [combo] = await db
      .update(schema.combos)
      .set({ name, combo_price, updated_at: new Date() })
      .where(eq(schema.combos.id, id))
      .returning();

    if (!combo) { res.status(404).json({ error: "Combo no encontrado" }); return; }

    if (items) {
      await db.delete(schema.comboItems).where(eq(schema.comboItems.combo_id, id));
      for (const item of items) {
        await db.insert(schema.comboItems).values({
          combo_id: id,
          product_id: item.product_id,
          quantity: item.quantity,
          store_id: combo.store_id,
        });
      }
    }

    const allItems = await db.select().from(schema.comboItems).where(eq(schema.comboItems.combo_id, id));
    res.json({ ...combo, items: allItems });
  } catch (err) {
    console.error("[combos] update error:", err);
    res.status(500).json({ error: "Error al actualizar combo" });
  }
});

// DELETE /:id
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const db = getDb();

    await db.delete(schema.comboItems).where(eq(schema.comboItems.combo_id, id));
    await db.delete(schema.combos).where(eq(schema.combos.id, id));

    res.json({ success: true });
  } catch (err) {
    console.error("[combos] delete error:", err);
    res.status(500).json({ error: "Error al eliminar combo" });
  }
});

export default router;
