import { Router, Request, Response } from "express";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { getDb } from "../db.js";
import * as schema from "../../../db/cloud-schema.js";

const router = Router();

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

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

    const pedidoIds = rows.map((p) => p.id);

    const itemsByPedido = new Map<number, typeof schema.pedidoItems.$inferSelect[]>();
    if (pedidoIds.length > 0) {
      const allItems = await db
        .select()
        .from(schema.pedidoItems)
        .where(inArray(schema.pedidoItems.pedido_id, pedidoIds));
      for (const item of allItems) {
        const arr = itemsByPedido.get(item.pedido_id) ?? [];
        arr.push(item);
        itemsByPedido.set(item.pedido_id, arr);
      }
    }

    const proveedorIds = [...new Set(rows.map((p) => p.proveedor_id))];
    const proveedorNameMap = new Map<number, string>();
    if (proveedorIds.length > 0) {
      const proveedores = await db
        .select()
        .from(schema.proveedores)
        .where(inArray(schema.proveedores.id, proveedorIds));
      for (const prov of proveedores) proveedorNameMap.set(prov.id, prov.name);
    }

    res.json(
      rows.map((p) => ({
        ...p,
        items: itemsByPedido.get(p.id) ?? [],
        proveedor_name: proveedorNameMap.get(p.proveedor_id) ?? "",
      })),
    );
  } catch (err) {
    console.error("[pedidos] list error:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// GET /:id — single pedido with items
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
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

    const [proveedor] = await db
      .select()
      .from(schema.proveedores)
      .where(eq(schema.proveedores.id, pedido.proveedor_id))
      .limit(1);

    res.json({ ...pedido, items, proveedor_name: proveedor?.name ?? "" });
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
    const id = parseInt(req.params.id as string);
    const { proveedor_id, status, notes, total, items } = req.body;
    const db = getDb();

    const [pedido] = await db
      .update(schema.pedidos)
      .set({ proveedor_id, status, notes, total, updated_at: new Date() })
      .where(eq(schema.pedidos.id, id))
      .returning();

    if (!pedido) { res.status(404).json({ error: "Pedido no encontrado" }); return; }

    // Preserve received_qty for existing items across the delete/re-insert cycle
    const receivedByItem = new Map<number, number>();
    if (items) {
      const currentItems = await db
        .select()
        .from(schema.pedidoItems)
        .where(eq(schema.pedidoItems.pedido_id, id));
      for (const item of currentItems) receivedByItem.set(item.id, item.received_qty);
    }

    // Replace items
    if (items) {
      await db.delete(schema.pedidoItems).where(eq(schema.pedidoItems.pedido_id, id));
      for (const item of items) {
        await db.insert(schema.pedidoItems).values({
          pedido_id: id,
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          received_qty: item.id != null ? (receivedByItem.get(item.id) ?? 0) : 0,
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

// PUT /:id/status — update pedido status
router.put("/:id/status", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const { status } = req.body;

    if (!["pending", "received", "cancelled", "partial"].includes(status)) {
      res.status(400).json({ error: "Status inválido" });
      return;
    }

    const db = getDb();

    const result = await db.transaction(async (tx) => {
      const [pedido] = await tx
        .select()
        .from(schema.pedidos)
        .where(eq(schema.pedidos.id, id))
        .limit(1);

      if (!pedido) {
        throw new HttpError(404, "Pedido no encontrado");
      }

      const items = await tx
        .select()
        .from(schema.pedidoItems)
        .where(eq(schema.pedidoItems.pedido_id, id));

      // El cambio de estado a "received" / fuera de "received" ajusta stock
      // server-side (scoped a la tienda del pedido), igual que la recepción
      // por ítem. Solo se mueven las cantidades aún no recibidas.
      const goingReceived = status === "received" && pedido.status !== "received";
      const leavingReceived = pedido.status === "received" && status !== "received";

      if (goingReceived || leavingReceived) {
        for (const item of items) {
          if (item.product_id == null) continue;
          const remaining = item.quantity - item.received_qty;
          if (remaining <= 0) continue;

          const [product] = await tx
            .select()
            .from(schema.products)
            .where(
              and(
                eq(schema.products.id, item.product_id),
                eq(schema.products.store_id, pedido.store_id),
              ),
            )
            .limit(1);

          if (!product) {
            throw new HttpError(
              400,
              `El producto '${item.product_name}' no pertenece a esta sucursal`,
            );
          }

          const delta = goingReceived ? remaining : -remaining;

          await tx
            .update(schema.products)
            .set({ stock: sql`GREATEST(0, ${schema.products.stock} + ${delta})`, updated_at: new Date() })
            .where(and(eq(schema.products.id, product.id), eq(schema.products.store_id, pedido.store_id)));

          await tx.insert(schema.stockMovements).values({
            product_id: product.id,
            type: goingReceived ? "purchase" : "adjustment",
            quantity: Math.abs(delta),
            delta,
            reference_id: `pedido:${id}`,
            user_id: (req as any).user?.userId ?? null,
            store_id: pedido.store_id,
          });
        }
      }

      const [updated] = await tx
        .update(schema.pedidos)
        .set({ status, updated_at: new Date() })
        .where(eq(schema.pedidos.id, id))
        .returning();

      const finalItems = await tx
        .select()
        .from(schema.pedidoItems)
        .where(eq(schema.pedidoItems.pedido_id, id));

      const [proveedor] = await tx
        .select()
        .from(schema.proveedores)
        .where(eq(schema.proveedores.id, pedido.proveedor_id))
        .limit(1);

      return { ...updated, items: finalItems, proveedor_name: proveedor?.name ?? "" };
    });

    res.json(result);
  } catch (err) {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("[pedidos] update status error:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// PUT /:id/items/:itemId/receive — receive part of an item
router.put("/:id/items/:itemId/receive", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const itemId = parseInt(req.params.itemId as string);
    const { quantity } = req.body;

    if (typeof quantity !== "number" || !Number.isFinite(quantity) || quantity <= 0) {
      res.status(400).json({ error: "Cantidad inválida" });
      return;
    }

    const db = getDb();

    const result = await db.transaction(async (tx) => {
      const [pedido] = await tx
        .select()
        .from(schema.pedidos)
        .where(eq(schema.pedidos.id, id))
        .limit(1);

      if (!pedido) {
        throw new HttpError(404, "Pedido no encontrado");
      }

      const [item] = await tx
        .select()
        .from(schema.pedidoItems)
        .where(and(eq(schema.pedidoItems.id, itemId), eq(schema.pedidoItems.pedido_id, id)))
        .limit(1);

      if (!item) {
        throw new HttpError(404, "Item no encontrado");
      }

      const remaining = item.quantity - item.received_qty;
      if (remaining <= 0) {
        throw new HttpError(400, "El item ya fue recibido por completo");
      }

      const qtyToReceive = Math.min(quantity, remaining);
      const newReceived = item.received_qty + qtyToReceive;

      await tx
        .update(schema.pedidoItems)
        .set({ received_qty: newReceived, updated_at: new Date() })
        .where(eq(schema.pedidoItems.id, itemId));

      // La recepción SUMA stock server-side, scoped a la tienda del pedido.
      if (item.product_id != null && qtyToReceive > 0) {
        const [product] = await tx
          .select()
          .from(schema.products)
          .where(
            and(
              eq(schema.products.id, item.product_id),
              eq(schema.products.store_id, pedido.store_id),
            ),
          )
          .limit(1);

        if (!product) {
          throw new HttpError(
            400,
            `El producto '${item.product_name}' no pertenece a esta sucursal`,
          );
        }

        await tx
          .update(schema.products)
          .set({ stock: sql`${schema.products.stock} + ${qtyToReceive}`, updated_at: new Date() })
          .where(and(eq(schema.products.id, product.id), eq(schema.products.store_id, pedido.store_id)));

        await tx.insert(schema.stockMovements).values({
          product_id: product.id,
          type: "purchase",
          quantity: qtyToReceive,
          delta: qtyToReceive,
          reference_id: `pedido:${id}`,
          user_id: (req as any).user?.userId ?? null,
          store_id: pedido.store_id,
        });
      }

      // Recompute status from all items
      const allItems = await tx
        .select()
        .from(schema.pedidoItems)
        .where(eq(schema.pedidoItems.pedido_id, id));

      let newStatus: "pending" | "received" | "cancelled" | "partial" = pedido.status;
      if (allItems.length > 0 && allItems.every((i) => i.received_qty >= i.quantity)) {
        newStatus = "received";
      } else if (allItems.some((i) => i.received_qty > 0)) {
        newStatus = "partial";
      }

      await tx
        .update(schema.pedidos)
        .set({ status: newStatus, updated_at: new Date() })
        .where(eq(schema.pedidos.id, id));

      const [proveedor] = await tx
        .select()
        .from(schema.proveedores)
        .where(eq(schema.proveedores.id, pedido.proveedor_id))
        .limit(1);

      return { ...pedido, status: newStatus, items: allItems, proveedor_name: proveedor?.name ?? "" };
    });

    res.json(result);
  } catch (err) {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("[pedidos] receive item error:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// DELETE /:id
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
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
