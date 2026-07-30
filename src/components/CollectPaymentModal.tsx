import { useState } from "react";
import { useCustomersStore, type Customer } from "@/store/customers";
import { useActiveStore } from "@/store/context";
import { formatCurrency } from "@/lib/format";
import NumberInput from "@/components/NumberInput";

type CollectPaymentModalProps = {
  customer: Customer;
  onClose: () => void;
  onCollected: () => void;
};

export default function CollectPaymentModal({
  customer,
  onClose,
  onCollected,
}: CollectPaymentModalProps) {
  const { storeId } = useActiveStore();
  const updateCreditBalance = useCustomersStore((s) => s.updateCreditBalance);

  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const parsedAmount = parseFloat(amount) || 0;
  const remaining = Math.round((customer.creditBalance - parsedAmount) * 100) / 100;

  function handleSubmit() {
    setError(null);

    if (parsedAmount <= 0) {
      setError("Ingresá un monto válido");
      return;
    }

    if (parsedAmount > customer.creditBalance) {
      setError(`El cliente debe ${formatCurrency(customer.creditBalance)}. No podés cobrar más que eso.`);
      return;
    }

    setBusy(true);
    try {
      updateCreditBalance(customer.id, -parsedAmount, storeId, `Cobro de cuenta corriente`);
      onCollected();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar el cobro");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-pos-surface rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4">
        <h2 className="text-lg font-bold text-pos-text">Cobrar a {customer.name}</h2>

        {error && (
          <div className="bg-pos-danger/10 border border-pos-danger/30 text-pos-danger text-sm rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="bg-pos-background/50 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-pos-muted">Saldo actual</span>
            <span className="font-mono font-bold text-pos-danger">{formatCurrency(customer.creditBalance)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-pos-muted">A cobrar</span>
            <span className="font-mono font-bold text-pos-success">−{formatCurrency(parsedAmount)}</span>
          </div>
          <hr className="border-pos-muted/20" />
          <div className="flex items-center justify-between font-semibold">
            <span className="text-sm">Saldo restante</span>
            <span className={`font-mono ${remaining > 0 ? "text-pos-danger" : "text-pos-success"}`}>
              {formatCurrency(remaining)}
            </span>
          </div>
        </div>

        <div>
          <label htmlFor="collect-amount" className="block text-sm font-medium text-pos-text mb-1">
            Monto a cobrar
          </label>
          <NumberInput
            id="collect-amount"
            value={parseFloat(amount) || 0}
            onChange={(n) => setAmount(n.toString())}
            placeholder="0,00"
            autoFocus
            className="w-full border border-pos-muted/30 rounded-xl px-4 py-3 text-lg font-mono text-center focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target bg-pos-surface"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            disabled={busy}
            className="flex-1 px-4 py-3 border border-pos-muted/30 text-pos-text rounded-xl font-medium text-sm touch-target hover:bg-pos-background transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={busy || parsedAmount <= 0}
            className="flex-1 px-4 py-3 bg-pos-success text-white rounded-xl font-bold text-sm touch-target hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {busy ? "Guardando…" : `Cobrar ${formatCurrency(parsedAmount)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
