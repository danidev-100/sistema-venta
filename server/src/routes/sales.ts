import { Router, Request, Response } from "express";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { getDb } from "../db.js";
import { computeSaleTotals, type ComboRef } from "../domain/sale-totals.js";
import * as schema from "../../../db/cloud-schema.js";

const router = Router();

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/**
 * Un importe del body que no es número es un 400, nunca un 0 silencioso
 * (auditoría P1-4): si el POS manda basura, la venta no existe.
 */
function requireNumber(value: unknown, field: string): number {
  if (value === null || value === undefined || value === "") {
    throw new HttpError(400, `El campo '${field}' debe ser un número`);
  }
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new HttpError(400, `El campo '${field}' debe ser un número`);
  }
  return parsed;
}

/** Id de producto opcional: la venta libre viaja con id nulo o negativo. */
function optionalNumber(value: unknown, field: string): number | null {
  if (value === null || value === undefined) return null;
  return requireNumber(value, field);
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
      shiftId,
      priceListId,
    } = req.body;

    if (!storeId || !Array.isArray(items) || items.length === 0 || !paymentMethod) {
      res.status(400).json({ error: "storeId, items y paymentMethod requeridos" });
      return;
    }

    // ── Autoridad del precio (auditoría P0-1) ──
    // Los importes se recalculan desde la base antes de abrir la transacción:
    // si no coinciden con lo que dijo el cliente no se escribe nada.
    const claimed = {
      total: requireNumber(total, "total"),
      subtotal: requireNumber(subtotal, "subtotal"),
      iva: requireNumber(iva, "iva"),
      discountAmount: requireNumber(discountAmount, "discountAmount"),
      discountPercent:
        discountPercent == null ? 0 : requireNumber(discountPercent, "discountPercent"),
    };

    const requestItems = items.map((raw: any, index: number) => ({
      productId: optionalNumber(raw?.productId, `items[${index}].productId`),
      productName: (raw?.productName as string | undefined) ?? "",
      quantity: requireNumber(raw?.quantity, `items[${index}].quantity`),
      unitPrice: requireNumber(raw?.unitPrice, `items[${index}].unitPrice`),
      subtotal:
        raw?.subtotal == null
          ? undefined
          : requireNumber(raw.subtotal, `items[${index}].subtotal`),
      discountPercent:
        raw?.discountPercent == null
          ? 0
          : requireNumber(raw.discountPercent, `items[${index}].discountPercent`),
      saleUnit: (raw?.saleUnit as string | undefined) ?? "unit",
    }));

    const listId = optionalNumber(priceListId, "priceListId");

    // Los importes del cobro se validan antes de abrir la transacción: nunca se
    // guarda un 0 que el cliente no mandó. `amount_paid` conserva el fallback
    // histórico al total cuando el método de pago no manda monto.
    const paidAmount = optionalNumber(amountPaid, "amountPaid");
    const cash = optionalNumber(cashAmount, "cashAmount");
    const card = optionalNumber(cardAmount, "cardAmount");
    const mercadopago = optionalNumber(mercadopagoAmount, "mercadopagoAmount");
    const changeAmount = optionalNumber(change, "change");
    const shift = optionalNumber(shiftId, "shiftId");

    const productIds = [
      ...new Set(
        requestItems
          .map((item) => item.productId)
          .filter((id): id is number => id != null && id > 0),
      ),
    ];

    const db = getDb();

    const [productRows, comboRows, bultoRows, priceListRows, companyRows] = await Promise.all([
      productIds.length > 0
        ? db
            .select()
            .from(schema.products)
            .where(
              and(
                eq(schema.products.store_id, storeId),
                inArray(schema.products.id, productIds),
              ),
            )
        : Promise.resolve([]),
      db.select().from(schema.combos).where(eq(schema.combos.store_id, storeId)),
      db.select().from(schema.bultos).where(eq(schema.bultos.store_id, storeId)),
      listId != null
        ? db
            .select()
            .from(schema.priceListItems)
            .where(eq(schema.priceListItems.price_list_id, listId))
        : Promise.resolve([]),
      db.select().from(schema.company).where(eq(schema.company.store_id, storeId)).limit(1),
    ]);

    const comboItemRows =
      comboRows.length > 0
        ? await db
            .select()
            .from(schema.comboItems)
            .where(inArray(schema.comboItems.combo_id, comboRows.map((combo) => combo.id)))
        : [];

    const combos: ComboRef[] = comboRows.map((combo) => ({
      id: combo.id,
      comboPrice: combo.combo_price,
      items: comboItemRows
        .filter((row) => row.combo_id === combo.id)
        .map((row) => ({ productId: row.product_id, quantity: row.quantity })),
    }));

    const company = companyRows[0];

    const expected = computeSaleTotals({
      items: requestItems,
      products: productRows.map((product) => ({ id: product.id, price: product.price })),
      priceListItems: priceListRows.map((row) => ({
        productId: row.product_id,
        price: row.price,
        percentage: row.percentage,
      })),
      combos,
      bultos: bultoRows.map((bulto) => ({
        id: bulto.id,
        productId: bulto.product_id ?? 0,
        quantity: bulto.quantity,
        bultoPrice: bulto.bulto_price,
      })),
      iva: {
        alicuota: company?.iva_alicuota ?? 0,
        incluido: company?.iva_incluido === 1,
      },
      claimed,
    });

    if (expected.mismatches.length > 0) {
      res.status(409).json({
        error: "Los totales de la venta no coinciden con los ítems y los precios de la base",
        expected: {
          total: expected.total,
          subtotal: expected.subtotal,
          iva: expected.iva,
        },
      });
      return;
    }

    const sale = await db.transaction(async (tx) => {
      const [s] = await tx
        .insert(schema.sales)
        .values({
          store_id: storeId,
          total: expected.total,
          subtotal: expected.subtotal,
          iva: expected.iva,
          discount_percent: expected.discountPercent,
          discount_amount: expected.discountAmount,
          payment_method: paymentMethod,
          amount_paid: paidAmount || expected.total,
          cash_amount: cash,
          card_amount: card,
          mercadopago_amount: mercadopago,
          change: changeAmount,
          customer_name: customerName || null,
          created_by: createdBy || (req as any).user?.username || "—",
          // Links the sale to its cash register shift; null for older clients.
          shift_id: shift,
        })
        .returning();

      for (const item of requestItems) {
        await tx.insert(schema.saleItems).values({
          sale_id: s.id,
          product_id: item.productId as number,
          product_name: item.productName,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          subtotal: item.subtotal ?? item.quantity * item.unitPrice,
          store_id: storeId,
        });

        // Descontar stock server-side, scoped a la tienda de la venta.
        // Ítems custom (combo/bulto/venta libre) se detectan por productId
        // nulo o negativo: no validan ni descuentan stock.
        if (item.productId != null && item.productId > 0) {
          const qty = item.quantity;

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
            .set({ credit_balance: sql`credit_balance + ${expected.total}` })
            .where(eq(schema.customers.id, customer.id));

          await tx.insert(schema.creditPayments).values({
            customer_id: customer.id,
            amount: expected.total,
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
