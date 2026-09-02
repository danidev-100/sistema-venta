import { Router, Request, Response } from "express";
import { eq, and, desc, sql, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db.js";
import * as schema from "../../../db/cloud-schema.js";

const router = Router();

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const createProductSchema = z.object({
  barcode: z.string().nullable().optional(),
  name: z.string().min(1, "Nombre requerido"),
  image: z.string().nullable().optional(),
  price: z.number().min(0).optional().default(0),
  cost_price: z.number().min(0).optional().default(0),
  stock: z.number().int().min(0).optional().default(0),
  min_stock: z.number().int().min(0).optional().default(0),
  sale_unit: z.enum(["unit", "gram", "kilogram"]).optional().default("unit"),
  category_id: z.number().int().nullable().optional().default(null),
  brand_id: z.number().int().nullable().optional().default(null),
  store_id: z.string().min(1, "Tienda requerida"),
});

// GET / — list products for store with category & brand names
router.get("/", async (req: Request, res: Response) => {
  try {
    const storeId = req.query.storeId as string;
    if (!storeId) {
      res.status(400).json({ error: "storeId es requerido" });
      return;
    }
    const db = getDb();
    const rows = await db
      .select({
        id: schema.products.id,
        barcode: schema.products.barcode,
        name: schema.products.name,
        image: schema.products.image,
        price: schema.products.price,
        cost_price: schema.products.cost_price,
        stock: schema.products.stock,
        min_stock: schema.products.min_stock,
        sale_unit: schema.products.sale_unit,
        category_id: schema.products.category_id,
        brand_id: schema.products.brand_id,
        store_id: schema.products.store_id,
        created_at: schema.products.created_at,
        updated_at: schema.products.updated_at,
        sync_status: schema.products.sync_status,
        category_name: schema.categories.name,
        brand_name: schema.brands.name,
      })
      .from(schema.products)
      .leftJoin(schema.categories, eq(schema.products.category_id, schema.categories.id))
      .leftJoin(schema.brands, eq(schema.products.brand_id, schema.brands.id))
      .where(eq(schema.products.store_id, storeId))
      .orderBy(desc(schema.products.created_at));
    res.json(rows);
  } catch (err) {
    console.error("[products] list error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// GET /stock-movements — list movements for a store (optionally filtered by product), newest first
router.get("/stock-movements", async (req: Request, res: Response) => {
  try {
    const storeId = req.query.storeId as string;
    if (!storeId) {
      res.status(400).json({ error: "storeId es requerido" });
      return;
    }
    const db = getDb();
    const conditions = [eq(schema.stockMovements.store_id, storeId)];
    const productId = req.query.productId ? Number(req.query.productId) : undefined;
    if (productId && !isNaN(productId)) {
      conditions.push(eq(schema.stockMovements.product_id, productId));
    }
    const rows = await db
      .select()
      .from(schema.stockMovements)
      .where(and(...conditions))
      .orderBy(desc(schema.stockMovements.created_at));
    res.json(rows);
  } catch (err) {
    console.error("[products] stock-movements error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// GET /stock-consolidated — stock consolidado por código de barras.
// Agrupa las filas con el mismo barcode (no null/vacío) en TODAS las tiendas
// ACTIVAS: suma el stock y expone el detalle por sucursal. `storeId` es la
// "tienda de referencia" para name/price; si no viene o el barcode no existe
// en ella, usa la primera fila encontrada.
router.get("/stock-consolidated", async (req: Request, res: Response) => {
  try {
    const storeId = (req.query.storeId as string) || undefined;
    const db = getDb();
    const rows = await db
      .select({
        barcode: schema.products.barcode,
        name: schema.products.name,
        price: schema.products.price,
        stock: schema.products.stock,
        store_id: schema.products.store_id,
        store_name: schema.stores.name,
      })
      .from(schema.products)
      .innerJoin(
        schema.stores,
        and(
          eq(schema.products.store_id, schema.stores.id),
          eq(schema.stores.active, true),
        ),
      )
      .where(isNotNull(schema.products.barcode));

    const byBarcode = new Map<string, {
      barcode: string;
      name: string;
      price: number;
      total_stock: number;
      per_store: Array<{ store_id: string; store_name: string; stock: number }>;
    }>();

    for (const row of rows) {
      const barcode = (row.barcode ?? "").trim();
      if (!barcode) continue;
      let entry = byBarcode.get(barcode);
      if (!entry) {
        entry = {
          barcode,
          name: row.name,
          price: row.price,
          total_stock: 0,
          per_store: [],
        };
        byBarcode.set(barcode, entry);
      }
      entry.total_stock += row.stock;
      entry.per_store.push({
        store_id: row.store_id,
        store_name: row.store_name,
        stock: row.stock,
      });
      // La tienda de referencia define name/price cuando el query la incluye.
      if (storeId && row.store_id === storeId) {
        entry.name = row.name;
        entry.price = row.price;
      }
    }

    const result = [...byBarcode.values()].sort(
      (a, b) =>
        a.name.localeCompare(b.name, "es") ||
        a.barcode.localeCompare(b.barcode),
    );
    res.json(result);
  } catch (err) {
    console.error("[products] stock-consolidated error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// GET /:id — single product
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const [row] = await db
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, Number(req.params.id)))
      .limit(1);
    if (!row) {
      res.status(404).json({ error: "Producto no encontrado" });
      return;
    }
    res.json(row);
  } catch (err) {
    console.error("[products] get error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// POST / — create product
router.post("/", async (req: Request, res: Response) => {
  try {
    const parsed = createProductSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }

    const { barcode, name, image, price, cost_price, stock, min_stock, sale_unit, category_id, brand_id, store_id } = parsed.data;

    const db = getDb();
    const [inserted] = await db
      .insert(schema.products)
      .values({
        barcode,
        name,
        image: image ?? "",
        price,
        cost_price,
        stock,
        min_stock,
        sale_unit,
        category_id: category_id ?? null,
        brand_id: brand_id ?? null,
        store_id,
      })
      .returning();
    res.status(201).json(inserted);
  } catch (err) {
    console.error("[products] create error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// PUT /:id — update product
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const id = Number(req.params.id);
    const { barcode, name, image, price, cost_price, stock, min_stock, sale_unit, category_id, brand_id } = req.body;
    const [updated] = await db
      .update(schema.products)
      .set({
        barcode,
        name,
        image,
        price,
        cost_price,
        stock,
        min_stock,
        sale_unit,
        category_id: category_id ?? null,
        brand_id: brand_id ?? null,
        updated_at: new Date(),
      })
      .where(eq(schema.products.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Producto no encontrado" });
      return;
    }
    res.json(updated);
  } catch (err) {
    console.error("[products] update error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// DELETE /:id — delete product
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const id = Number(req.params.id);
    const [deleted] = await db
      .delete(schema.products)
      .where(eq(schema.products.id, id))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Producto no encontrado" });
      return;
    }
    res.json({ message: "Producto eliminado", product: deleted });
  } catch (err) {
    console.error("[products] delete error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// POST /stock-movement — record movement & update stock
const stockMovementSchema = z.object({
  product_id: z.number().int().positive("Producto requerido"),
  type: z.enum(["purchase", "sale", "adjustment"], { errorMap: () => ({ message: "Tipo inválido (purchase/sale/adjustment)" }) }),
  quantity: z.number().int().min(0).optional().default(0),
  delta: z.number().int("Delta debe ser un número entero"),
  reference_id: z.string().nullable().optional().default(null),
  user_id: z.string().nullable().optional().default(null),
  store_id: z.string().min(1, "Tienda requerida"),
});

router.post("/stock-movement", async (req: Request, res: Response) => {
  try {
    const parsed = stockMovementSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }
    const { product_id, type, quantity, delta, reference_id, user_id, store_id } = parsed.data;
    const db = getDb();

    const movement = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(schema.stockMovements)
        .values({ product_id, type, quantity: quantity ?? 0, delta, reference_id, user_id: user_id ? Number(user_id) : null, store_id })
        .returning();

      // El stock se actualiza SIEMPRE scoped a la tienda del movimiento:
      // si el producto no existe en esa tienda, no se toca nada y se revierte.
      const [updated] = await tx
        .update(schema.products)
        .set({ stock: sql`${schema.products.stock} + ${delta}`, updated_at: new Date() })
        .where(and(eq(schema.products.id, product_id), eq(schema.products.store_id, store_id)))
        .returning();

      if (!updated) {
        throw new HttpError(404, "Producto no encontrado en esta tienda");
      }

      return inserted;
    });

    res.status(201).json(movement);
  } catch (err) {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("[products] stock-movement error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

export default router;
