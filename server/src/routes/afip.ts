import { Router, Request, Response } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "../db.js";
import * as schema from "../../../db/cloud-schema.js";
import Afip from "@afipsdk/afip.js";

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

const AFIP_DEFAULTS = (storeId: string) => ({
  store_id: storeId,
  cuit: "",
  razon_social: "",
  domicilio: "",
  condicion_iva: "monotributo",
  punto_venta: 1,
  ambiente: "homo",
  activo: 0,
  exigir_cae: 0,
  cert: "",
  key: "",
});

const upsertConfigSchema = z.object({
  store_id: z.string().min(1, "Tienda requerida"),
  cuit: z.string().default(""),
  razon_social: z.string().default(""),
  domicilio: z.string().default(""),
  condicion_iva: z.enum(["monotributo", "responsable_inscripto", "exento"], {
    errorMap: () => ({ message: "Condición fiscal inválida" }),
  }),
  punto_venta: z.number().int("El punto de venta debe ser un número entero").min(1).max(9999),
  ambiente: z.enum(["homo", "prod"], { errorMap: () => ({ message: "Ambiente inválido" }) }),
  activo: z.number().int().min(0).max(1),
  exigir_cae: z.number().int().min(0).max(1),
  cert: z.string().default(""),
  key: z.string().default(""),
});

const testSchema = z.object({
  store_id: z.string().min(1, "Tienda requerida"),
  config: upsertConfigSchema.omit({ store_id: true }).optional(),
});

function buildAfip(config: { cuit: string; cert: string; key: string; ambiente: string }) {
  const cuitDigits = String(config.cuit).replace(/\D/g, "");
  return new Afip({
    CUIT: Number(cuitDigits),
    cert: config.cert,
    key: config.key,
    production: config.ambiente === "prod",
  });
}

// ──────────────────────────────────────────────
// Routes
// ──────────────────────────────────────────────

const router = Router();

// GET /config?storeId= — devuelve la config AFIP del store (o defaults)
router.get("/config", async (req: Request, res: Response) => {
  try {
    const storeId = req.query.storeId as string;
    if (!storeId) {
      res.status(400).json({ error: "storeId requerido" });
      return;
    }
    const db = getDb();
    const [row] = await db
      .select()
      .from(schema.afipConfig)
      .where(eq(schema.afipConfig.store_id, storeId))
      .limit(1);
    res.json(row ?? AFIP_DEFAULTS(storeId));
  } catch (err) {
    console.error("[afip] get config error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// PUT /config — upsert de la config AFIP por store
router.put("/config", async (req: Request, res: Response) => {
  try {
    const parsed = upsertConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }
    const { store_id, ...data } = parsed.data;
    const db = getDb();

    const [existing] = await db
      .select()
      .from(schema.afipConfig)
      .where(eq(schema.afipConfig.store_id, store_id))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(schema.afipConfig)
        .set({ ...data, updated_at: new Date() })
        .where(eq(schema.afipConfig.store_id, store_id))
        .returning();
      res.json(updated);
    } else {
      const [created] = await db
        .insert(schema.afipConfig)
        .values({ store_id, ...data })
        .returning();
      res.status(201).json(created);
    }
  } catch (err) {
    console.error("[afip] upsert config error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// POST /test — valida credenciales AFIP (token WSAA + servicio)
router.post("/test", async (req: Request, res: Response) => {
  try {
    const parsed = testSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }
    const { store_id, config } = parsed.data;

    let afipConfig = config;
    if (!afipConfig) {
      const db = getDb();
      const [row] = await db
        .select()
        .from(schema.afipConfig)
        .where(eq(schema.afipConfig.store_id, store_id))
        .limit(1);
      if (!row) {
        res.status(400).json({ error: "No hay configuracion AFIP guardada para esta tienda" });
        return;
      }
      afipConfig = {
        cuit: row.cuit,
        razon_social: row.razon_social,
        domicilio: row.domicilio,
        condicion_iva: row.condicion_iva,
        punto_venta: row.punto_venta,
        ambiente: row.ambiente,
        activo: row.activo,
        exigir_cae: row.exigir_cae,
        cert: row.cert,
        key: row.key,
      };
    }

    if (!afipConfig.cuit || !afipConfig.cert || !afipConfig.key) {
      res.status(400).json({ error: "CUIT, certificado y clave privada son requeridos" });
      return;
    }

    const afip = buildAfip(afipConfig);
    const puntosVenta = await afip.ElectronicBilling.getSalesPoints();
    res.json({ ok: true, puntosVenta });
  } catch (err) {
    console.error("[afip] test error:", err);
    const msg = err instanceof Error ? err.message : "Error desconocido";
    res.json({ ok: false, error: msg });
  }
});

export default router;
