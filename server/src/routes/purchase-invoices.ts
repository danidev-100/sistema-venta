import { Router, Request, Response } from "express";
import { z } from "zod";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { getDb } from "../db.js";
import * as schema from "../../../db/cloud-schema.js";

const createPurchaseInvoiceSchema = z.object({
  store_id: z.string().min(1, "Tienda requerida"),
  proveedor_id: z.number().int().positive("Proveedor requerido"),
  invoice_number: z.string().max(100).nullish().default(""),
  notes: z.string().max(1000).nullish().default(""),
  items: z
    .array(
      z.object({
        product_id: z.number().int().positive("Producto requerido"),
        quantity: z.number().int().positive("La cantidad debe ser mayor a 0"),
        unit_price: z.number().min(0, "El costo unitario no puede ser negativo"),
        sale_price: z.number().min(0, "El precio de venta no puede ser negativo"),
      }),
    )
    .min(1, "La factura debe tener al menos un producto"),
});

const router = Router();

// GET / — list purchase invoices for a store
router.get("/", async (req: Request, res: Response) => {
  try {
    const storeId = req.query.storeId as string;
    if (!storeId) {
      res.status(400).json({ error: "storeId requerido" });
      return;
    }

    const db = getDb();
    const rows = await db
      .select()
      .from(schema.purchaseInvoices)
      .where(eq(schema.purchaseInvoices.store_id, storeId))
      .orderBy(desc(schema.purchaseInvoices.created_at));

    const invoiceIds = rows.map((r) => r.id);

    const itemsByInvoice = new Map<number, typeof schema.purchaseInvoiceItems.$inferSelect[]>();
    if (invoiceIds.length > 0) {
      const allItems = await db
        .select()
        .from(schema.purchaseInvoiceItems)
        .where(inArray(schema.purchaseInvoiceItems.purchase_invoice_id, invoiceIds));
      for (const item of allItems) {
        const arr = itemsByInvoice.get(item.purchase_invoice_id) ?? [];
        arr.push(item);
        itemsByInvoice.set(item.purchase_invoice_id, arr);
      }
    }

    const proveedorIds = [...new Set(rows.map((r) => r.proveedor_id))];
    const proveedorNameMap = new Map<number, string>();
    if (proveedorIds.length > 0) {
      const proveedores = await db
        .select()
        .from(schema.proveedores)
        .where(inArray(schema.proveedores.id, proveedorIds));
      for (const prov of proveedores) proveedorNameMap.set(prov.id, prov.name);
    }

    res.json(
      rows.map((r) => ({
        ...r,
        items: itemsByInvoice.get(r.id) ?? [],
        proveedor_name: proveedorNameMap.get(r.proveedor_id) ?? "",
      })),
    );
  } catch (err) {
    console.error("[purchase-invoices] list error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// GET /:id — single purchase invoice with items
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }

    const db = getDb();
    const [invoice] = await db
      .select()
      .from(schema.purchaseInvoices)
      .where(eq(schema.purchaseInvoices.id, id))
      .limit(1);

    if (!invoice) {
      res.status(404).json({ error: "Factura de compra no encontrada" });
      return;
    }

    const items = await db
      .select()
      .from(schema.purchaseInvoiceItems)
      .where(eq(schema.purchaseInvoiceItems.purchase_invoice_id, id));

    const [proveedor] = await db
      .select()
      .from(schema.proveedores)
      .where(eq(schema.proveedores.id, invoice.proveedor_id))
      .limit(1);

    res.json({ ...invoice, items, proveedor_name: proveedor?.name ?? "" });
  } catch (err) {
    console.error("[purchase-invoices] get error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// POST / — create purchase invoice (atomic: invoice + items + stock + cost)
router.post("/", async (req: Request, res: Response) => {
  try {
    const parsed = createPurchaseInvoiceSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }

    const { store_id, proveedor_id, invoice_number, notes, items } = parsed.data;
    const user = (req as any).user;
    const db = getDb();

    const created = await db.transaction(async (tx) => {
      const [proveedor] = await tx
        .select()
        .from(schema.proveedores)
        .where(eq(schema.proveedores.id, proveedor_id))
        .limit(1);

      if (!proveedor) {
        throw new Error("Proveedor no encontrado");
      }
      if (proveedor.store_id !== store_id) {
        throw new Error("El proveedor no pertenece a la tienda");
      }

      const [invoice] = await tx
        .insert(schema.purchaseInvoices)
        .values({
          store_id,
          proveedor_id,
          invoice_number: invoice_number || null,
          notes: notes || null,
          total: 0,
          created_by: user?.username || "—",
        })
        .returning();

      let total = 0;
      for (const item of items) {
        const [product] = await tx
          .select()
          .from(schema.products)
          .where(and(eq(schema.products.id, item.product_id), eq(schema.products.store_id, store_id)))
          .limit(1);

        if (!product) {
          throw new Error(`Producto #${item.product_id} no encontrado en esta tienda`);
        }

        const subtotal = Math.round(item.quantity * item.unit_price * 100) / 100;
        total = Math.round((total + subtotal) * 100) / 100;

        await tx.insert(schema.purchaseInvoiceItems).values({
          purchase_invoice_id: invoice.id,
          product_id: product.id,
          product_name: product.name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          sale_price: item.sale_price,
          subtotal,
          store_id,
        });

        await tx.insert(schema.stockMovements).values({
          product_id: product.id,
          type: "purchase",
          quantity: item.quantity,
          delta: item.quantity,
          reference_id: `purchase:${invoice.id}`,
          user_id: user?.userId ?? null,
          store_id,
        });

        await tx
          .update(schema.products)
          .set({
            stock: sql`stock + ${item.quantity}`,
            cost_price: item.unit_price,
            price: item.sale_price,
            updated_at: new Date(),
          })
          .where(eq(schema.products.id, product.id));
      }

      const [updated] = await tx
        .update(schema.purchaseInvoices)
        .set({ total, updated_at: new Date() })
        .where(eq(schema.purchaseInvoices.id, invoice.id))
        .returning();

      return updated;
    });

    const savedItems = await db
      .select()
      .from(schema.purchaseInvoiceItems)
      .where(eq(schema.purchaseInvoiceItems.purchase_invoice_id, created.id));

    const [proveedor] = await db
      .select()
      .from(schema.proveedores)
      .where(eq(schema.proveedores.id, created.proveedor_id))
      .limit(1);

    res.status(201).json({ ...created, items: savedItems, proveedor_name: proveedor?.name ?? "" });
  } catch (err) {
    console.error("[purchase-invoices] create error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

export default router;
