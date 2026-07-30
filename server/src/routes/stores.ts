import { Router, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { getDb } from "../db.js";
import * as schema from "../../../db/cloud-schema.js";

const router = Router();

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

router.post("/", async (req: Request, res: Response) => {
  try {
    const { id, name } = req.body;

    if (!id || !name) {
      res.status(400).json({ error: "id y name son requeridos" });
      return;
    }

    const db = getDb();
    const [store] = await db
      .insert(schema.stores)
      .values({ id, name })
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

router.put("/:id", async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name) {
      res.status(400).json({ error: "name es requerido" });
      return;
    }

    const db = getDb();
    const [store] = await db
      .update(schema.stores)
      .set({ name, updated_at: new Date() })
      .where(eq(schema.stores.id, req.params.id))
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
