import { Router, Request, Response } from "express";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { getDb } from "../db.js";
import * as schema from "../../../db/cloud-schema.js";

const createExpenseSchema = z.object({
  storeId: z.string().min(1),
  description: z.string().min(1, "Descripción requerida").max(500),
  amount: z.number().positive("El importe debe ser mayor a 0"),
  category: z.enum(["Alquiler", "Servicios", "Insumos", "Sueldos", "Impuestos", "Marketing", "Mantenimiento", "Varios"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (use YYYY-MM-DD)"),
  paymentMethod: z.enum(["cash", "card"]),
});

const updateExpenseSchema = z.object({
  description: z.string().min(1).max(500).optional(),
  amount: z.number().positive().optional(),
  category: z.enum(["Alquiler", "Servicios", "Insumos", "Sueldos", "Impuestos", "Marketing", "Mantenimiento", "Varios"]).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  paymentMethod: z.enum(["cash", "card"]).optional(),
});

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
      .from(schema.expenses)
      .where(eq(schema.expenses.store_id, storeId as string))
      .orderBy(desc(schema.expenses.created_at));
    res.json(results);
  } catch (err) {
    console.error("[expenses] list error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const parsed = createExpenseSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }
    const { storeId, description, amount, category, date, paymentMethod } = parsed.data;
    const db = getDb();
    const [expense] = await db
      .insert(schema.expenses)
      .values({
        store_id: storeId,
        description,
        amount,
        category,
        date,
        payment_method: paymentMethod,
      })
      .returning();
    res.status(201).json(expense);
  } catch (err) {
    console.error("[expenses] create error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.put("/:id", async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const parsed = updateExpenseSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }
    const { description, amount, category, date, paymentMethod } = parsed.data;
    const updateData: Record<string, any> = {};
    if (description !== undefined) updateData.description = description;
    if (amount !== undefined) updateData.amount = amount;
    if (category !== undefined) updateData.category = category;
    if (date !== undefined) updateData.date = date;
    if (paymentMethod !== undefined) updateData.payment_method = paymentMethod;

    const [expense] = await db
      .update(schema.expenses)
      .set(updateData)
      .where(eq(schema.expenses.id, id))
      .returning();

    if (!expense) {
      res.status(404).json({ error: "Gasto no encontrado" });
      return;
    }
    res.json(expense);
  } catch (err) {
    console.error("[expenses] update error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const [expense] = await db
      .delete(schema.expenses)
      .where(eq(schema.expenses.id, id))
      .returning();
    if (!expense) {
      res.status(404).json({ error: "Gasto no encontrado" });
      return;
    }
    res.json({ message: "Gasto eliminado", expense });
  } catch (err) {
    console.error("[expenses] delete error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

export default router;
