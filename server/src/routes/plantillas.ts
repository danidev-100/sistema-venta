import { Router, Request, Response } from "express";
import { eq, and } from "drizzle-orm";
import { getDb } from "../db.js";
import * as schema from "../../../db/cloud-schema.js";

const router = Router();

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
      .from(schema.plantillas)
      .where(eq(schema.plantillas.store_id, storeId));

    res.json(rows);
  } catch (err) {
    console.error("[plantillas] list error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const [row] = await db
      .select()
      .from(schema.plantillas)
      .where(eq(schema.plantillas.id, Number(req.params.id)))
      .limit(1);

    if (!row) {
      res.status(404).json({ error: "Plantilla no encontrada" });
      return;
    }

    res.json(row);
  } catch (err) {
    console.error("[plantillas] get error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.put("/:id", async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const id = Number(req.params.id);
    const { tipo, template_html, store_id } = req.body;

    if (!tipo || !template_html || !store_id) {
      res.status(400).json({ error: "tipo, template_html y store_id son requeridos" });
      return;
    }

    const [existing] = await db
      .select()
      .from(schema.plantillas)
      .where(eq(schema.plantillas.id, id))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(schema.plantillas)
        .set({ tipo, template_html, updated_at: new Date() })
        .where(eq(schema.plantillas.id, id))
        .returning();
      res.json(updated);
    } else {
      const [created] = await db
        .insert(schema.plantillas)
        .values({ tipo, template_html, store_id })
        .returning();
      res.status(201).json(created);
    }
  } catch (err) {
    console.error("[plantillas] upsert error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

export default router;
