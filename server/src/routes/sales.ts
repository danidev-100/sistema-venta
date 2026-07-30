import { Router, Request, Response } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
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
    res.json(results);
  } catch (err) {
    console.error("[sales] list error:", err);
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
      cashAmount,
      cardAmount,
      mercadopagoAmount,
      customerName,
      globalDiscountPercent,
    } = req.body;

    if (!storeId || !items?.length || !paymentMethod) {
      res.status(400).json({ error: "storeId, items y paymentMethod requeridos" });
      return;
    }

    const db = getDb();

    const sale = await db.transaction(async (tx) => {
      const subtotal = items.reduce(
        (s: number, i: any) => s + (i.subtotal ?? i.quantity * i.unitPrice),
        0,
      );
      const discount = globalDiscountPercent
        ? subtotal * (globalDiscountPercent / 100)
        : 0;
      const total = Math.round((subtotal - discount) * 100) / 100;
      const amountPaid =
        (cashAmount ?? 0) + (cardAmount ?? 0) + (mercadopagoAmount ?? 0);
      const change =
        paymentMethod === "cash" ? Math.max(0, amountPaid - total) : 0;

      const pm: "cash" | "card" =
        paymentMethod === "card" ? "card" : "cash";

      const [s] = await tx
        .insert(schema.sales)
        .values({
          store_id: storeId,
          total,
          payment_method: pm,
          amount_paid: amountPaid || total,
          change,
          customer_name: customerName || null,
          created_by: (req as any).user?.username || "—",
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

        await tx
          .update(schema.products)
          .set({ stock: sql`stock - ${item.quantity}` })
          .where(eq(schema.products.id, item.productId));
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
            .set({ credit_balance: sql`credit_balance + ${total}` })
            .where(eq(schema.customers.id, customer.id));

          await tx.insert(schema.creditPayments).values({
            customer_id: customer.id,
            amount: total,
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
