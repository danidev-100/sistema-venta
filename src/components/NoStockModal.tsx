type NoStockModalProps = {
  productName: string;
  onClose: () => void;
};

export default function NoStockModal({ productName, onClose }: NoStockModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-pos-surface rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 text-center space-y-4">
        <div className="text-5xl">⛔</div>
        <h2 className="text-lg font-bold text-pos-text">Sin Stock</h2>
        <p className="text-sm text-pos-muted">
          <span className="font-semibold text-pos-text">{productName}</span> no tiene stock disponible.
        </p>
        <button
          onClick={onClose}
          className="w-full px-4 py-3 bg-pos-secondary text-white rounded-xl font-medium text-sm touch-target hover:opacity-90 transition-opacity"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
