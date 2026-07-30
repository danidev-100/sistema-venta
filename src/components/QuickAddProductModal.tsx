import { useState, useEffect, useRef } from "react";
import { useProductsStore } from "@/store/products";
import { useActiveStore } from "@/store/context";

// ──────────────────────────────────────────────
// Props
// ──────────────────────────────────────────────

type QuickAddProductModalProps = {
  initialName?: string;
  initialBarcode?: string;
  onClose: () => void;
  onConfirm: (product: { id: number; name: string; price: number }) => void;
};

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export default function QuickAddProductModal({
  initialName = "",
  initialBarcode = "",
  onClose,
  onConfirm,
}: QuickAddProductModalProps) {
  const { storeId } = useActiveStore();
  const addProduct = useProductsStore((s) => s.addProduct);

  const [name, setName] = useState(initialName);
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("1");
  const [barcode, setBarcode] = useState(initialBarcode);
  const [error, setError] = useState("");
  const [animOut, setAnimOut] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);

  // Auto-focus name input on mount
  useEffect(() => {
    requestAnimationFrame(() => nameRef.current?.focus());
  }, []);

  // ── Submit ──

  async function handleSubmit() {
    setError("");

    if (!name.trim()) {
      setError("El nombre del producto es obligatorio");
      nameRef.current?.focus();
      return;
    }

    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      setError("Precio inválido — ingresá un número mayor a 0");
      return;
    }

    const parsedStock = parseInt(stock, 10);
    if (isNaN(parsedStock) || parsedStock < 0) {
      setError("Cantidad inválida");
      return;
    }

    try {
      const product = await addProduct({
        name: name.trim(),
        price: parsedPrice,
        stock: parsedStock,
        barcode: barcode.trim() || null,
        category_id: null,
        store_id: storeId,
      });
      onConfirm({ id: product.id, name: product.name, price: product.price });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al crear el producto");
    }
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
        <h2 className="text-lg font-bold text-pos-text mb-1">
          Agregar producto rápido
        </h2>
        <p className="text-xs text-pos-muted/60 mb-5">
          El producto se agrega al listado y queda en el carrito
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
              placeholder="Ej: Alfajor Jorgito"
              className="w-full border border-pos-muted/25 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-pos-secondary bg-pos-background transition-shadow"
            />
          </div>

          {/* Price + Stock inline */}
          <div className="flex gap-3">
            <div className="flex-1">
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
            <div className="w-24">
              <label className="block text-xs font-medium text-pos-muted mb-1">
                Cantidad
              </label>
              <input
                type="number"
                value={stock}
                onChange={(e) => {
                  setStock(e.target.value);
                  setError("");
                }}
                placeholder="1"
                min="0"
                className="w-full border border-pos-muted/25 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-pos-secondary bg-pos-background transition-shadow [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          </div>

          {/* Barcode (optional) */}
          <div>
            <label className="block text-xs font-medium text-pos-muted mb-1">
              Código de barras{" "}
              <span className="text-pos-muted/40">(opcional)</span>
            </label>
            <input
              type="text"
              value={barcode}
              onChange={(e) => {
                setBarcode(e.target.value);
                setError("");
              }}
              placeholder="Ej: 77912345678"
              className="w-full border border-pos-muted/25 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-pos-secondary bg-pos-background transition-shadow"
            />
          </div>
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
