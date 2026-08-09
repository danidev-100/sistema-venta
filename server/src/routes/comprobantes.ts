import { Router, Request, Response } from "express";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { getDb } from "../db.js";
import * as schema from "../../../db/cloud-schema.js";
import Afip from "@afipsdk/afip.js";

const router = Router();

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// ──────────────────────────────────────────────
// AFIP helpers
// ──────────────────────────────────────────────

const r2 = (n: number) => Math.round(n * 100) / 100;

function buildAfip(config: { cuit: string; cert: string; key: string; ambiente: string }) {
  const cuitDigits = String(config.cuit).replace(/\D/g, "");
  return new Afip({
    CUIT: Number(cuitDigits),
    cert: config.cert,
    key: config.key,
    production: config.ambiente === "prod",
  });
}

// Resuelve la "letra" del comprobante (A/B/C) según condición fiscal del emisor.
function resolveLetra(
  tipo: string,
  condicionIva: string,
  tieneCuit: boolean,
): "A" | "B" | "C" {
  if (condicionIva === "monotributo") return "C";
  if (tipo === "boleta") {
    // boleta: responsable inscripto → B, exento → C
    return condicionIva === "responsable_inscripto" ? "B" : "C";
  }
  // factura y notas: exento → B
  if (condicionIva === "exento") return "B";
  // responsable inscripto
  return tieneCuit ? "A" : "B";
}

// Mapea tipo + letra al CbteTipo de AFIP.
function computeCbteTipo(
  tipo: string,
  condicionIva: string,
  tieneCuit: boolean,
): number {
  const letra = resolveLetra(tipo, condicionIva, tieneCuit);
  switch (tipo) {
    case "factura":
    case "boleta":
      return letra === "A" ? 1 : letra === "B" ? 6 : 11;
    case "nota_credito":
      return letra === "A" ? 3 : letra === "B" ? 8 : 13;
    case "nota_debito":
      return letra === "A" ? 2 : letra === "B" ? 7 : 12;
    default:
      return 11;
  }
}

// GET / — list comprobantes for store
router.get("/", async (req: Request, res: Response) => {
  try {
    const storeId = req.query.storeId as string;
    if (!storeId) { res.status(400).json({ error: "storeId requerido" }); return; }

    const db = getDb();
    const rows = await db
      .select()
      .from(schema.comprobantes)
      .where(eq(schema.comprobantes.store_id, storeId))
      .orderBy(desc(schema.comprobantes.created_at));

    const comprobanteIds = rows.map((c) => c.id);

    const itemsByComp = new Map<number, typeof schema.comprobanteItems.$inferSelect[]>();
    if (comprobanteIds.length > 0) {
      const allItems = await db
        .select()
        .from(schema.comprobanteItems)
        .where(inArray(schema.comprobanteItems.comprobante_id, comprobanteIds));
      for (const item of allItems) {
        const arr = itemsByComp.get(item.comprobante_id) ?? [];
        arr.push(item);
        itemsByComp.set(item.comprobante_id, arr);
      }
    }

    res.json(rows.map((c) => ({ ...c, items: itemsByComp.get(c.id) ?? [] })));
  } catch (err) {
    console.error("[comprobantes] list error:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// GET /:id — single comprobante with items
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const db = getDb();

    const [comp] = await db
      .select()
      .from(schema.comprobantes)
      .where(eq(schema.comprobantes.id, id))
      .limit(1);

    if (!comp) { res.status(404).json({ error: "Comprobante no encontrado" }); return; }

    const items = await db
      .select()
      .from(schema.comprobanteItems)
      .where(eq(schema.comprobanteItems.comprobante_id, id));

    res.json({ ...comp, items });
  } catch (err) {
    console.error("[comprobantes] get error:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// POST / — create comprobante with items (interno o AFIP)
router.post("/", async (req: Request, res: Response) => {
  try {
    const {
      tipo, numero, cliente_nombre, cliente_cuit, cliente_direccion, payment_method,
      subtotal, iva, total, sale_id, notes, created_by, store_id, items,
      modo, ivaPercent,
    } = req.body;

    if (!tipo || !store_id) {
      res.status(400).json({ error: "tipo y store_id requeridos" });
      return;
    }

    const resolvedModo: "afip" | "interno" = modo === "afip" ? "afip" : "interno";
    const db = getDb();

    // Validaciones rápidas (fuera de la transacción)
    if (resolvedModo === "afip") {
      if (tipo === "ticket") {
        res.status(400).json({ error: "El ticket es siempre interno" });
        return;
      }
      if (tipo === "nota_credito" || tipo === "nota_debito") {
        res
          .status(400)
          .json({ error: "Las notas de crédito/débito por AFIP aún no están disponibles. Usá modo interno." });
        return;
      }
    }

    let afipConfig: typeof schema.afipConfig.$inferSelect | null = null;
    if (resolvedModo === "afip") {
      const [row] = await db
        .select()
        .from(schema.afipConfig)
        .where(eq(schema.afipConfig.store_id, store_id))
        .limit(1);
      afipConfig = row ?? null;
      if (!afipConfig || afipConfig.activo !== 1) {
        res.status(400).json({ error: "AFIP no está configurado. Configuralo en Admin > AFIP" });
        return;
      }
    }

    const result = await db.transaction(async (tx) => {
      // ── Numeración ──
      let resolvedNumero = numero;
      let needAfipVoucher = false;
      let cbteTipo = 0;
      let ptoVta = 0;
      let cbteDesde = 0;
      let afipInstance: ReturnType<typeof buildAfip> | null = null;

      if (resolvedModo === "afip") {
        const cuitCliente = String(cliente_cuit ?? "").replace(/\D/g, "");
        cbteTipo = computeCbteTipo(tipo, afipConfig!.condicion_iva, cuitCliente.length === 11);
        ptoVta = afipConfig!.punto_venta;
        afipInstance = buildAfip(afipConfig!);

        const lastVoucher = await afipInstance.ElectronicBilling.getLastVoucher(ptoVta, cbteTipo).catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          throw new HttpError(400, `AFIP: ${msg}`);
        });
        cbteDesde = Number(lastVoucher) + 1;
        resolvedNumero = `${ptoVta}-${String(cbteDesde).padStart(8, "0")}`;
        needAfipVoucher = true;
      } else {
        // Auto-generate a sequential number per store+tipo when not provided.
        if (!resolvedNumero) {
          const prefix = tipo === "factura" ? "F" : tipo === "boleta" ? "B" : tipo === "nota_credito" ? "NC" : tipo === "nota_debito" ? "ND" : "T";
          const [row] = await tx
            .select({ count: sql<number>`count(*)::int` })
            .from(schema.comprobantes)
            .where(and(eq(schema.comprobantes.store_id, store_id), eq(schema.comprobantes.tipo, tipo)));
          const next = (row?.count ?? 0) + 1;
          resolvedNumero = `${prefix}-${String(next).padStart(4, "0")}`;
        }
      }

      // ── Insertar comprobante ──
      const [comp] = await tx
        .insert(schema.comprobantes)
        .values({
          tipo,
          numero: resolvedNumero,
          cliente_nombre,
          cliente_cuit,
          cliente_direccion,
          payment_method,
          subtotal,
          iva,
          total,
          sale_id,
          notes,
          created_by,
          store_id,
          modo: resolvedModo,
        })
        .returning();

      // ── Insertar items ──
      if (items?.length) {
        for (const item of items) {
          await tx.insert(schema.comprobanteItems).values({
            comprobante_id: comp.id,
            product_id: item.product_id,
            product_name: item.product_name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            subtotal: item.subtotal,
            store_id,
          });
        }
      }

      // ── Stock: solo comprobantes manuales (sin sale_id) ──
      if (!sale_id && items?.length) {
        for (const item of items) {
          if (!item.product_id) continue;
          const qty = Math.round(Number(item.quantity) || 0);
          if (qty <= 0) continue;
          await tx.insert(schema.stockMovements).values({
            product_id: item.product_id,
            type: "sale",
            quantity: qty,
            delta: -qty,
            reference_id: `comprobante:${comp.id}`,
            user_id: null,
            store_id,
          });
          await tx
            .update(schema.products)
            .set({ stock: sql`${schema.products.stock} - ${qty}`, updated_at: new Date() })
            .where(eq(schema.products.id, item.product_id));
        }
      }

      // ── Lógica AFIP (solo modo afip) ──
      let savedComp: typeof comp = comp;
      if (needAfipVoucher) {
        try {
          const cuitCliente = String(cliente_cuit ?? "").replace(/\D/g, "");
          const isA = cbteTipo === 1 || cbteTipo === 2 || cbteTipo === 3;
          const isC = cbteTipo === 11 || cbteTipo === 12 || cbteTipo === 13;
          const isB = !isA && !isC;

          const impNeto = r2(Number(subtotal) || 0);
          const impTotal = r2(Number(total) || 0);
          const rawIva = typeof iva === "number" ? iva : typeof iva === "string" && iva !== "" ? Number(iva) : NaN;
          const impIva = !isNaN(rawIva)
            ? r2(rawIva)
            : r2(impNeto * (Number(ivaPercent) || 0) / 100);

          const discriminado = !isC;
          const impIvaFinal = discriminado ? impIva : 0;
          const ivaArr = discriminado && impIvaFinal > 0
            ? [{ Id: 5, BaseImp: impNeto, Importe: impIvaFinal }]
            : [];

          const condIvaReceptor = isA ? 1 : isB ? 5 : cuitCliente.length === 11 ? 6 : 5;

          let docTipo = 99;
          let docNro = 0;
          if (cuitCliente.length === 11) {
            docTipo = 80;
            docNro = parseInt(cuitCliente, 10);
          }

          const today = new Date();
          const cbteFch = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();

          const result = await afipInstance!.ElectronicBilling.createVoucher({
            CantReg: 1,
            PtoVta: ptoVta,
            CbteTipo: cbteTipo,
            Concepto: 1,
            DocTipo: docTipo,
            DocNro: docNro,
            CbteDesde: cbteDesde,
            CbteHasta: cbteDesde,
            CbteFch: cbteFch,
            ImpTotal: impTotal,
            ImpTotConc: 0,
            ImpNeto: discriminado ? impNeto : impTotal,
            ImpOpEx: 0,
            ImpIVA: impIvaFinal,
            ImpTrib: 0,
            MonId: "PES",
            MonCotiz: 1,
            CondicionIVAReceptorId: condIvaReceptor,
            Iva: ivaArr,
          });

          const [updated] = await tx
            .update(schema.comprobantes)
            .set({
              cae: String(result.CAE),
              cae_vto: new Date(result.CAEFchVto),
              afip_numero: cbteDesde,
              afip_pto_venta: ptoVta,
              afip_tipo: cbteTipo,
              afip_status: "ok",
              afip_error: null,
              modo: "afip",
              updated_at: new Date(),
            })
            .where(eq(schema.comprobantes.id, comp.id))
            .returning();
          savedComp = updated;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (afipConfig!.exigir_cae === 1) {
            throw new HttpError(400, `AFIP: ${msg}`);
          }
          // Si no se exige CAE, el comprobante queda creado pero sin CAE.
          // Como AFIP no registró el número (CbteDesde), hay que salir de la
          // numeración AFIP para no colisionar con un reintento futuro.
          const prefix = tipo === "factura" ? "F" : tipo === "boleta" ? "B" : "T";
          const [row] = await tx
            .select({ count: sql<number>`count(*)::int` })
            .from(schema.comprobantes)
            .where(and(eq(schema.comprobantes.store_id, store_id), eq(schema.comprobantes.tipo, tipo)));
          const localNumero = `${prefix}-${String(row?.count ?? 0).padStart(4, "0")}`;
          const [updated] = await tx
            .update(schema.comprobantes)
            .set({
              numero: localNumero,
              afip_status: "error",
              afip_error: msg,
              modo: "afip",
              updated_at: new Date(),
            })
            .where(eq(schema.comprobantes.id, comp.id))
            .returning();
          savedComp = updated;
        }
      }

      const allItems = await tx
        .select()
        .from(schema.comprobanteItems)
        .where(eq(schema.comprobanteItems.comprobante_id, comp.id));

      return { ...savedComp, items: allItems };
    });

    res.status(201).json(result);
  } catch (err) {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("[comprobantes] create error:", err);
    res.status(500).json({ error: "Error al crear comprobante" });
  }
});

export default router;
