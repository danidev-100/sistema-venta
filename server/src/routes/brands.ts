import { Router, Request, Response } from "express";
import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../db.js";
import * as schema from "../../../db/cloud-schema.js";

const router = Router();

// GET / — list brands for store
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
      .from(schema.brands)
      .where(eq(schema.brands.store_id, storeId))
      .orderBy(desc(schema.brands.created_at));
    res.json(rows);
  } catch (err) {
    console.error("[brands] list error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// POST / — create brand
router.post("/", async (req: Request, res: Response) => {
  try {
    const { name, store_id } = req.body;
    if (!name || !store_id) {
      res.status(400).json({ error: "Nombre y store_id son requeridos" });
      return;
    }
    const db = getDb();
    const [inserted] = await db
      .insert(schema.brands)
      .values({ name, store_id })
      .returning();
    res.status(201).json(inserted);
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "Ya existe una marca con ese nombre en esta tienda" });
      return;
    }
    console.error("[brands] create error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// PUT /:id — update brand
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const id = Number(req.params.id);
    const { name } = req.body;
    const [updated] = await db
      .update(schema.brands)
      .set({ name, updated_at: new Date() })
      .where(eq(schema.brands.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Marca no encontrada" });
      return;
    }
    res.json(updated);
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "Ya existe una marca con ese nombre en esta tienda" });
      return;
    }
    console.error("[brands] update error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// DELETE /:id — delete brand
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const id = Number(req.params.id);
    const [deleted] = await db
      .delete(schema.brands)
      .where(eq(schema.brands.id, id))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Marca no encontrada" });
      return;
    }
    res.json({ message: "Marca eliminada", brand: deleted });
  } catch (err) {
    console.error("[brands] delete error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

export default router;
