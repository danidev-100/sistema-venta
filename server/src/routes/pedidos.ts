import { Router, Request, Response } from "express";
import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../db.js";
import * as schema from "../../../db/cloud-schema.js";

const router = Router();

// GET / — list pedidos for a store
router.get("/", async (req: Request, res: Response) => {
  try {
    const storeId = req.query.storeId as string;
    if (!storeId) { res.status(400).json({ error: "storeId requerido" }); return; }

    const db = getDb();
    const rows = await db
      .select()
      .from(schema.pedidos)
      .where(eq(schema.pedidos.store_id, storeId))
      .orderBy(desc(schema.pedidos.created_at));

    res.json(rows);
  } catch (err) {
    console.error("[pedidos] list error:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// GET /:id — single pedido with items
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const db = getDb();
    const [pedido] = await db
      .select()
      .from(schema.pedidos)
      .where(eq(schema.pedidos.id, id))
      .limit(1);

    if (!pedido) { res.status(404).json({ error: "Pedido no encontrado" }); return; }

    const items = await db
      .select()
      .from(schema.pedidoItems)
      .where(eq(schema.pedidoItems.pedido_id, id));

    res.json({ ...pedido, items });
  } catch (err) {
    console.error("[pedidos] get error:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// POST / — create pedido with items
router.post("/", async (req: Request, res: Response) => {
  try {
    const { proveedor_id, store_id, notes, items } = req.body;
    if (!store_id || !items?.length) {
      res.status(400).json({ error: "store_id e items requeridos" });
      return;
    }

    const db = getDb();
    const total = items.reduce((s: number, i: any) => s + (i.subtotal || i.quantity * i.unit_price), 0);

    const [pedido] = await db
      .insert(schema.pedidos)
      .values({ proveedor_id, store_id, notes, total, status: "pending" })
      .returning();

    for (const item of items) {
      await db.insert(schema.pedidoItems).values({
        pedido_id: pedido.id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal || item.quantity * item.unit_price,
        store_id,
      });
    }

    const allItems = await db
      .select()
      .from(schema.pedidoItems)
      .where(eq(schema.pedidoItems.pedido_id, pedido.id));

    res.status(201).json({ ...pedido, items: allItems });
  } catch (err) {
    console.error("[pedidos] create error:", err);
    res.status(500).json({ error: "Error al crear pedido" });
  }
});

// PUT /:id — update pedido + replace items
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { proveedor_id, status, notes, total, items } = req.body;
    const db = getDb();

    const [pedido] = await db
      .update(schema.pedidos)
      .set({ proveedor_id, status, notes, total, updated_at: new Date() })
      .where(eq(schema.pedidos.id, id))
      .returning();

    if (!pedido) { res.status(404).json({ error: "Pedido no encontrado" }); return; }

    // Replace items
    if (items) {
      await db.delete(schema.pedidoItems).where(eq(schema.pedidoItems.pedido_id, id));
      for (const item of items) {
        await db.insert(schema.pedidoItems).values({
          pedido_id: id,
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: item.subtotal || item.quantity * item.unit_price,
          store_id: pedido.store_id,
        });
      }
    }

    const allItems = await db
      .select()
      .from(schema.pedidoItems)
      .where(eq(schema.pedidoItems.pedido_id, id));

    res.json({ ...pedido, items: allItems });
  } catch (err) {
    console.error("[pedidos] update error:", err);
    res.status(500).json({ error: "Error al actualizar pedido" });
  }
});

// DELETE /:id
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const db = getDb();

    await db.delete(schema.pedidoItems).where(eq(schema.pedidoItems.pedido_id, id));
    await db.delete(schema.pedidos).where(eq(schema.pedidos.id, id));

    res.json({ success: true });
  } catch (err) {
    console.error("[pedidos] delete error:", err);
    res.status(500).json({ error: "Error al eliminar pedido" });
  }
});

export default router;
