import { Router, Request, Response } from "express";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
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
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const [updated] = await db
      .update(schema.sales)
      .set({ status: "refunded" })
      .where(eq(schema.sales.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Venta no encontrada" });
      return;
    }
    res.json(updated);
  } catch (err) {
    console.error("[sales] refund error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id, 10);
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
    console.error("[sales] create error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

export default router;
