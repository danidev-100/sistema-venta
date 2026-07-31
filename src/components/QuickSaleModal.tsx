import { useState, useEffect, useRef } from "react";

// ──────────────────────────────────────────────
// Free-sale synthetic ids
// ──────────────────────────────────────────────
// Free-sale items carry a negative product id so checkout/refund can tell them
// apart from real products (and skip stock movements). The id MUST fit a
// PostgreSQL `integer` (int4: -2147483648..2147483647). A timestamp is way out
// of that range, so we use a per-session decrementing counter instead.
let freeSaleIdCounter = 0;

function nextFreeSaleId(): number {
  freeSaleIdCounter -= 1;
  return freeSaleIdCounter;
}

// ──────────────────────────────────────────────
// Props
// ──────────────────────────────────────────────

type QuickSaleModalProps = {
  initialName?: string;
  /** Scanned barcode, shown as reference only — NOT persisted as a product. */
  initialBarcode?: string;
  onClose: () => void;
  onConfirm: (sale: { id: number; name: string; price: number }) => void;
};

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export default function QuickSaleModal({
  initialName = "",
  initialBarcode = "",
  onClose,
  onConfirm,
}: QuickSaleModalProps) {
  const [name, setName] = useState(initialName);
  const [price, setPrice] = useState("");
  const [error, setError] = useState("");
  const [animOut, setAnimOut] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);

  // Auto-focus name input on mount
  useEffect(() => {
    requestAnimationFrame(() => nameRef.current?.focus());
  }, []);

  // ── Submit ──

  function handleSubmit() {
    setError("");

    if (!name.trim()) {
      setError("El nombre es obligatorio");
      nameRef.current?.focus();
      return;
    }

    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      setError("Precio inválido — ingrese un número mayor a 0");
      return;
    }

    // Negative synthetic id: marks this cart item as a free sale with no real
    // product behind it, so checkout/refund skip any stock movement for it.
    // Decrementing counter keeps it unique per session AND inside int4 range.
    const freeId = nextFreeSaleId();
    onConfirm({ id: freeId, name: name.trim(), price: parsedPrice });
  }

  // ── Animations ──

  function closeWithAnim() {
    setAnimOut(true);
    setTimeout(onClose, 150);
  }

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) closeWithAnim();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      closeWithAnim();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  // ── Render ──

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
    >
      <div
        className={`w-full max-w-sm mx-4 bg-pos-surface rounded-2xl shadow-2xl border border-pos-muted/10 p-6 transition-all duration-150 ${
          animOut ? "opacity-0 scale-95" : "opacity-100 scale-100"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <h2 className="text-lg font-bold text-pos-text mb-1">Venta libre</h2>
        <p className="text-xs text-pos-muted/60 mb-5">
          Se agrega al carrito sin registrarse en el catálogo ni afectar el
          stock
        </p>

        {/* ── Error ── */}
        {error && (
          <div className="mb-4 p-2.5 rounded-lg bg-pos-danger/10 border border-pos-danger/20 text-xs text-pos-danger font-medium">
            {error}
          </div>
        )}

        {/* ── Fields ── */}
        <div className="space-y-3.5">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-pos-muted mb-1">
              Nombre <span className="text-pos-danger">*</span>
            </label>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              placeholder="Ej: Producto sin registrar"
              className="w-full border border-pos-muted/25 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-pos-secondary bg-pos-background transition-shadow"
            />
          </div>

          {/* Price */}
          <div>
            <label className="block text-xs font-medium text-pos-muted mb-1">
              Precio <span className="text-pos-danger">*</span>
            </label>
            <input
              type="number"
              value={price}
              onChange={(e) => {
                setPrice(e.target.value);
                setError("");
              }}
              placeholder="0.00"
              min="0"
              step="0.01"
              className="w-full border border-pos-muted/25 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-pos-secondary bg-pos-background transition-shadow [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>

          {/* Barcode (reference only — not saved) */}
          {initialBarcode && (
            <div className="flex items-center justify-between rounded-xl bg-pos-background border border-pos-muted/20 px-3.5 py-2.5">
              <span className="text-xs text-pos-muted">Código escaneado</span>
              <span className="text-xs font-mono text-pos-text tabular-nums">
                {initialBarcode}
              </span>
            </div>
          )}
        </div>

        {/* ── Actions ── */}
        <div className="flex gap-2.5 mt-6">
          <button
            onClick={closeWithAnim}
            className="flex-1 px-4 py-3 border border-pos-muted/20 text-pos-muted rounded-xl font-medium text-sm touch-target hover:bg-pos-background/50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 px-4 py-3 bg-pos-secondary text-white rounded-xl font-medium text-sm touch-target hover:opacity-90 transition-opacity"
          >
            Agregar y vender
          </button>
        </div>

        {/* ── Keyboard hint ── */}
        <p className="text-[10px] text-pos-muted/30 text-center mt-3">
          Enter para confirmar &middot; Esc para cancelar
        </p>
      </div>
    </div>
  );
}
