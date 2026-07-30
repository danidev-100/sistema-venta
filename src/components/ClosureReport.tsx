import { useMemo } from "react";
import {
  useCashClosingStore,
  type ShiftSummary,
} from "@/store/cash-closing";
import { useAppStore, type CompletedSale } from "@/store";
import { formatCurrency } from "@/lib/format";

// ──────────────────────────────────────────────
// Props
// ──────────────────────────────────────────────

type ClosureReportProps = {
  shiftId: number;
  completedSales: CompletedSale[];
};

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export default function ClosureReport({
  shiftId,
  completedSales,
}: ClosureReportProps) {
  const getShiftSummary = useCashClosingStore((s) => s.getShiftSummary);

  const summary: ShiftSummary | null = useMemo(
    () => getShiftSummary(shiftId, completedSales),
    [shiftId, completedSales, getShiftSummary],
  );

  if (!summary) {
    return (
      <div className="flex items-center justify-center h-32">
        <p className="text-sm text-pos-muted italic">Turno no encontrado</p>
      </div>
    );
  }

  const { shift, totalSales, cashTotal, cardTotal, mercadopagoTotal, transactionCount, itemCount, topProducts, withdrawalsTotal, depositsTotal } = summary;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-pos-text uppercase tracking-wide">
        Informe de Cierre
      </h3>

      <div className="bg-pos-surface rounded-xl border border-pos-muted/10 divide-y divide-pos-muted/10">
        {/* Shift info */}
        <div className="px-4 py-3 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-pos-muted">Empleado</span>
            <span className="text-sm font-medium">{shift.employee}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-pos-muted">Apertura</span>
            <span className="text-sm font-mono">
              {new Date(shift.openTime).toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-pos-muted">Cierre</span>
            <span className="text-sm font-mono">
              {shift.closeTime
                ? new Date(shift.closeTime).toLocaleString()
                : "—"}
            </span>
          </div>
        </div>

        {/* Sales summary */}
        <div className="px-4 py-3 space-y-2">
          <h4 className="text-xs font-semibold text-pos-text uppercase tracking-wide">
            Resumen de Ventas
          </h4>
          <div className="flex items-center justify-between">
            <span className="text-sm text-pos-muted">Transacciones</span>
            <span className="text-sm font-mono font-bold">{transactionCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-pos-muted">Total Productos Vendidos</span>
            <span className="text-sm font-mono font-bold">{itemCount}</span>
          </div>
          <hr className="border-pos-muted/20" />
          <div className="flex items-center justify-between">
            <span className="text-sm text-pos-muted">Total Efectivo</span>
            <span className="text-sm font-mono font-bold">
              {formatCurrency(cashTotal)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-pos-muted">Total Tarjeta</span>
            <span className="text-sm font-mono font-bold">
              {formatCurrency(cardTotal)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-pos-muted">Total Mercado Pago</span>
            <span className="text-sm font-mono font-bold">
              {formatCurrency(mercadopagoTotal)}
            </span>
          </div>
          <hr className="border-pos-muted/20" />
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Total Ventas</span>
            <span className="text-base font-mono font-bold text-pos-text">
              {formatCurrency(totalSales)}
            </span>
          </div>
        </div>

        {/* Cash Movements */}
        {(withdrawalsTotal > 0 || depositsTotal > 0) && (
          <div className="px-4 py-3 space-y-2">
            <h4 className="text-xs font-semibold text-pos-text uppercase tracking-wide">
              Movimientos de Caja
            </h4>
            {withdrawalsTotal > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-pos-muted">Retiros</span>
                <span className="text-sm font-mono font-bold text-pos-danger">
                  −{formatCurrency(withdrawalsTotal)}
                </span>
              </div>
            )}
            {depositsTotal > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-pos-muted">Depósitos</span>
                <span className="text-sm font-mono font-bold text-pos-success">
                  +{formatCurrency(depositsTotal)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Reconciliation */}
        {shift.reconciliationStatus && (
          <div className="px-4 py-3 space-y-2">
            <h4 className="text-xs font-semibold text-pos-text uppercase tracking-wide">
              Arqueo
            </h4>
            <div className="flex items-center justify-between">
              <span className="text-sm text-pos-muted">Apertura de Caja</span>
              <span className="text-sm font-mono">
                {formatCurrency(shift.openingBalance)}
              </span>
            </div>

            <div className="bg-pos-background/30 rounded-lg p-3 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-pos-muted">Caja declarada</span>
                <span className="font-mono">{formatCurrency(shift.declaredCash!)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-pos-muted">− Apertura</span>
                <span className="font-mono text-pos-danger">−{formatCurrency(shift.openingBalance)}</span>
              </div>
              <hr className="border-pos-muted/20" />
              <div className="flex items-center justify-between text-sm font-semibold">
                <span className="text-pos-text">= Ventas Efectivo</span>
                <span className="font-mono">{formatCurrency(cashTotal)}</span>
              </div>
            </div>

            <hr className="border-pos-muted/20" />
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Diferencia</span>
              <span
                className={`text-sm font-mono font-bold ${
                  shift.variance === 0
                    ? "text-pos-success"
                    : shift.variance! < 0
                      ? "text-pos-danger"
                      : "text-pos-accent"
                }`}
              >
                {shift.variance! >= 0 ? "+" : ""}{formatCurrency(shift.variance!)}
              </span>
            </div>
            <div
              className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${
                shift.reconciliationStatus === "matched"
                  ? "bg-pos-success/10 text-pos-success"
                  : "bg-pos-accent/10 text-pos-accent"
              }`}
            >
                {shift.reconciliationStatus === "matched"
                  ? "✓ Coincide"
                  : "⚠ Diferencia"}
            </div>
          </div>
        )}

        {/* Top Products */}
        {topProducts.length > 0 && (
          <div className="px-4 py-3 space-y-2">
            <h4 className="text-xs font-semibold text-pos-text uppercase tracking-wide">
              Productos Destacados
            </h4>
            <div className="space-y-1">
              {topProducts.map((p, i) => (
                <div
                  key={p.name}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-pos-text truncate flex-1">
                    <span className="text-pos-muted mr-1">{i + 1}.</span>
                    {p.name}
                  </span>
                  <span className="text-pos-muted font-mono text-xs ml-2">
                    x{p.quantity}
                  </span>
                  <span className="font-mono text-xs ml-2 w-16 text-right">
                    {formatCurrency(p.total)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {topProducts.length === 0 && (
          <div className="px-4 py-3">
            <p className="text-xs text-pos-muted italic">
              No se vendieron productos en este turno
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
