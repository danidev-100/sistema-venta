import { Router, Request, Response } from "express";
import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../db.js";
import * as schema from "../../../db/cloud-schema.js";

const router = Router();

// ── Shifts ──

router.get("/shifts", async (req: Request, res: Response) => {
  try {
    const { storeId } = req.query;
    if (!storeId) {
      res.status(400).json({ error: "storeId requerido" });
      return;
    }
    const db = getDb();
    const results = await db
      .select()
      .from(schema.shifts)
      .where(eq(schema.shifts.store_id, storeId as string))
      .orderBy(desc(schema.shifts.created_at));
    res.json(results);
  } catch (err) {
    console.error("[cash] list shifts error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.post("/shifts", async (req: Request, res: Response) => {
  try {
    const { storeId, employee, openingBalance } = req.body;
    if (!storeId || !employee) {
      res.status(400).json({ error: "storeId y employee requeridos" });
      return;
    }
    const openingBalanceNum = Math.max(0, Number(openingBalance) || 0);
    const db = getDb();
    const [shift] = await db
      .insert(schema.shifts)
      .values({
        employee,
        store_id: storeId,
        opening_balance: openingBalanceNum,
      })
      .returning();
    res.status(201).json(shift);
  } catch (err) {
    console.error("[cash] open shift error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.put("/shifts/:id/close", async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const { closeTime } = req.body;
    const [shift] = await db
      .update(schema.shifts)
      .set({
        // Prefer the timestamp sent by the client (matches the app's local
        // timezone). Fall back to the server clock only if not provided.
        close_time: closeTime ? new Date(closeTime) : new Date(),
        status: "closed",
      })
      .where(eq(schema.shifts.id, id))
      .returning();
    if (!shift) {
      res.status(404).json({ error: "Turno no encontrado" });
      return;
    }
    res.json(shift);
  } catch (err) {
    console.error("[cash] close shift error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// ── Cash Movements ──

router.get("/movements", async (req: Request, res: Response) => {
  try {
    const { storeId, shiftId } = req.query;
    if (!storeId) {
      res.status(400).json({ error: "storeId requerido" });
      return;
    }
    const db = getDb();
    const conditions: any[] = [eq(schema.cashMovements.store_id, storeId as string)];
    if (shiftId) {
      conditions.push(eq(schema.cashMovements.shift_id, parseInt(shiftId as string, 10)));
    }
    const results = await db
      .select()
      .from(schema.cashMovements)
      .where(and(...conditions))
      .orderBy(desc(schema.cashMovements.created_at));
    res.json(results);
  } catch (err) {
    console.error("[cash] list movements error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.post("/movements", async (req: Request, res: Response) => {
  try {
    const { storeId, shiftId, type, amount, description, method } = req.body;
    if (!storeId || !shiftId || !type || !amount) {
      res.status(400).json({ error: "storeId, shiftId, type y amount requeridos" });
      return;
    }
    const db = getDb();
    const [movement] = await db
      .insert(schema.cashMovements)
      .values({
        shift_id: shiftId,
        type,
        amount,
        method: method || "cash",
        reason: description || "",
        created_by: (req as any).user?.username || "—",
        store_id: storeId,
      })
      .returning();
    res.status(201).json(movement);
  } catch (err) {
    console.error("[cash] create movement error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// ── Reconcile ──

router.post("/reconcile", async (req: Request, res: Response) => {
  try {
    const {
      shiftId,
      declaredCash,
      expectedTotal,
      variance,
      reconciliationStatus,
      storeId,
      reconciledAt,
    } = req.body;
    if (!shiftId || !storeId) {
      res.status(400).json({ error: "shiftId y storeId requeridos" });
      return;
    }
    const db = getDb();
    const num = (v: unknown) =>
      v !== undefined && v !== null && Number.isFinite(Number(v))
        ? Number(v)
        : null;
    const [shift] = await db
      .update(schema.shifts)
      .set({
        declared_cash: num(declaredCash),
        variance: num(variance),
        reconciliation_status: reconciliationStatus || "pending",
        reconciled_at: reconciledAt ? new Date(reconciledAt) : new Date(),
      })
      .where(
        and(
          eq(schema.shifts.id, Number(shiftId)),
          eq(schema.shifts.store_id, storeId as string),
        ),
      )
      .returning();
    if (!shift) {
      res.status(404).json({ error: "Turno no encontrado" });
      return;
    }
    res.json(shift);
  } catch (err) {
    console.error("[cash] reconcile error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

export default router;
