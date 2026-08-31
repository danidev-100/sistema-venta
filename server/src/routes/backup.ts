import { Router, Request, Response } from "express";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { getDb } from "../db.js";
import * as schema from "../../../db/cloud-schema.js";
import { authMiddleware, requireRole, requireStoreAccess } from "../middleware/auth.js";

const BACKUP_VERSION = 1;

// ──────────────────────────────────────────────
// Tablas incluidas en el backup, en orden de
// inserción (padre → hijo). El borrado recorre
// el orden inverso (hijo → padre) para respetar
// las dependencias entre tablas.
//
// Todas las tablas tienen columna store_id propia,
// así que se filtran directamente por la tienda.
// No se incluyen users, stores, sync_queue ni
// sync_logs (infraestructura / fuera de la tienda).
// ──────────────────────────────────────────────

type TableDef = { key: string; table: any };

const TABLES: TableDef[] = [
  { key: "categories", table: schema.categories },
  { key: "brands", table: schema.brands },
  { key: "customers", table: schema.customers },
  { key: "proveedores", table: schema.proveedores },
  { key: "expenses", table: schema.expenses },
  { key: "plantillas", table: schema.plantillas },
  { key: "company", table: schema.company },
  { key: "afip_config", table: schema.afipConfig },
  { key: "products", table: schema.products },
  { key: "shifts", table: schema.shifts },
  { key: "combos", table: schema.combos },
  { key: "price_lists", table: schema.priceLists },
  { key: "stock_movements", table: schema.stockMovements },
  { key: "bultos", table: schema.bultos },
  { key: "combo_items", table: schema.comboItems },
  { key: "price_list_items", table: schema.priceListItems },
  { key: "sales", table: schema.sales },
  { key: "sale_items", table: schema.saleItems },
  { key: "invoices", table: schema.invoices },
  { key: "invoice_items", table: schema.invoiceItems },
  { key: "comprobantes", table: schema.comprobantes },
  { key: "comprobante_items", table: schema.comprobanteItems },
  { key: "pedidos", table: schema.pedidos },
  { key: "pedido_items", table: schema.pedidoItems },
  { key: "purchase_invoices", table: schema.purchaseInvoices },
  { key: "purchase_invoice_items", table: schema.purchaseInvoiceItems },
  { key: "credit_payments", table: schema.creditPayments },
  { key: "cash_closings", table: schema.cashClosings },
  { key: "cash_movements", table: schema.cashMovements },
];

const TABLE_KEYS = TABLES.map((t) => t.key);

function chunkRows<T>(rows: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size));
  }
  return chunks;
}

const router = Router();

// Solo administradores; requireStoreAccess deja pasar a admin con cualquier tienda.
router.use(authMiddleware, requireRole("admin"), requireStoreAccess);

// GET /api/backup/export?storeId=...
router.get("/export", async (req: Request, res: Response) => {
  try {
    const storeId = req.query.storeId as string;
    if (!storeId) {
      res.status(400).json({ error: "storeId es requerido" });
      return;
    }

    const db = getDb();
    const data: Record<string, unknown[]> = {};
    for (const { key, table } of TABLES) {
      data[key] = await db
        .select()
        .from(table)
        .where(eq(table.store_id, storeId));
    }

    res.json({
      version: BACKUP_VERSION,
      exported_at: new Date().toISOString(),
      store_id: storeId,
      data,
    });
  } catch (err) {
    console.error("[backup] export error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

const importSchema = z.object({
  storeId: z.string().min(1, "storeId requerido"),
  data: z.object({
    version: z.number().int().positive("Versión de respaldo inválida"),
    exported_at: z.string().optional(),
    store_id: z.string().optional(),
    data: z.record(z.array(z.unknown())),
  }),
});

// POST /api/backup/import — body { storeId, data }
router.post("/import", async (req: Request, res: Response) => {
  try {
    const parsed = importSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }

    const { storeId } = parsed.data;
    const tables = parsed.data.data.data;

    const presentKeys = TABLE_KEYS.filter((k) => Array.isArray(tables[k]));
    if (presentKeys.length === 0) {
      res.status(400).json({ error: "El respaldo no contiene tablas reconocidas" });
      return;
    }

    const db = getDb();

    const result = await db.transaction(async (tx) => {
      // ── 1) Borrar datos actuales de la tienda, hijo → padre ──
      const deleted: Record<string, number> = {};
      for (const { key, table } of [...TABLES].reverse()) {
        const rows = await tx
          .delete(table)
          .where(eq(table.store_id, storeId))
          .returning({ id: table.id });
        deleted[key] = rows.length;
      }

      // ── 2) Reinsertar del backup, padre → hijo ──
      // Se normaliza store_id a la tienda destino para que las filas nunca
      // queden apuntando a una tienda que no es la actual (ej. backup de otra tienda).
      const inserted: Record<string, number> = {};
      for (const { key, table } of TABLES) {
        const rows = tables[key];
        if (!Array.isArray(rows) || rows.length === 0) continue;

        const values = (rows as Record<string, unknown>[]).map((r) => ({
          ...r,
          store_id: storeId,
        }));

        // Inserciones por lotes: una sola inserción multi-fila con miles de
        // filas puede superar el límite de 65535 parámetros de Postgres.
        for (const chunk of chunkRows(values, 500)) {
          await tx.insert(table).values(chunk);
        }
        inserted[key] = values.length;
      }

      // ── 3) Resincronizar secuencias identity ──
      // Al insertar con id explícito (GENERATED BY DEFAULT AS IDENTITY) la
      // secuencia no avanza; sin esto el próximo insert colisionaría.
      // Tabla vacía → setval(..., 1, false) para que el próximo id sea 1.
      for (const key of TABLE_KEYS) {
        await tx.execute(sql`
          SELECT setval(
            pg_get_serial_sequence(${key}, 'id'),
            COALESCE((SELECT MAX(id) FROM ${sql.identifier(key)}), 1),
            (SELECT MAX(id) FROM ${sql.identifier(key)}) IS NOT NULL
          )
        `);
      }

      return { deleted, inserted };
    });

    const counts = result.inserted;
    const tablesRestored = Object.keys(counts).length;

    res.json({
      tables_restored: tablesRestored,
      counts,
      deleted: result.deleted,
    });
  } catch (err: any) {
    // Cualquier fallo dentro de la transacción hace ROLLBACK total.
    console.error("[backup] import error:", err);
    res.status(400).json({
      error: err?.message ?? "Error al restaurar el respaldo",
    });
  }
});

export default router;