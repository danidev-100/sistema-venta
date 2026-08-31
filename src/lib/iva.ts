// ──────────────────────────────────────────────
// Cálculo de IVA configurable
// ──────────────────────────────────────────────

export type IvaBreakdown = {
  /** Base imponible (monto neto antes de IVA). */
  base: number;
  /** Importe de IVA. */
  iva: number;
  /** Total a cobrar. */
  total: number;
  /** Alícuota aplicada (porcentaje). */
  alicuota: number;
  /** true = el precio ya incluye IVA (impuesto informativo). */
  incluido: boolean;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Calcula el IVA sobre el monto neto (ya descontados combos/descuentos).
 *
 * - incluido=true:  el neto ya incluye el IVA → base = neto / (1 + alícuota),
 *                   iva = neto − base, total = neto (se cobra el neto).
 * - incluido=false: base = neto, iva = neto × alícuota, total = neto + iva.
 */
export function computeIva(
  net: number,
  alicuota: number,
  incluido: boolean,
): IvaBreakdown {
  const rate = Math.max(0, Number(alicuota) || 0) / 100;
  if (rate <= 0) {
    return { base: net, iva: 0, total: net, alicuota: 0, incluido };
  }
  if (incluido) {
    const base = r2(net / (1 + rate));
    const iva = r2(net - base);
    return { base, iva, total: net, alicuota: rate * 100, incluido };
  }
  const iva = r2(net * rate);
  const total = r2(net + iva);
  return { base: net, iva, total, alicuota: rate * 100, incluido };
}
