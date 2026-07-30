import { useState } from "react";
import { useCashClosingStore } from "@/store/cash-closing";
import { useActiveStore } from "@/store/context";
import NumberInput from "@/components/NumberInput";

type OpenShiftModalProps = {
  employeeName: string;
  onClose: () => void;
  onOpened: () => void;
};

export default function OpenShiftModal({
  employeeName,
  onClose,
  onOpened,
}: OpenShiftModalProps) {
  const { storeId } = useActiveStore();
  const openShift = useCashClosingStore((s) => s.openShift);

  const [openingAmount, setOpeningAmount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function handleOpen() {
    setError(null);
    setSaving(true);

    const balance = openingAmount;

    try {
      openShift(employeeName, storeId, balance);
      onOpened();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al abrir el turno",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-pos-surface rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4">
        <h2 className="text-lg font-bold text-pos-text text-center">
          Apertura de Caja
        </h2>

        <p className="text-sm text-pos-muted text-center">
          Turno para <span className="font-semibold text-pos-text">{employeeName}</span>
        </p>

        {error && (
          <div className="bg-pos-danger/10 border border-pos-danger/30 text-pos-danger text-sm rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div>
          <label
            htmlFor="modal-opening"
            className="block text-sm font-medium text-pos-text mb-1"
          >
            Dinero Inicial en Caja ($)
          </label>
          <NumberInput
            value={openingAmount}
            onChange={setOpeningAmount}
            placeholder="0,00"
            autoFocus
            className="w-full border border-pos-muted/30 rounded-lg px-3 py-3 text-2xl text-right font-mono focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 px-4 py-3 border border-pos-muted/30 text-pos-text rounded-xl font-medium text-sm touch-target hover:bg-pos-background transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleOpen}
            disabled={saving}
            className="flex-1 px-4 py-3 bg-pos-success text-white rounded-xl font-bold text-sm touch-target hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? "Abriendo…" : "Abrir Turno"}
          </button>
        </div>
      </div>
    </div>
  );
}
