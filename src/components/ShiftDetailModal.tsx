import type { CompletedSale } from "@/store";
import type { Shift } from "@/store/cash-closing";
import { formatCurrency } from "@/lib/format";
import { salesInShift, shiftPaymentTotals, shiftProducts } from "@/lib/shift-sales";

interface ShiftDetailModalProps {
  shift: Shift;
  /** All completed sales of the store; the shift window filters them. */
  sales: CompletedSale[];
  onClose: () => void;
}

const PAYMENT_LABELS: Record<CompletedSale["paymentMethod"], string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  mixed: "Mixto",
  mercadopago: "Mercado Pago",
  credit: "Cuenta corriente",
};

function time(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

function dateTime(value: string | null | undefined): string {
  if (!value) return "Turno abierto";
  return new Date(value).toLocaleString("es-AR");
}

/**
 * Read-only detail of a shift: who had the register, what was sold, and how it
 * was paid. Association is by time window (see lib/shift-sales).
 */
export default function ShiftDetailModal({ shift, sales, onClose }: ShiftDetailModalProps) {
  const shiftSales = salesInShift(sales, shift);
  const totals = shiftPaymentTotals(shiftSales);
  const products = shiftProducts(shiftSales);
  const sortedSales = [...shiftSales].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  const isOpen = shift.status === "open";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-0 sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Detalle del turno de ${shift.employee}`}
        className="sheet flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-pos-surface shadow-2xl"
      >
        {/* Header */}
        <div className="flex shrink-0 items-start gap-3 border-b border-pos-muted/10 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] font-semibold uppercase tracking-wide text-pos-muted">
              Detalle del turno
            </p>
            <h2 className="truncate text-[15px] font-semibold text-pos-text">
              {shift.employee}
            </h2>
            <p className="mt-0.5 text-[11.5px] text-pos-muted">
              {dateTime(shift.openTime)} → {time(shift.closeTime)}
              {!isOpen && shift.status === "closed" && (
                <span className="ml-2 rounded-pill bg-pos-muted/10 px-2 py-0.5 text-[10.5px] font-medium">
                  Cerrado
                </span>
              )}
              {isOpen && (
                <span className="ml-2 rounded-pill bg-pos-success/10 px-2 py-0.5 text-[10.5px] font-medium text-pos-success">
                  Abierto
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-pos-muted transition-colors hover:bg-pos-background hover:text-pos-text"
            aria-label="Cerrar detalle del turno"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {/* How it was paid */}
          <section aria-label="Cómo se cobró">
            <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-pos-muted">
              Cómo se cobró · {totals.count} venta{totals.count === 1 ? "" : "s"}
            </h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[13px]">
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-pos-muted">Efectivo</dt>
                <dd className="font-mono tabular-nums text-pos-text">{formatCurrency(totals.cash)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-pos-muted">Tarjeta</dt>
                <dd className="font-mono tabular-nums text-pos-text">{formatCurrency(totals.card)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-pos-muted">M. Pago</dt>
                <dd className="font-mono tabular-nums text-pos-text">{formatCurrency(totals.mercadopago)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="font-semibold text-pos-text">Total</dt>
                <dd className="font-mono font-semibold tabular-nums text-pos-text">
                  {formatCurrency(totals.total)}
                </dd>
              </div>
            </dl>
          </section>

          {/* Products sold */}
          <section aria-label="Productos vendidos" className="mt-4">
            <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-pos-muted">
              Productos vendidos
            </h3>
            {products.length === 0 ? (
              <p className="py-3 text-center text-[12.5px] italic text-pos-muted">
                No hay ventas registradas en este turno.
              </p>
            ) : (
              <ul className="divide-y divide-pos-muted/10">
                {products.map((p) => (
                  <li key={p.name} className="flex items-baseline justify-between gap-3 py-1.5">
                    <span className="min-w-0 truncate text-[13px] text-pos-text">{p.name}</span>
                    <span className="shrink-0 font-mono text-[11.5px] text-pos-muted">
                      {p.quantity} ×
                    </span>
                    <span className="shrink-0 font-mono text-[13px] tabular-nums text-pos-text">
                      {formatCurrency(p.total)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Sale by sale */}
          {sortedSales.length > 0 && (
            <section aria-label="Ventas del turno" className="mt-4">
              <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-pos-muted">
                Ventas del turno
              </h3>
              <ul className="divide-y divide-pos-muted/10">
                {sortedSales.map((sale) => (
                  <li key={sale.id} className="flex items-baseline gap-2 py-1.5 text-[12.5px]">
                    <span className="shrink-0 font-mono text-pos-muted">{time(sale.date)}</span>
                    <span className="shrink-0 rounded-pill bg-pos-background px-1.5 py-0.5 text-[10.5px] font-medium text-pos-muted">
                      {PAYMENT_LABELS[sale.paymentMethod]}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-pos-muted">
                      {sale.createdBy}
                      {sale.customerName ? ` · ${sale.customerName}` : ""}
                    </span>
                    <span className="shrink-0 font-mono tabular-nums text-pos-text">
                      {formatCurrency(sale.total)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="shrink-0 border-t border-pos-muted/10 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-control border border-pos-muted/30 px-4 py-2.5 text-sm font-medium text-pos-text transition-colors hover:bg-pos-background touch-target"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
