import { Router, Request, Response } from "express";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { getDb } from "../db.js";
import * as schema from "../../../db/cloud-schema.js";

const router = Router();

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

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
      .from(schema.sales)
      .where(eq(schema.sales.store_id, storeId as string))
      .orderBy(desc(schema.sales.created_at));

    const ids = results.map((s) => s.id);
    const itemsBySale: Record<number, typeof schema.saleItems.$inferSelect[]> = {};
    if (ids.length > 0) {
      const allItems = await db
        .select()
        .from(schema.saleItems)
        .where(inArray(schema.saleItems.sale_id, ids));
      for (const item of allItems) {
        (itemsBySale[item.sale_id] ??= []).push(item);
      }
    }

    res.json(results.map((sale) => ({ ...sale, items: itemsBySale[sale.id] ?? [] })));
  } catch (err) {
    console.error("[sales] list error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.post("/:id/refund", async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }

    const updated = await db.transaction(async (tx) => {
      const [sale] = await tx
        .select()
        .from(schema.sales)
        .where(eq(schema.sales.id, id))
        .limit(1);

      if (!sale) {
        throw new HttpError(404, "Venta no encontrada");
      }
      if (sale.status === "refunded") {
        throw new HttpError(400, "La venta ya fue devuelta");
      }

      const items = await tx
        .select()
        .from(schema.saleItems)
        .where(eq(schema.saleItems.sale_id, id));

      // Revertir stock server-side, scoped a la tienda de la venta.
      // Ítems custom (product_id nulo/negativo) no tocan stock.
      for (const item of items) {
        if (item.product_id == null || item.product_id <= 0) continue;

        const [product] = await tx
          .select()
          .from(schema.products)
          .where(
            and(
              eq(schema.products.id, item.product_id),
              eq(schema.products.store_id, sale.store_id),
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
          .set({ stock: sql`${schema.products.stock} + ${item.quantity}`, updated_at: new Date() })
          .where(and(eq(schema.products.id, product.id), eq(schema.products.store_id, sale.store_id)));

        await tx.insert(schema.stockMovements).values({
          product_id: product.id,
          type: "adjustment",
          quantity: item.quantity,
          delta: item.quantity,
          reference_id: `refund-${id}`,
          user_id: (req as any).user?.userId ?? null,
          store_id: sale.store_id,
        });
      }

      const [updated] = await tx
        .update(schema.sales)
        .set({ status: "refunded", updated_at: new Date() })
        .where(eq(schema.sales.id, id))
        .returning();

      return updated;
    });

    res.json(updated);
  } catch (err) {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("[sales] refund error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const [sale] = await db
      .select()
      .from(schema.sales)
      .where(eq(schema.sales.id, id))
      .limit(1);
    if (!sale) {
      res.status(404).json({ error: "Venta no encontrada" });
      return;
    }
    const items = await db
      .select()
      .from(schema.saleItems)
      .where(eq(schema.saleItems.sale_id, id));
    res.json({ ...sale, items });
  } catch (err) {
    console.error("[sales] get error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const {
      storeId,
      items,
      paymentMethod,
      total,
      subtotal,
      iva,
      discountPercent,
      discountAmount,
      amountPaid,
      cashAmount,
      cardAmount,
      mercadopagoAmount,
      change,
      customerName,
      createdBy,
    } = req.body;

    if (!storeId || !items?.length || !paymentMethod) {
      res.status(400).json({ error: "storeId, items y paymentMethod requeridos" });
      return;
    }

    const db = getDb();

    const sale = await db.transaction(async (tx) => {
      const safe = (x: any) => Number(x) || 0;

      const [s] = await tx
        .insert(schema.sales)
        .values({
          store_id: storeId,
          total: safe(total),
          subtotal: safe(subtotal),
          iva: safe(iva),
          discount_percent: safe(discountPercent),
          discount_amount: safe(discountAmount),
          payment_method: paymentMethod,
          amount_paid: safe(amountPaid) || safe(total),
          cash_amount: cashAmount != null ? safe(cashAmount) : null,
          card_amount: cardAmount != null ? safe(cardAmount) : null,
          mercadopago_amount: mercadopagoAmount != null ? safe(mercadopagoAmount) : null,
          change: change != null ? safe(change) : null,
          customer_name: customerName || null,
          created_by: createdBy || (req as any).user?.username || "—",
        })
        .returning();

      for (const item of items) {
        await tx.insert(schema.saleItems).values({
          sale_id: s.id,
          product_id: item.productId,
          product_name: item.productName,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          subtotal: item.subtotal ?? item.quantity * item.unitPrice,
          store_id: storeId,
        });

        // Descontar stock server-side, scoped a la tienda de la venta.
        // Ítems custom (combo/bulto/venta libre) se detectan por productId
        // nulo o negativo: no validan ni descuentan stock.
        if (item.productId != null && Number(item.productId) > 0) {
          const qty = safe(item.quantity);

          const [product] = await tx
            .select()
            .from(schema.products)
            .where(
              and(
                eq(schema.products.id, Number(item.productId)),
                eq(schema.products.store_id, storeId),
              ),
            )
            .limit(1);

          if (!product) {
            throw new HttpError(
              400,
              `El producto '${item.productName || item.productId}' no pertenece a esta sucursal`,
            );
          }

          if (product.stock < qty) {
            throw new HttpError(
              400,
              `Stock insuficiente de '${product.name}' en esta sucursal: hay ${product.stock}, se requieren ${qty}`,
            );
          }

          await tx
            .update(schema.products)
            .set({ stock: sql`${schema.products.stock} - ${qty}`, updated_at: new Date() })
            .where(and(eq(schema.products.id, product.id), eq(schema.products.store_id, storeId)));

          await tx.insert(schema.stockMovements).values({
            product_id: product.id,
            type: "sale",
            quantity: qty,
            delta: -qty,
            reference_id: `sale-${s.id}`,
            user_id: (req as any).user?.userId ?? null,
            store_id: storeId,
          });
        }
      }

      if (customerName && paymentMethod === "credit") {
        const [customer] = await tx
          .select()
          .from(schema.customers)
          .where(
            and(
              eq(schema.customers.name, customerName),
              eq(schema.customers.store_id, storeId),
            ),
          )
          .limit(1);

        if (customer) {
          await tx
            .update(schema.customers)
            .set({ credit_balance: sql`credit_balance + ${safe(total)}` })
            .where(eq(schema.customers.id, customer.id));

          await tx.insert(schema.creditPayments).values({
            customer_id: customer.id,
            amount: safe(total),
            sale_id: s.id,
            store_id: storeId,
            date: new Date(),
            notes: `Venta #${s.id}`,
          });
        }
      }

      return s;
    });

    const saleItems = await db
      .select()
      .from(schema.saleItems)
      .where(eq(schema.saleItems.sale_id, sale.id));

    res.status(201).json({ ...sale, items: saleItems });
  } catch (err) {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("[sales] create error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

export default router;
