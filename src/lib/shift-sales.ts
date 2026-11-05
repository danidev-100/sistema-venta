import type { CompletedSale } from "@/store";

/**
 * Shift ↔ sale association.
 *
 * Sales are NOT linked to a shift in the database: `sales.shift_id` exists but
 * no writer populates it, so every shift summary in the app associates sales by
 * time window. These helpers are the single implementation of that rule.
 */

export interface ShiftWindow {
  id?: number;
  openTime: string;
  closeTime?: string | null;
}

export interface ShiftPaymentTotals {
  cash: number;
  card: number;
  mercadopago: number;
  total: number;
  count: number;
}

export interface ShiftProductRow {
  name: string;
  quantity: number;
  total: number;
}

function cents(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Sales that belong to a shift.
 *
 * An explicit `shiftId` on the sale is authoritative: it decides inclusion even
 * when the timestamps say otherwise (overlapping shifts, a sale synced late, a
 * clock skew). Sales without a shift id — rows written before the field was
 * persisted, or by an older client — fall back to the time window, edges
 * included.
 */
export function salesInShift<T extends { date: string; shiftId?: number | null }>(
  sales: T[],
  shift: ShiftWindow,
  referenceTime: number = Date.now(),
): T[] {
  const open = new Date(shift.openTime).getTime();
  const close = shift.closeTime ? new Date(shift.closeTime).getTime() : referenceTime;

  return sales.filter((sale) => {
    if (sale.shiftId != null && shift.id != null) return sale.shiftId === shift.id;
    const t = new Date(sale.date).getTime();
    return t >= open && t <= close;
  });
}

/**
 * Money collected per payment method. A mixed sale contributes only its cash,
 * card and Mercado Pago portions; a credit sale collects nothing up front, so
 * it is counted in `count` but adds no money.
 */
export function shiftPaymentTotals(sales: CompletedSale[]): ShiftPaymentTotals {
  let cash = 0;
  let card = 0;
  let mercadopago = 0;

  for (const sale of sales) {
    if (sale.paymentMethod === "cash") cash += sale.total;
    else if (sale.paymentMethod === "card") card += sale.total;
    else if (sale.paymentMethod === "mercadopago") mercadopago += sale.total;
    else if (sale.paymentMethod === "mixed") {
      cash += sale.cashAmount ?? 0;
      card += sale.cardAmount ?? 0;
      mercadopago += sale.mercadopagoAmount ?? 0;
    }
  }

  cash = cents(cash);
  card = cents(card);
  mercadopago = cents(mercadopago);

  return { cash, card, mercadopago, total: cents(cash + card + mercadopago), count: sales.length };
}

/** Units and money sold per product, biggest money first. */
export function shiftProducts(sales: CompletedSale[]): ShiftProductRow[] {
  const byName = new Map<string, ShiftProductRow>();

  for (const sale of sales) {
    for (const item of sale.items ?? []) {
      const row = byName.get(item.productName);
      if (row) {
        row.quantity += item.quantity;
        row.total += item.subtotal;
      } else {
        byName.set(item.productName, {
          name: item.productName,
          quantity: item.quantity,
          total: item.subtotal,
        });
      }
    }
  }

  return Array.from(byName.values())
    .map((row) => ({ ...row, total: cents(row.total) }))
    .sort((a, b) => b.total - a.total);
}
