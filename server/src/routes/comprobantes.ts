import { Router, Request, Response } from "express";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { getDb } from "../db.js";
import * as schema from "../../../db/cloud-schema.js";

const router = Router();

// GET / — list comprobantes for store
router.get("/", async (req: Request, res: Response) => {
  try {
    const storeId = req.query.storeId as string;
    if (!storeId) { res.status(400).json({ error: "storeId requerido" }); return; }

    const db = getDb();
    const rows = await db
      .select()
      .from(schema.comprobantes)
      .where(eq(schema.comprobantes.store_id, storeId))
      .orderBy(desc(schema.comprobantes.created_at));

    const comprobanteIds = rows.map((c) => c.id);

    const itemsByComp = new Map<number, typeof schema.comprobanteItems.$inferSelect[]>();
    if (comprobanteIds.length > 0) {
      const allItems = await db
        .select()
        .from(schema.comprobanteItems)
        .where(inArray(schema.comprobanteItems.comprobante_id, comprobanteIds));
      for (const item of allItems) {
        const arr = itemsByComp.get(item.comprobante_id) ?? [];
        arr.push(item);
        itemsByComp.set(item.comprobante_id, arr);
      }
    }

    res.json(rows.map((c) => ({ ...c, items: itemsByComp.get(c.id) ?? [] })));
  } catch (err) {
    console.error("[comprobantes] list error:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// GET /:id — single comprobante with items
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const db = getDb();

    const [comp] = await db
      .select()
      .from(schema.comprobantes)
      .where(eq(schema.comprobantes.id, id))
      .limit(1);

    if (!comp) { res.status(404).json({ error: "Comprobante no encontrado" }); return; }

    const items = await db
      .select()
      .from(schema.comprobanteItems)
      .where(eq(schema.comprobanteItems.comprobante_id, id));

    res.json({ ...comp, items });
  } catch (err) {
    console.error("[comprobantes] get error:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// POST / — create comprobante with items
router.post("/", async (req: Request, res: Response) => {
  try {
    const { tipo, numero, cliente_nombre, cliente_cuit, cliente_direccion, payment_method, subtotal, iva, total, sale_id, notes, created_by, store_id, items } = req.body;

    if (!tipo || !store_id) {
      res.status(400).json({ error: "tipo y store_id requeridos" });
      return;
    }

    const db = getDb();

    // Auto-generate a sequential number per store+tipo when not provided.
    // The frontend does not send `numero`, so without this the NOT NULL
    // constraint on comprobantes.numero fails with a 500.
    let resolvedNumero = numero;
    if (!resolvedNumero) {
      const prefix = tipo === "factura" ? "F" : tipo === "boleta" ? "B" : tipo === "nota_credito" ? "NC" : tipo === "nota_debito" ? "ND" : "T";
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.comprobantes)
        .where(and(eq(schema.comprobantes.store_id, store_id), eq(schema.comprobantes.tipo, tipo)));
      const next = (row?.count ?? 0) + 1;
      resolvedNumero = `${prefix}-${String(next).padStart(4, "0")}`;
    }

    const [comp] = await db
      .insert(schema.comprobantes)
      .values({
        tipo, numero: resolvedNumero, cliente_nombre, cliente_cuit, cliente_direccion,
        payment_method, subtotal, iva, total, sale_id, notes, created_by, store_id,
      })
      .returning();

    if (items?.length) {
      for (const item of items) {
        await db.insert(schema.comprobanteItems).values({
          comprobante_id: comp.id,
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: item.subtotal,
          store_id,
        });
      }
    }

    const allItems = await db
      .select()
      .from(schema.comprobanteItems)
      .where(eq(schema.comprobanteItems.comprobante_id, comp.id));

    res.status(201).json({ ...comp, items: allItems });
  } catch (err) {
    console.error("[comprobantes] create error:", err);
    res.status(500).json({ error: "Error al crear comprobante" });
  }
});

export default router;
