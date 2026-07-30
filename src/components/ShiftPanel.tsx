import { useState } from "react";
import { useCashClosingStore, type Shift, type CashMovement } from "@/store/cash-closing";
import { formatCurrency } from "@/lib/format";
import NumberInput from "@/components/NumberInput";

// ──────────────────────────────────────────────
// Props
// ──────────────────────────────────────────────

type ShiftPanelProps = {
  storeId: string;
  currentShift: Shift | null;
  onShiftChanged: () => void;
};

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export default function ShiftPanel({
  storeId,
  currentShift,
  onShiftChanged,
}: ShiftPanelProps) {
  const openShift = useCashClosingStore((s) => s.openShift);
  const closeShift = useCashClosingStore((s) => s.closeShift);

  const [employee, setEmployee] = useState("");
  const [openingAmount, setOpeningAmount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handleOpen() {
    setError(null);
    setSuccess(null);

    const trimmed = employee.trim();
    if (!trimmed) {
      setError("Ingresá el nombre del empleado");
      return;
    }

    const balance = openingAmount;

    try {
      openShift(trimmed, storeId, balance);
      setSuccess(`Turno abierto para ${trimmed} — ${formatCurrency(balance)} de apertura`);
      setEmployee("");
      setOpeningAmount(0);
      onShiftChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al abrir el turno");
    }
  }

  function handleClose() {
    setError(null);
    setSuccess(null);

    if (!currentShift) return;

    try {
      closeShift(currentShift.id);
      setSuccess("Turno cerrado");
      onShiftChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cerrar el turno");
    }
  }

  // Mover hook FUERA del condicional para respetar Rules of Hooks
  const allMovements = useCashClosingStore((s) => s.cashMovements);

  // ── Open state ──
  if (currentShift) {
    const openTime = new Date(currentShift.openTime);
    const movements = allMovements.filter((m) => m.shiftId === currentShift.id);

    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-pos-text uppercase tracking-wide">
          Turno Actual
        </h3>

        <div className="bg-pos-success/10 border border-pos-success/30 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-pos-success">● Abierto</span>
            <span className="text-xs text-pos-muted">
              Desde las {openTime.toLocaleTimeString()}
            </span>
          </div>
          <div className="text-sm text-pos-text">
            <span className="text-pos-muted">Empleado:</span>{" "}
            {currentShift.employee}
          </div>
          <div className="text-sm text-pos-text">
            <span className="text-pos-muted">Apertura:</span>{" "}
            <span className="font-mono">{formatCurrency(currentShift.openingBalance)}</span>
          </div>
          <div className="text-xs text-pos-muted">
            Abierto {openTime.toLocaleDateString()} a las{" "}
            {openTime.toLocaleTimeString()}
          </div>

          {/* Cash movements */}
          {movements.length > 0 && (
            <div className="bg-pos-background/50 rounded-lg p-2.5 space-y-1.5">
              <p className="text-[11px] font-semibold text-pos-muted uppercase tracking-wide">
                Movimientos
              </p>
              {movements.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={`shrink-0 w-1.5 h-1.5 rounded-full ${
                        m.type === "withdrawal"
                          ? "bg-pos-danger"
                          : "bg-pos-success"
                      }`}
                    />
                    <span className="text-pos-muted truncate">
                      {m.reason || (m.type === "withdrawal" ? "Retiro" : "Depósito")}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 font-mono font-medium ${
                      m.type === "withdrawal"
                        ? "text-pos-danger"
                        : "text-pos-success"
                    }`}
                  >
                    {m.type === "withdrawal" ? "−" : "+"}{formatCurrency(m.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="bg-pos-danger/10 border border-pos-danger/30 text-pos-danger text-xs rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-pos-success/10 border border-pos-success/30 text-pos-success text-xs rounded-lg px-3 py-2">
              {success}
            </div>
          )}

          <button
            onClick={handleClose}
            className="w-full px-4 py-2 bg-pos-danger text-white rounded-lg font-medium text-sm touch-target hover:opacity-90 transition-opacity"
          >
            Cerrar Turno
          </button>
        </div>
      </div>
    );
  }

  // ── Closed / no shift state ──
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-pos-text uppercase tracking-wide">
        Abrir Nuevo Turno
      </h3>

      {error && (
        <div className="bg-pos-danger/10 border border-pos-danger/30 text-pos-danger text-sm rounded-lg px-3 py-2">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-pos-success/10 border border-pos-success/30 text-pos-success text-sm rounded-lg px-3 py-2">
          {success}
        </div>
      )}

      <div>
        <label
          htmlFor="shift-employee"
          className="block text-sm font-medium text-pos-text mb-1"
        >
          Nombre del Empleado
        </label>
        <input
          id="shift-employee"
          value={employee}
          onChange={(e) => setEmployee(e.target.value)}
          placeholder="Ej: Juan Pérez"
          className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target"
        />
      </div>

      <div>
        <label
          htmlFor="shift-opening"
          className="block text-sm font-medium text-pos-text mb-1"
        >
          Apertura de Caja ($)
        </label>
        <NumberInput
          id="shift-opening"
          value={openingAmount}
          onChange={setOpeningAmount}
          placeholder="0,00"
          className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm text-right font-mono focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target"
        />
      </div>

      <button
        onClick={handleOpen}
        disabled={!employee.trim()}
        className="w-full px-4 py-2 bg-pos-success text-white rounded-lg font-medium text-sm touch-target hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Abrir Turno
      </button>
    </div>
  );
}
