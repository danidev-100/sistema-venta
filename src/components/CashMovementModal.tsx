import { useState, useEffect, useRef, useMemo } from "react";
import {
  useCashClosingStore,
  type CashMovementMethod,
} from "@/store/cash-closing";
import { useAuthStore } from "@/store/auth";
import { useAppStore } from "@/store";
import { formatCurrency } from "@/lib/format";
import NumberInput from "@/components/NumberInput";

// ──────────────────────────────────────────────
// Props
// ──────────────────────────────────────────────

type CashMovementModalProps = {
  shiftId: number;
  storeId: string;
  onClose: () => void;
  onComplete: () => void;
};

const METHODS: { value: CashMovementMethod; label: string; icon: string }[] = [
  { value: "cash", label: "Efectivo", icon: "💵" },
  { value: "card", label: "Tarjeta", icon: "💳" },
  { value: "transfer", label: "Transferencia", icon: "🏦" },
  { value: "other", label: "Otro", icon: "📄" },
];

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export default function CashMovementModal({
  shiftId,
  storeId,
  onClose,
  onComplete,
}: CashMovementModalProps) {
  const recordCashMovement = useCashClosingStore((s) => s.recordCashMovement);
  const currentUser = useAuthStore((s) => s.currentUser);
  const shifts = useCashClosingStore((s) => s.shifts);
  const cashMovements = useCashClosingStore((s) => s.cashMovements);
  const completedSales = useAppStore((s) => s.completedSales);

  const shift = shifts.find((s) => s.id === shiftId);
  const openTime = shift ? new Date(shift.openTime).getTime() : 0;

  const availableCash = useMemo(() => {
    if (!shift) return 0;
    const cashFromSales = completedSales
      .filter((s) => {
        const t = new Date(s.date).getTime();
        return (
          t >= openTime &&
          (s.paymentMethod === "cash" || s.paymentMethod === "mixed")
        );
      })
      .reduce(
        (sum, s) =>
          sum + (s.paymentMethod === "mixed" ? s.cashAmount ?? 0 : s.total),
        0,
      );
    const withdrawalTotal = cashMovements
      .filter(
        (m) =>
          m.shiftId === shiftId &&
          m.type === "withdrawal" &&
          m.method === "cash",
      )
      .reduce((sum, m) => sum + m.amount, 0);
    const depositTotal = cashMovements
      .filter(
        (m) =>
          m.shiftId === shiftId &&
          m.type === "deposit" &&
          m.method === "cash",
      )
      .reduce((sum, m) => sum + m.amount, 0);
    return Math.max(
      0,
      shift.openingBalance + cashFromSales - withdrawalTotal + depositTotal,
    );
  }, [shift, completedSales, cashMovements, shiftId, openTime]);

  const [type, setType] = useState<"withdrawal" | "deposit">("withdrawal");
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<CashMovementMethod>("cash");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [animOut, setAnimOut] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeWithAnim();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function closeWithAnim() {
    setAnimOut(true);
    setTimeout(onClose, 150);
  }

  function handleSubmit() {
    setError(null);
    const num = amount;
    if (num <= 0) {
      setError("Ingresá un monto válido mayor a 0");
      return;
    }
    if (type === "withdrawal" && method === "cash" && num > availableCash) {
      setError(
        `Solo podés retirar hasta ${formatCurrency(availableCash)}.`,
      );
      return;
    }
    try {
      recordCashMovement(
        shiftId,
        type,
        num,
        reason.trim(),
        currentUser?.name ?? "Cajero",
        storeId,
        method,
      );
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar");
    }
  }

  const isCashWithdrawal =
    type === "withdrawal" && method === "cash";
  const exceedsLimit =
    isCashWithdrawal && amount > availableCash;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={closeWithAnim}
    >
      <div
        className={`w-full max-w-sm bg-pos-surface rounded-2xl shadow-2xl border border-pos-muted/10 mx-4 overflow-hidden transition-all duration-150 ${
          animOut
            ? "opacity-0 scale-95"
            : "opacity-100 scale-100"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header with icon ── */}
        <div className="relative p-5 pb-4 border-b border-pos-muted/10 text-center">
          <div className="text-4xl mb-2">
            {type === "withdrawal" ? "💰" : "📥"}
          </div>
          <h3 className="text-base font-bold text-pos-text">
            {type === "withdrawal" ? "Retirar Dinero" : "Depositar Dinero"}
          </h3>
          <p className="text-xs text-pos-muted/60 mt-0.5">
            Movimiento registrado por{" "}
            <span className="font-medium text-pos-text">
              {currentUser?.name ?? "Cajero"}
            </span>
          </p>
          <button
            onClick={closeWithAnim}
            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center text-pos-muted/50 hover:text-pos-text rounded-lg hover:bg-pos-background/50 transition-colors touch-target"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* ── Type toggle ── */}
          <div className="flex rounded-xl overflow-hidden border border-pos-muted/20 p-0.5 bg-pos-background/30">
            <button
              onClick={() => setType("withdrawal")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium rounded-lg touch-target transition-all ${
                type === "withdrawal"
                  ? "bg-pos-danger text-white shadow-sm"
                  : "text-pos-muted hover:text-pos-text"
              }`}
            >
              <span>💰</span> Retiro
            </button>
            <button
              onClick={() => setType("deposit")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium rounded-lg touch-target transition-all ${
                type === "deposit"
                  ? "bg-pos-success text-white shadow-sm"
                  : "text-pos-muted hover:text-pos-text"
              }`}
            >
              <span>📥</span> Depósito
            </button>
          </div>

          {/* ── Payment method ── */}
          <div>
            <label className="block text-xs font-semibold text-pos-muted uppercase tracking-wide mb-2">
              Medio de pago
            </label>
            <div className="grid grid-cols-4 gap-2">
              {METHODS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setMethod(m.value)}
                  className={`flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-medium touch-target transition-all ${
                    method === m.value
                      ? "bg-pos-secondary text-white ring-2 ring-pos-secondary/30 scale-[1.02]"
                      : "bg-pos-background/50 text-pos-muted border border-pos-muted/15 hover:border-pos-secondary/40 hover:text-pos-text"
                  }`}
                >
                  <span className="text-base">{m.icon}</span>
                  <span>{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Amount ── */}
          <div>
            <label className="block text-xs font-semibold text-pos-muted uppercase tracking-wide mb-1.5">
              Monto
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-pos-muted/40">
                $
              </span>
              <NumberInput
                ref={inputRef}
                value={amount}
                onChange={setAmount}
                placeholder="0,00"
                className={`w-full border rounded-xl pl-8 pr-4 py-3 text-xl text-right font-mono focus:outline-none focus:ring-2 touch-target bg-pos-background transition-colors ${
                  exceedsLimit
                    ? "border-pos-danger/50 focus:ring-pos-danger"
                    : "border-pos-muted/30 focus:ring-pos-secondary"
                }`}
              />
            </div>
            {isCashWithdrawal && (
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-xs text-pos-muted/60">
                  Disponible en caja
                </span>
                <span className="text-xs font-mono font-semibold tabular-nums text-pos-text">
                  {formatCurrency(availableCash)}
                </span>
              </div>
            )}
          </div>

          {/* ── Reason ── */}
          <div>
            <label className="block text-xs font-semibold text-pos-muted uppercase tracking-wide mb-1.5">
              Motivo{" "}
              <span className="font-normal normal-case text-pos-muted/50">
                (opcional)
              </span>
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                type === "withdrawal"
                  ? "Ej: Pago a proveedor"
                  : "Ej: Cambio para la caja"
              }
              className="w-full border border-pos-muted/30 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target bg-pos-background"
            />
          </div>

          {/* ── Error ── */}
          {error && (
            <div className="flex items-start gap-2.5 bg-pos-danger/8 border border-pos-danger/25 text-pos-danger text-sm rounded-xl px-4 py-3">
              <span className="text-base shrink-0 mt-0.5">⚠️</span>
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="p-5 pt-4 border-t border-pos-muted/10 flex gap-3">
          <button
            onClick={closeWithAnim}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-pos-muted border border-pos-muted/20 rounded-xl touch-target hover:bg-pos-background/50 hover:text-pos-text transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!amount || exceedsLimit}
            className={`flex-1 px-4 py-2.5 text-sm font-bold text-white rounded-xl touch-target transition-all hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none ${
              type === "withdrawal"
                ? "bg-pos-danger hover:bg-pos-danger/90"
                : "bg-pos-success hover:bg-pos-success/90"
            }`}
          >
            {type === "withdrawal" ? "Retirar" : "Depositar"}
          </button>
        </div>
      </div>
    </div>
  );
}
