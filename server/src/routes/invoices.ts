import { Router, Request, Response } from "express";
import { eq, desc } from "drizzle-orm";
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
    const invoices = await db
      .select()
      .from(schema.invoices)
      .where(eq(schema.invoices.store_id, storeId))
      .orderBy(desc(schema.invoices.created_at));

    const result = await Promise.all(
      invoices.map(async (inv) => {
        const items = await db
          .select()
          .from(schema.invoiceItems)
          .where(eq(schema.invoiceItems.invoice_id, inv.id));
        return { ...inv, items };
      }),
    );

    res.json(result);
  } catch (err) {
    console.error("[invoices] list error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const [invoice] = await db
      .select()
      .from(schema.invoices)
      .where(eq(schema.invoices.id, Number(req.params.id)))
      .limit(1);

    if (!invoice) {
      res.status(404).json({ error: "Factura no encontrada" });
      return;
    }

    const items = await db
      .select()
      .from(schema.invoiceItems)
      .where(eq(schema.invoiceItems.invoice_id, invoice.id));

    res.json({ ...invoice, items });
  } catch (err) {
    console.error("[invoices] get error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const { sale_id, invoice_number, customer_name, customer_doc, total, payment_method, store_id, items } = req.body;

    if (!invoice_number || !store_id) {
      res.status(400).json({ error: "invoice_number y store_id son requeridos" });
      return;
    }

    const db = getDb();
    const [invoice] = await db
      .insert(schema.invoices)
      .values({ sale_id, invoice_number, customer_name, customer_doc, total, payment_method, store_id })
      .returning();

    if (items?.length) {
      await db.insert(schema.invoiceItems).values(
        items.map((item: any) => ({
          invoice_id: invoice.id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: item.subtotal,
          store_id,
        })),
      );
    }

    const savedItems = await db
      .select()
      .from(schema.invoiceItems)
      .where(eq(schema.invoiceItems.invoice_id, invoice.id));

    res.status(201).json({ ...invoice, items: savedItems });
  } catch (err) {
    console.error("[invoices] create error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

export default router;
