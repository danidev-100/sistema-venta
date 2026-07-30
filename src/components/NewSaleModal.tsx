// ──────────────────────────────────────────────
// NewSaleModal — confirmation before clearing cart
// ──────────────────────────────────────────────

type NewSaleModalProps = {
  itemCount: number;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function NewSaleModal({
  itemCount,
  onConfirm,
  onCancel,
}: NewSaleModalProps) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-pos-surface rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
        <div className="text-5xl mb-4">🛒</div>
        <h3 className="text-base font-semibold text-pos-text mb-2">
          Nueva Venta
        </h3>
        <p className="text-sm text-pos-muted mb-6">
          ¿Iniciar una nueva venta?
          <br />
          Se borrará el carrito actual con{" "}
          <strong>
            {itemCount} {itemCount === 1 ? "producto" : "productos"}
          </strong>
          .
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={onCancel}
            className="px-5 py-2.5 text-sm text-pos-text border border-pos-muted/30 rounded-xl touch-target hover:bg-pos-background/50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="px-5 py-2.5 text-sm bg-pos-danger text-white rounded-xl font-medium touch-target hover:opacity-90 transition-opacity"
          >
            Nueva Venta
          </button>
        </div>
      </div>
    </div>
  );
}
