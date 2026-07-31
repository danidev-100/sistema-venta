import { Router, Request, Response } from "express";
import { eq, and } from "drizzle-orm";
import { getDb } from "../db.js";
import * as schema from "../../../db/cloud-schema.js";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const { storeId } = req.query;
    if (!storeId) {
      res.status(400).json({ error: "storeId es requerido" });
      return;
    }

    const db = getDb();
    const lists = await db
      .select()
      .from(schema.priceLists)
      .where(eq(schema.priceLists.store_id, storeId as string));

    res.json(lists);
  } catch (err) {
    console.error("[price-lists] list error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.get("/:id/items", async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const items = await db
      .select()
      .from(schema.priceListItems)
      .where(eq(schema.priceListItems.price_list_id, Number(req.params.id)));

    res.json(items);
  } catch (err) {
    console.error("[price-lists] items error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const { name, store_id } = req.body;

    if (!name || !store_id) {
      res.status(400).json({ error: "name y store_id son requeridos" });
      return;
    }

    const db = getDb();
    const [list] = await db
      .insert(schema.priceLists)
      .values({ name, store_id })
      .returning();

    res.status(201).json(list);
  } catch (err) {
    console.error("[price-lists] create error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.put("/:id", async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name) {
      res.status(400).json({ error: "name es requerido" });
      return;
    }

    const db = getDb();
    const [updated] = await db
      .update(schema.priceLists)
      .set({ name, updated_at: new Date() })
      .where(eq(schema.priceLists.id, Number(req.params.id)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Lista de precios no encontrada" });
      return;
    }

    res.json(updated);
  } catch (err) {
    console.error("[price-lists] update error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.put("/:id/items/:productId", async (req: Request, res: Response) => {
  try {
    const { price, percentage } = req.body;
    if ((price === undefined || price === null) && (percentage === undefined || percentage === null)) {
      // Delete override — remove the row so base price applies
      const db = getDb();
      const priceListId = Number(req.params.id);
      const productId = Number(req.params.productId);

      await db
        .delete(schema.priceListItems)
        .where(
          and(
            eq(schema.priceListItems.price_list_id, priceListId),
            eq(schema.priceListItems.product_id, productId),
          ),
        );

      res.json({ success: true });
      return;
    }

    const db = getDb();
    const priceListId = Number(req.params.id);
    const productId = Number(req.params.productId);

    const [existing] = await db
      .select()
      .from(schema.priceListItems)
      .where(
        and(
          eq(schema.priceListItems.price_list_id, priceListId),
          eq(schema.priceListItems.product_id, productId),
        ),
      )
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(schema.priceListItems)
        .set({
          price: price ?? null,
          percentage: percentage ?? null,
          updated_at: new Date(),
        })
        .where(eq(schema.priceListItems.id, existing.id))
        .returning();

      res.json(updated);
    } else {
      const [list] = await db
        .select()
        .from(schema.priceLists)
        .where(eq(schema.priceLists.id, priceListId))
        .limit(1);

      if (!list) {
        res.status(404).json({ error: "Lista de precios no encontrada" });
        return;
      }

      const [created] = await db
        .insert(schema.priceListItems)
        .values({
          price_list_id: priceListId,
          product_id: productId,
          price: price ?? null,
          percentage: percentage ?? null,
          store_id: list.store_id,
        })
        .returning();

      res.status(201).json(created);
    }
  } catch (err) {
    console.error("[price-lists] upsert item error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const id = Number(req.params.id);

    await db
      .delete(schema.priceListItems)
      .where(eq(schema.priceListItems.price_list_id, id));

    const [deleted] = await db
      .delete(schema.priceLists)
      .where(eq(schema.priceLists.id, id))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Lista de precios no encontrada" });
      return;
    }

    res.json({ message: "Lista de precios eliminada" });
  } catch (err) {
    console.error("[price-lists] delete error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

export default router;
