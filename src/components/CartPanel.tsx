import { useState, useEffect } from "react";
import { useAppStore, usePriceListsStore } from "@/store";
import { useProductsStore } from "@/store/products";
import { useAuthStore } from "@/store/auth";
import { useCashClosingStore } from "@/store/cash-closing";
import { useActiveStore } from "@/store/context";
import CashMovementModal from "@/components/CashMovementModal";
import { formatCurrency } from "@/lib/format";

// ──────────────────────────────────────────────
// Props
// ──────────────────────────────────────────────

type CartPanelProps = {
  onCheckout: () => void;
  onSelectCustomer?: () => void;
  onOpenShift?: () => void;
  onCloseShift?: () => void;
};

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export default function CartPanel({
  onCheckout,
  onSelectCustomer,
  onOpenShift,
  onCloseShift,
}: CartPanelProps) {
  const items = useAppStore((s) => s.items);
  const addItem = useAppStore((s) => s.addItem);
  const updateQuantity = useAppStore((s) => s.updateQuantity);
  const removeItem = useAppStore((s) => s.removeItem);
  const cartTotal = useAppStore((s) => s.cartTotal);
  const itemCount = useAppStore((s) => s.itemCount);
  const selectedCustomer = useAppStore((s) => s.selectedCustomer);
  const selectedCartItemId = useAppStore((s) => s.selectedCartItemId);
  const selectCartItem = useAppStore((s) => s.selectCartItem);
  const clearSelectedCartItem = useAppStore((s) => s.clearSelectedCartItem);
  const currentUser = useAuthStore((s) => s.currentUser);
  const products = useProductsStore((s) => s.products);
  const { storeId } = useActiveStore();
  const shifts = useCashClosingStore((s) => s.shifts);
  const closeShift = useCashClosingStore((s) => s.closeShift);

  const comboInfo = useAppStore((s) => s.getComboInfo());
  const selectedPriceListId = useAppStore((s) => s.selectedPriceListId);
  const priceLists = usePriceListsStore((s) => s.priceLists);
  const activePriceList = selectedPriceListId != null ? priceLists.find((pl) => pl.id === selectedPriceListId) : null;
  const total = cartTotal();
  const rawSubtotal = items.reduce((sum, i) => sum + i.subtotal, 0);
  const count = itemCount();
  const isEmpty = items.length === 0;
  const cashierName = currentUser?.name ?? "—";

  // Live clock
  const [clock, setClock] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const openShift = shifts.find(
    (s) => s.storeId === storeId && s.status === "open",
  ) ?? null;
  const hasOpenShift = openShift !== null;

  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);

  // Returns max quantity available for a product based on stock
  function getMaxQuantity(productId: number): number {
    const product = products.find((p) => p.id === productId);
    if (!product) return Infinity;
    return Math.max(0, product.stock);
  }

  function safeUpdateQuantity(productId: number, qty: number) {
    if (qty <= 0) {
      removeItem(productId);
      return;
    }
    const maxQty = getMaxQuantity(productId);
    if (qty > maxQty) {
      setStockError(productId);
      return;
    }
    updateQuantity(productId, qty);
  }

  const [stockError, setStockErrorState] = useState<number | null>(null);
  const [editingQty, setEditingQty] = useState<Record<number, string>>({});

  function setStockError(productId: number) {
    setStockErrorState(productId);
    setTimeout(() => setStockErrorState(null), 2500);
  }

  function handleCloseShift() {
    setShowCloseModal(true);
  }

  function confirmCloseShift() {
    if (!openShift) return;
    closeShift(openShift.id);
    setShowCloseModal(false);
    onCloseShift?.();
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header — cashier name + clock */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <h2 className="text-sm font-semibold text-pos-text uppercase tracking-wide">
            Cajero: <span className="font-mono normal-case">{cashierName}</span>
          </h2>
          {count > 0 && (
            <p className="text-xs text-pos-muted mt-0.5">
              {items.length} {items.length === 1 ? "producto" : "productos"}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-mono font-bold text-pos-text tabular-nums">
            {clock.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </p>
          <p className="text-[10px] text-pos-muted tabular-nums">
            {clock.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>
      </div>

      {/* Shift status bar */}
      <div className="flex items-center justify-between mb-3 px-2 py-1.5 bg-pos-background/50 rounded-lg text-xs">
        {hasOpenShift ? (
          <>
            <div className="flex items-center gap-2">
              <span className="text-pos-success font-medium">● Abierto</span>
              {openShift!.openingBalance > 0 && (
                <span className="text-pos-muted font-mono">
                  Apert.: {formatCurrency(openShift!.openingBalance)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowMovementModal(true)}
                className="text-pos-accent hover:text-pos-accent/80 touch-target px-2 py-0.5 rounded text-xs font-medium"
              >
                Retirar
              </button>
              <button
                onClick={handleCloseShift}
                className="text-pos-danger hover:text-pos-danger/80 touch-target px-2 py-0.5 rounded"
              >
                Cerrar
              </button>
            </div>
          </>
        ) : (
          <>
            <span className="text-pos-muted">Sin turno abierto</span>
            {onOpenShift && (
              <button
                onClick={onOpenShift}
                className="text-pos-secondary hover:text-pos-secondary/80 touch-target px-2 py-0.5 rounded font-medium"
              >
                Abrir Turno
              </button>
            )}
          </>
        )}
      </div>

      {/* Selected customer */}
      <div className="flex items-center justify-between mb-3 text-sm bg-pos-background/50 rounded-lg px-3 py-2">
        <span className="text-pos-muted">
          Cliente:{" "}
          <span className="font-medium text-pos-text">
            {selectedCustomer?.name ?? "Consumidor Final"}
          </span>
        </span>
        {onSelectCustomer && (
          <button
            onClick={onSelectCustomer}
            className="text-pos-secondary text-xs font-medium touch-target px-2 py-1 rounded hover:bg-pos-secondary/10 transition-colors"
          >
            Cambiar
          </button>
        )}
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {isEmpty ? (
          <div className="flex items-center justify-center h-48">
            <p className="text-sm text-pos-muted italic">
              Carrito vacío. Buscá productos con F2 o escaneá un código de barras.
            </p>
          </div>
        ) : (
          items.map((item, idx) => (
            <div
              key={item.productId}
              onClick={() => selectCartItem(item.productId)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                selectedCartItemId === item.productId
                  ? "border-pos-secondary ring-1 ring-pos-secondary/30"
                  : "border-pos-muted/10 hover:border-pos-muted/30"
              }`}
            >
              {/* Item index */}
              <span className="shrink-0 w-5 text-center text-xs font-mono font-bold text-pos-muted/50">
                {idx + 1}
              </span>

              {/* Thumbnail */}
              <div className="shrink-0 w-7 h-7 rounded-md overflow-hidden bg-pos-muted/10">
                {(() => {
                  const prod = products.find((p) => p.id === item.productId);
                  return prod?.image ? (
                    <img src={prod.image} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-pos-muted/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  );
                })()}
              </div>

              {/* Product name */}
              <span className="flex-1 min-w-0 text-sm font-medium text-pos-text truncate">
                {item.productName}
              </span>

              {/* Price */}
              <span className="shrink-0 text-xs font-mono text-pos-muted tabular-nums min-w-[72px] text-right">
                {formatCurrency(item.unitPrice)}{item.saleUnit !== "unit" ? "/kg" : ""}
              </span>

              {/* Subtotal */}
              <span className="shrink-0 text-sm font-bold font-mono text-pos-text tabular-nums min-w-[70px] text-right">
                {formatCurrency(item.subtotal)}
              </span>

              {/* Quantity / Weight controls */}
              {item.saleUnit === "unit" ? (
                /* ── Unit controls (current) ── */
                <div className="shrink-0 flex items-center gap-0.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      safeUpdateQuantity(item.productId, item.quantity - 1);
                      setEditingQty((prev) => {
                        const next = { ...prev };
                        delete next[item.productId];
                        return next;
                      });
                    }}
                    className="w-7 h-7 flex items-center justify-center bg-pos-background border border-pos-muted/20 rounded-md text-pos-text font-bold text-base touch-target hover:bg-pos-muted/10 transition-colors"
                    aria-label={`Disminuir cantidad de ${item.productName}`}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={getMaxQuantity(item.productId)}
                    value={editingQty[item.productId] ?? String(item.quantity)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === "" || /^\d+$/.test(raw)) {
                        setEditingQty((prev) => ({
                          ...prev,
                          [item.productId]: raw,
                        }));
                      }
                    }}
                    onBlur={() => {
                      const raw = editingQty[item.productId];
                      if (raw !== undefined) {
                        const val = parseInt(raw, 10);
                        if (!isNaN(val)) {
                          if (val <= 0) {
                            removeItem(item.productId);
                          } else {
                            safeUpdateQuantity(item.productId, val);
                          }
                        }
                        setEditingQty((prev) => {
                          const next = { ...prev };
                          delete next[item.productId];
                          return next;
                        });
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        (e.target as HTMLInputElement).blur();
                      } else if (e.key === "Escape") {
                        setEditingQty((prev) => {
                          const next = { ...prev };
                          delete next[item.productId];
                          return next;
                        });
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        const step = e.shiftKey ? 10 : 1;
                        const newQty = item.quantity + step;
                        safeUpdateQuantity(item.productId, newQty);
                        setEditingQty((prev) => {
                          const next = { ...prev };
                          delete next[item.productId];
                          return next;
                        });
                      } else if (e.key === "ArrowDown") {
                        e.preventDefault();
                        const step = e.shiftKey ? 10 : 1;
                        const newQty = item.quantity - step;
                        if (newQty <= 0) {
                          removeItem(item.productId);
                        } else {
                          safeUpdateQuantity(item.productId, newQty);
                        }
                        setEditingQty((prev) => {
                          const next = { ...prev };
                          delete next[item.productId];
                          return next;
                        });
                      }
                    }}
                    className="w-10 text-center text-xs font-bold font-mono text-pos-text bg-pos-background border border-pos-muted/20 rounded-md px-0.5 py-1 focus:outline-none focus:ring-2 focus:ring-pos-secondary [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    aria-label={`Cantidad de ${item.productName}`}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      safeUpdateQuantity(item.productId, item.quantity + 1);
                      setEditingQty((prev) => {
                        const next = { ...prev };
                        delete next[item.productId];
                        return next;
                      });
                    }}
                    className="w-7 h-7 flex items-center justify-center bg-pos-background border border-pos-muted/20 rounded-md text-pos-text font-bold text-base touch-target hover:bg-pos-muted/10 transition-colors"
                    aria-label={`Aumentar cantidad de ${item.productName}`}
                  >
                    +
                  </button>
                </div>
              ) : (
                /* ── Weight controls (gramos) ── */
                <div className="shrink-0 flex items-center gap-0.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      safeUpdateQuantity(item.productId, item.quantity - 100);
                      setEditingQty((prev) => {
                        const next = { ...prev };
                        delete next[item.productId];
                        return next;
                      });
                    }}
                    className="w-7 h-7 flex items-center justify-center bg-pos-background border border-pos-muted/20 rounded-md text-pos-text font-bold text-xs touch-target hover:bg-pos-muted/10 transition-colors"
                    aria-label={`Disminuir 100g de ${item.productName}`}
                    title="-100g"
                  >
                    −100
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      safeUpdateQuantity(item.productId, item.quantity - 10);
                      setEditingQty((prev) => {
                        const next = { ...prev };
                        delete next[item.productId];
                        return next;
                      });
                    }}
                    className="w-7 h-7 flex items-center justify-center bg-pos-background border border-pos-muted/20 rounded-md text-pos-text font-bold text-sm touch-target hover:bg-pos-muted/10 transition-colors"
                    aria-label={`Disminuir 10g de ${item.productName}`}
                    title="-10g"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    step="0.001"
                    min={0.01}
                    value={
                      editingQty[item.productId] ??
                      (item.quantity >= 1000
                        ? (item.quantity / 1000).toFixed(3)
                        : (item.quantity / 1000).toFixed(3))
                    }
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      setEditingQty((prev) => ({
                        ...prev,
                        [item.productId]: e.target.value,
                      }));
                    }}
                    onBlur={() => {
                      const raw = editingQty[item.productId];
                      if (raw !== undefined) {
                        const kgVal = parseFloat(raw);
                        if (!isNaN(kgVal) && kgVal > 0) {
                          const grams = Math.round(kgVal * 1000);
                          safeUpdateQuantity(item.productId, grams);
                        } else if (kgVal <= 0) {
                          removeItem(item.productId);
                        }
                        setEditingQty((prev) => {
                          const next = { ...prev };
                          delete next[item.productId];
                          return next;
                        });
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        (e.target as HTMLInputElement).blur();
                      } else if (e.key === "Escape") {
                        setEditingQty((prev) => {
                          const next = { ...prev };
                          delete next[item.productId];
                          return next;
                        });
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        const step = e.shiftKey ? 100 : 10;
                        safeUpdateQuantity(item.productId, item.quantity + step);
                        setEditingQty((prev) => {
                          const next = { ...prev };
                          delete next[item.productId];
                          return next;
                        });
                      } else if (e.key === "ArrowDown") {
                        e.preventDefault();
                        const step = e.shiftKey ? 100 : 10;
                        const newQty = item.quantity - step;
                        if (newQty < 10) {
                          removeItem(item.productId);
                        } else {
                          safeUpdateQuantity(item.productId, newQty);
                        }
                        setEditingQty((prev) => {
                          const next = { ...prev };
                          delete next[item.productId];
                          return next;
                        });
                      }
                    }}
                    className="w-14 text-center text-xs font-bold font-mono text-pos-text bg-pos-background border border-pos-muted/20 rounded-md px-0.5 py-1 focus:outline-none focus:ring-2 focus:ring-pos-secondary [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    aria-label={`Peso en kg de ${item.productName}`}
                  />
                  <span className="text-[10px] text-pos-muted font-mono w-5">
                    kg
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      safeUpdateQuantity(item.productId, item.quantity + 10);
                      setEditingQty((prev) => {
                        const next = { ...prev };
                        delete next[item.productId];
                        return next;
                      });
                    }}
                    className="w-7 h-7 flex items-center justify-center bg-pos-background border border-pos-muted/20 rounded-md text-pos-text font-bold text-sm touch-target hover:bg-pos-muted/10 transition-colors"
                    aria-label={`Aumentar 10g de ${item.productName}`}
                    title="+10g"
                  >
                    +
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      safeUpdateQuantity(item.productId, item.quantity + 100);
                      setEditingQty((prev) => {
                        const next = { ...prev };
                        delete next[item.productId];
                        return next;
                      });
                    }}
                    className="w-7 h-7 flex items-center justify-center bg-pos-background border border-pos-muted/20 rounded-md text-pos-text font-bold text-xs touch-target hover:bg-pos-muted/10 transition-colors"
                    aria-label={`Aumentar 100g de ${item.productName}`}
                    title="+100g"
                  >
                    +100
                  </button>
                </div>
              )}

              {/* Stock warning */}
              {stockError === item.productId && (
                <span className="shrink-0 text-[10px] text-pos-danger font-medium">
                  Stock insuf.
                </span>
              )}

              {/* Remove */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeItem(item.productId);
                }}
                className="shrink-0 w-6 h-6 flex items-center justify-center text-pos-muted/40 hover:text-pos-danger touch-target rounded-md hover:bg-pos-danger/10 transition-colors"
                aria-label={`Eliminar ${item.productName} del carrito`}
              >
                ✕
              </button>
            </div>
          )))}
      </div>

      {/* Totals + checkout */}
      {!isEmpty && (
        <div className="mt-3 pt-3 border-t border-pos-muted/20 space-y-3">
          {/* Subtotal line */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="text-pos-muted">Subtotal</span>
              {activePriceList && (
                <span className="inline-flex items-center gap-1 rounded-md bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-600 dark:bg-violet-500/20 dark:text-violet-400">
                  {activePriceList.name}
                </span>
              )}
            </div>
            <span className="font-mono font-medium">{formatCurrency(rawSubtotal)}</span>
          </div>

          {/* Combo savings */}
          {comboInfo && comboInfo.combos.length > 0 && (
            <div className="space-y-0.5">
              {comboInfo.combos.map((c) => (
                <div key={c.comboId} className="flex items-center justify-between text-xs">
                  <span className="text-emerald-600 font-medium">
                    {c.times > 1 ? `${c.times}x ` : ""}Combo: {c.name}
                  </span>
                  <span className="text-emerald-600 font-mono">−{formatCurrency(c.totalSavings)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Bulto savings */}
          {comboInfo && comboInfo.bultos && comboInfo.bultos.length > 0 && (
            <div className="space-y-0.5">
              {comboInfo.bultos.map((b) => (
                <div key={b.bultoId} className="flex items-center justify-between text-xs">
                  <span className="text-cyan-600 font-medium">
                    {b.times > 1 ? `${b.times}x ` : ""}Bulto: {b.name}
                  </span>
                  <span className="text-cyan-600 font-mono">−{formatCurrency(b.totalSavings)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Tax (placeholder — 0% for now) */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-pos-muted">Impuesto</span>
            <span className="font-mono font-medium">$0.00</span>
          </div>

          {/* Total */}
          <div className="flex items-center justify-between text-base font-bold">
            <span className="text-pos-text">Total</span>
            <span className="font-mono text-pos-secondary text-lg">
              {formatCurrency(total)}
            </span>
          </div>

          {/* Checkout button */}
          <button
            onClick={onCheckout}
            className="w-full py-3 bg-pos-accent text-white rounded-xl font-bold text-base touch-target hover:opacity-90 transition-opacity active:scale-[0.98]"
          >
            Cobrar — {formatCurrency(total)}
          </button>
        </div>
      )}

      {/* ── Shift Close Confirmation Modal ── */}
      {showCloseModal && openShift && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-pos-surface rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="text-5xl mb-4">🔒</div>
            <h3 className="text-base font-semibold text-pos-text mb-2">
              Cerrar Turno
            </h3>
            <p className="text-sm text-pos-muted mb-6">
              ¿Está seguro de cerrar el turno de <strong>{openShift.employee}</strong>?
              <br />
              No podrá registrar más ventas hasta abrir uno nuevo.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowCloseModal(false)}
                className="px-5 py-2.5 text-sm text-pos-text border border-pos-muted/30 rounded-xl touch-target hover:bg-pos-background/50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmCloseShift}
                className="px-5 py-2.5 text-sm bg-pos-danger text-white rounded-xl font-medium touch-target hover:opacity-90"
              >
                Cerrar Turno
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cash Movement Modal ── */}
      {showMovementModal && openShift && (
        <CashMovementModal
          shiftId={openShift.id}
          storeId={storeId}
          onClose={() => setShowMovementModal(false)}
          onComplete={() => {
            setShowMovementModal(false);
          }}
        />
      )}
    </div>
  );
}
