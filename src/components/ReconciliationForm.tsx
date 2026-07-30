import { useState, useMemo } from "react";
import { useCashClosingStore, computeExpectedCash, computeVariance, type Shift, type CashMovement } from "@/store/cash-closing";
import { useAppStore, type CompletedSale } from "@/store";
import { formatCurrency } from "@/lib/format";
import NumberInput from "@/components/NumberInput";

// ──────────────────────────────────────────────
// Props
// ──────────────────────────────────────────────

type ReconciliationFormProps = {
  shift: Shift;
  completedSales: CompletedSale[];
  onReconciled: () => void;
};

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export default function ReconciliationForm({
  shift,
  completedSales,
  onReconciled,
}: ReconciliationFormProps) {
  const reconcile = useCashClosingStore((s) => s.reconcile);

  const [declaredCash, setDeclaredCash] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const movements = useCashClosingStore((s) =>
    s.cashMovements.filter((m) => m.shiftId === shift.id),
  );

  const withdrawalsTotal = useMemo(
    () =>
      movements
        .filter((m) => m.type === "withdrawal")
        .reduce((sum, m) => sum + m.amount, 0),
    [movements],
  );

  const depositsTotal = useMemo(
    () =>
      movements
        .filter((m) => m.type === "deposit")
        .reduce((sum, m) => sum + m.amount, 0),
    [movements],
  );

  const expectedCash = useMemo(
    () => computeExpectedCash(completedSales, shift.openTime, shift.closeTime!),
    [completedSales, shift.openTime, shift.closeTime],
  );

  const expectedWithMovements = expectedCash + shift.openingBalance - withdrawalsTotal + depositsTotal;

  const declaredNum = declaredCash;
  const previewVariance = declaredCash > 0
    ? computeVariance(declaredNum, expectedWithMovements)
    : null;

  // Already reconciled — show result
  if (shift.reconciliationStatus) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-pos-text uppercase tracking-wide">
          Arqueo
        </h3>

        <div className="bg-pos-surface rounded-xl border border-pos-muted/10 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-pos-muted">Apertura de Caja</span>
            <span className="text-sm font-mono font-bold">
              {formatCurrency(shift.openingBalance)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-pos-muted">Efectivo Declarado</span>
            <span className="text-sm font-mono font-bold">
              {formatCurrency(shift.declaredCash!)}
            </span>
          </div>

          <div className="bg-pos-background/50 rounded-lg p-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-pos-muted">Ventas Efectivo</span>
              <span className="font-mono text-pos-success">+{formatCurrency(expectedCash)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-pos-muted">Apertura de Caja</span>
              <span className="font-mono text-pos-success">+{formatCurrency(shift.openingBalance)}</span>
            </div>
            {withdrawalsTotal > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-pos-muted">Retiros</span>
                <span className="font-mono text-pos-danger">−{formatCurrency(withdrawalsTotal)}</span>
              </div>
            )}
            {depositsTotal > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-pos-muted">Depósitos</span>
                <span className="font-mono text-pos-success">+{formatCurrency(depositsTotal)}</span>
              </div>
            )}
            <hr className="border-pos-muted/20" />
            <div className="flex items-center justify-between text-sm font-semibold">
              <span className="text-pos-text">Esperado en Caja</span>
              <span className="font-mono">{formatCurrency(expectedWithMovements)}</span>
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
            {shift.reconciliationStatus === "matched" ? "✓ Coincide" : "⚠ Diferencia"}
          </div>
        </div>
      </div>
    );
  }

  // Pending reconciliation
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-pos-text uppercase tracking-wide">
        Arqueo de Caja
      </h3>

      {error && (
        <div className="bg-pos-danger/10 border border-pos-danger/30 text-pos-danger text-sm rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="bg-pos-surface rounded-xl border border-pos-muted/10 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-pos-muted">Apertura de Caja</span>
          <span className="text-sm font-mono font-bold text-pos-text">
            {formatCurrency(shift.openingBalance)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-pos-muted">Dinero en Caja (declarado)</span>
          <span className="text-sm font-mono font-bold text-pos-text">
            {formatCurrency(declaredNum)}
          </span>
        </div>

        <hr className="border-pos-muted/20" />

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Ventas Efectivo</span>
          <span className="text-sm font-mono font-bold text-pos-success text-base">
            {formatCurrency(expectedCash)}
          </span>
        </div>

        <div className="bg-pos-background/50 rounded-lg p-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-pos-muted">Ventas Efectivo</span>
            <span className="font-mono text-pos-success">+{formatCurrency(expectedCash)}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-pos-muted">Apertura de Caja</span>
            <span className="font-mono text-pos-success">+{formatCurrency(shift.openingBalance)}</span>
          </div>
          {withdrawalsTotal > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-pos-muted">Retiros</span>
              <span className="font-mono text-pos-danger">−{formatCurrency(withdrawalsTotal)}</span>
            </div>
          )}
          {depositsTotal > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-pos-muted">Depósitos</span>
              <span className="font-mono text-pos-success">+{formatCurrency(depositsTotal)}</span>
            </div>
          )}
          <hr className="border-pos-muted/20" />
          <div className="flex items-center justify-between text-sm font-semibold">
            <span className="text-pos-text">= Esperado en Caja</span>
            <span className="font-mono">{formatCurrency(expectedWithMovements)}</span>
          </div>
        </div>

        <hr className="border-pos-muted/20" />

        <div>
          <label
            htmlFor="declared-cash"
            className="block text-sm font-medium text-pos-text mb-1"
          >
            Dinero en Caja (contado real)
          </label>
          <NumberInput
            id="declared-cash"
            value={declaredCash}
            onChange={setDeclaredCash}
            placeholder="0,00"
            className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-lg text-right font-mono focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target"
          />
        </div>

        {previewVariance !== null && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-pos-muted">Diferencia</span>
            <span
              className={`text-sm font-mono font-bold ${
                previewVariance === 0
                  ? "text-pos-success"
                  : previewVariance < 0
                    ? "text-pos-danger"
                    : "text-pos-accent"
              }`}
            >
              {previewVariance >= 0 ? "+" : ""}{formatCurrency(previewVariance)}
            </span>
          </div>
        )}

        <button
          onClick={() => {
            setError(null);
            const amount = declaredCash;
            if (amount < 0) {
              setError("Ingresá un monto válido");
              return;
            }
            try {
              reconcile(shift.id, amount, completedSales);
              onReconciled();
            } catch (err) {
              setError(
                err instanceof Error ? err.message : "Error en el arqueo",
              );
            }
          }}
          disabled={declaredCash <= 0}
          className="w-full px-4 py-2 bg-pos-secondary text-white rounded-lg font-medium text-sm touch-target hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Arquear
        </button>
      </div>
    </div>
  );
}
