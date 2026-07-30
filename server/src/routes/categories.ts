import { Router, Request, Response } from "express";
import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../db.js";
import * as schema from "../../../db/cloud-schema.js";

const router = Router();

// GET / — list categories for store
router.get("/", async (req: Request, res: Response) => {
  try {
    const storeId = req.query.storeId as string;
    if (!storeId) {
      res.status(400).json({ error: "storeId es requerido" });
      return;
    }
    const db = getDb();
    const rows = await db
      .select()
      .from(schema.categories)
      .where(eq(schema.categories.store_id, storeId))
      .orderBy(desc(schema.categories.created_at));
    res.json(rows);
  } catch (err) {
    console.error("[categories] list error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// POST / — create category
router.post("/", async (req: Request, res: Response) => {
  try {
    const { name, parent_id, store_id } = req.body;
    if (!name || !store_id) {
      res.status(400).json({ error: "Nombre y store_id son requeridos" });
      return;
    }
    const db = getDb();
    const [inserted] = await db
      .insert(schema.categories)
      .values({ name, parent_id: parent_id ?? null, store_id })
      .returning();
    res.status(201).json(inserted);
  } catch (err) {
    console.error("[categories] create error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// PUT /:id — update category
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const id = Number(req.params.id);
    const { name, parent_id } = req.body;
    const [updated] = await db
      .update(schema.categories)
      .set({ name, parent_id: parent_id ?? null, updated_at: new Date() })
      .where(eq(schema.categories.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Categoría no encontrada" });
      return;
    }
    res.json(updated);
  } catch (err) {
    console.error("[categories] update error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// DELETE /:id — delete category & uncategorize its products
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const id = Number(req.params.id);
    await db
      .update(schema.products)
      .set({ category_id: null, updated_at: new Date() })
      .where(eq(schema.products.category_id, id));
    const [deleted] = await db
      .delete(schema.categories)
      .where(eq(schema.categories.id, id))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Categoría no encontrada" });
      return;
    }
    res.json({ message: "Categoría eliminada", category: deleted });
  } catch (err) {
    console.error("[categories] delete error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

export default router;
