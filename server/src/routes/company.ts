import { Router, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { getDb } from "../db.js";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import * as schema from "../../../db/cloud-schema.js";

const router = Router();

// GET es accesible para cualquier usuario autenticado: los datos de la empresa
// se inyectan en los tickets/comprobantes que imprime el cajero.
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

router.put("/", authMiddleware, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const {
      store_id,
      name,
      address,
      phone,
      email,
      cuit,
      logo,
      iva_alicuota,
      iva_incluido,
    } = req.body;

    if (!store_id) {
      res.status(400).json({ error: "store_id es requerido" });
      return;
    }

    const updateData: Record<string, unknown> = {
      name,
      address,
      phone,
      email,
      cuit,
      logo,
      updated_at: new Date(),
    };
    if (iva_alicuota !== undefined) updateData.iva_alicuota = Number(iva_alicuota) || 0;
    if (iva_incluido !== undefined) updateData.iva_incluido = iva_incluido ? 1 : 0;

    const db = getDb();
    const [existing] = await db
      .select()
      .from(schema.company)
      .where(eq(schema.company.store_id, store_id))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(schema.company)
        .set(updateData)
        .where(eq(schema.company.store_id, store_id))
        .returning();
      res.json(updated);
    } else {
      const [created] = await db
        .insert(schema.company)
        .values({ store_id, ...updateData, created_at: new Date() })
        .returning();
      res.status(201).json(created);
    }
  } catch (err) {
    console.error("[company] upsert error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

export default router;
