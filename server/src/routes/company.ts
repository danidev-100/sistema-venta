import { Router, Request, Response } from "express";
import { eq } from "drizzle-orm";
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
    const [row] = await db
      .select()
      .from(schema.company)
      .where(eq(schema.company.store_id, storeId))
      .limit(1);

    if (!row) {
      res.status(404).json({ error: "Empresa no encontrada" });
      return;
    }

    res.json(row);
  } catch (err) {
    console.error("[company] get error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.put("/", async (req: Request, res: Response) => {
  try {
    const { store_id, name, address, phone, email, cuit, logo } = req.body;

    if (!store_id) {
      res.status(400).json({ error: "store_id es requerido" });
      return;
    }

    const db = getDb();
    const [existing] = await db
      .select()
      .from(schema.company)
      .where(eq(schema.company.store_id, store_id))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(schema.company)
        .set({ name, address, phone, email, cuit, logo, updated_at: new Date() })
        .where(eq(schema.company.store_id, store_id))
        .returning();
      res.json(updated);
    } else {
      const [created] = await db
        .insert(schema.company)
        .values({ store_id, name, address, phone, email, cuit, logo })
        .returning();
      res.status(201).json(created);
    }
  } catch (err) {
    console.error("[company] upsert error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

export default router;
