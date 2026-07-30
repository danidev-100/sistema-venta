import { Router, Request, Response } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "../db.js";
import * as schema from "../../../db/cloud-schema.js";

const router = Router();

// GET / — list customers for store
router.get("/", async (req: Request, res: Response) => {
  try {
    const storeId = req.query.storeId as string;
    if (!storeId) {
      res.status(400).json({ error: "storeId es requerido" });
      return;
    }
    const db = getDb();
    const rows = await db
      .select()
      .from(schema.customers)
      .where(eq(schema.customers.store_id, storeId))
      .orderBy(desc(schema.customers.created_at));
    res.json(rows);
  } catch (err) {
    console.error("[customers] list error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// POST / — create customer
router.post("/", async (req: Request, res: Response) => {
  try {
    const { name, phone, email, address, cuit, credit_balance, store_id } = req.body;
    if (!name || !store_id) {
      res.status(400).json({ error: "Nombre y store_id son requeridos" });
      return;
    }
    const db = getDb();
    const [inserted] = await db
      .insert(schema.customers)
      .values({
        name,
        phone,
        email,
        address,
        cuit,
        credit_balance: credit_balance ?? 0,
        store_id,
      })
      .returning();
    res.status(201).json(inserted);
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "Ya existe un cliente con ese nombre en esta tienda" });
      return;
    }
    console.error("[customers] create error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// PUT /:id — update customer
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const id = Number(req.params.id);
    const { name, phone, email, address, cuit, credit_balance } = req.body;
    const [updated] = await db
      .update(schema.customers)
      .set({
        name,
        phone,
        email,
        address,
        cuit,
        credit_balance,
        updated_at: new Date(),
      })
      .where(eq(schema.customers.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Cliente no encontrado" });
      return;
    }
    res.json(updated);
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "Ya existe un cliente con ese nombre en esta tienda" });
      return;
    }
    console.error("[customers] update error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// DELETE /:id — delete customer
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const id = Number(req.params.id);
    const [deleted] = await db
      .delete(schema.customers)
      .where(eq(schema.customers.id, id))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Cliente no encontrado" });
      return;
    }
    res.json({ message: "Cliente eliminado", customer: deleted });
  } catch (err) {
    console.error("[customers] delete error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// POST /credit-payment — record credit payment & update balance
router.post("/credit-payment", async (req: Request, res: Response) => {
  try {
    const { customer_id, amount, date, notes, sale_id, comprobante_id, store_id } = req.body;
    if (!customer_id || amount == null || !store_id) {
      res.status(400).json({ error: "customer_id, amount y store_id son requeridos" });
      return;
    }
    const db = getDb();

    const [payment] = await db
      .insert(schema.creditPayments)
      .values({
        customer_id,
        amount,
        date: date ? new Date(date) : new Date(),
        notes,
        sale_id,
        comprobante_id,
        store_id,
      })
      .returning();

    await db
      .update(schema.customers)
      .set({
        credit_balance: sql`${schema.customers.credit_balance} - ${amount}`,
        updated_at: new Date(),
      })
      .where(eq(schema.customers.id, customer_id));

    res.status(201).json(payment);
  } catch (err) {
    console.error("[customers] credit-payment error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

export default router;
