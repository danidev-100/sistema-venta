import { Router, Request, Response } from "express";
import { eq, desc } from "drizzle-orm";
import { getDb } from "../db.js";
import * as schema from "../../../db/cloud-schema.js";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const { storeId } = req.query;
    if (!storeId) {
      res.status(400).json({ error: "storeId requerido" });
      return;
    }
    const db = getDb();
    const results = await db
      .select()
      .from(schema.proveedores)
      .where(eq(schema.proveedores.store_id, storeId as string))
      .orderBy(desc(schema.proveedores.created_at));
    res.json(results);
  } catch (err) {
    console.error("[proveedores] list error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const { storeId, name, phone, email, address, cuit } = req.body;
    if (!storeId || !name) {
      res.status(400).json({ error: "storeId y name requeridos" });
      return;
    }
    const db = getDb();
    const [proveedor] = await db
      .insert(schema.proveedores)
      .values({ store_id: storeId, name, phone, email, address, cuit })
      .returning();
    res.status(201).json(proveedor);
  } catch (err) {
    console.error("[proveedores] create error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.put("/:id", async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const { name, phone, email, address, cuit } = req.body;
    const updateData: Record<string, any> = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (address !== undefined) updateData.address = address;
    if (cuit !== undefined) updateData.cuit = cuit;

    if (Object.keys(updateData).length === 0) {
      res.status(400).json({ error: "No hay campos para actualizar" });
      return;
    }

    const [proveedor] = await db
      .update(schema.proveedores)
      .set(updateData)
      .where(eq(schema.proveedores.id, id))
      .returning();

    if (!proveedor) {
      res.status(404).json({ error: "Proveedor no encontrado" });
      return;
    }
    res.json(proveedor);
  } catch (err) {
    console.error("[proveedores] update error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const [proveedor] = await db
      .delete(schema.proveedores)
      .where(eq(schema.proveedores.id, id))
      .returning();
    if (!proveedor) {
      res.status(404).json({ error: "Proveedor no encontrado" });
      return;
    }
    res.json({ message: "Proveedor eliminado", proveedor });
  } catch (err) {
    console.error("[proveedores] delete error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

export default router;
