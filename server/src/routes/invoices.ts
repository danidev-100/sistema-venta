import { Router, Request, Response } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { getDb } from "../db.js";
import * as schema from "../../../db/cloud-schema.js";

const router = Router();

const PAYMENT_METHODS = ["cash", "card", "mixed", "credit", "mercadopago"] as const;

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
    const {
      sale_id,
      invoice_number,
      customer_name,
      customer_doc,
      total,
      payment_method,
      created_by,
      store_id,
      items,
    } = req.body;

    if (!store_id) {
      res.status(400).json({ error: "store_id es requerido" });
      return;
    }
    if (!sale_id) {
      res.status(400).json({ error: "sale_id es requerido (la factura debe referenciar una venta)" });
      return;
    }
    if (!payment_method || !PAYMENT_METHODS.includes(payment_method)) {
      res.status(400).json({ error: "payment_method inválido" });
      return;
    }

    const db = getDb();

    const result = await db.transaction(async (tx) => {
      // Numeración server-side por store, consistente con el patrón de comprobantes.
      let resolvedNumber = invoice_number;
      if (!resolvedNumber) {
        const prefix = "INV";
        const [row] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(schema.invoices)
          .where(eq(schema.invoices.store_id, store_id));
        const next = (row?.count ?? 0) + 1;
        resolvedNumber = `${prefix}-${String(next).padStart(4, "0")}`;
      }

      const [invoice] = await tx
        .insert(schema.invoices)
        .values({
          sale_id,
          invoice_number: resolvedNumber,
          customer_name: customer_name ?? "Consumidor Final",
          customer_doc,
          total: Number(total) || 0,
          payment_method,
          created_by: created_by || "—",
          store_id,
        })
        .returning();

      if (items?.length) {
        await tx.insert(schema.invoiceItems).values(
          items.map((item: any) => ({
            invoice_id: invoice.id,
            product_id: item.product_id ?? null,
            product_name: item.product_name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            subtotal: item.subtotal,
            store_id,
          })),
        );
      }

      const savedItems = await tx
        .select()
        .from(schema.invoiceItems)
        .where(eq(schema.invoiceItems.invoice_id, invoice.id));

      return { ...invoice, items: savedItems };
    });

    res.status(201).json(result);
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "Ya existe una factura con ese número" });
      return;
    }
    console.error("[invoices] create error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

export default router;
