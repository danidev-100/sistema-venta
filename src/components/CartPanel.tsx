import { useState, useEffect } from "react";
import { useAppStore, usePriceListsStore } from "@/store";
import { useProductsStore } from "@/store/products";
import { useAuthStore } from "@/store/auth";
import { useCashClosingStore } from "@/store/cash-closing";
import { useCompanyStore } from "@/store/company";
import { useActiveStore } from "@/store/context";
import { computeIva } from "@/lib/iva";
import CashMovementModal from "@/components/CashMovementModal";
import ProductImage from "@/components/ProductImage";
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
  const companyData = useCompanyStore((s) => s.data);
  const companyLoaded = useCompanyStore((s) => s.loaded);
  const loadCompany = useCompanyStore((s) => s.loadCompany);
  const shifts = useCashClosingStore((s) => s.shifts);
  const closeShift = useCashClosingStore((s) => s.closeShift);

  useEffect(() => {
    if (!companyLoaded) loadCompany(storeId).catch(console.error);
  }, [storeId, companyLoaded, loadCompany]);

  const comboInfo = useAppStore((s) => s.getComboInfo());
  const selectedPriceListId = useAppStore((s) => s.selectedPriceListId);
  const priceLists = usePriceListsStore((s) => s.priceLists);
  const activePriceList = selectedPriceListId != null ? priceLists.find((pl) => pl.id === selectedPriceListId) : null;
  const net = cartTotal();
  const ivaInfo = computeIva(net, companyData?.iva_alicuota ?? 0, companyData?.iva_incluido === 1);
  const total = ivaInfo.total;
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
    // Free-sale items have no catalog product, so no stock cap applies.
    if (!product) return 99999;
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

  function handleClearCart() {
    if (isEmpty) return;
    if (window.confirm("¿Vaciar el carrito? Se quitarán todos los productos cargados.")) {
      useAppStore.getState().clearCart();
      setEditingQty({});
    }
  }

  function confirmCloseShift() {
    if (!openShift) return;
    closeShift(openShift.id);
    setShowCloseModal(false);
    onCloseShift?.();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header — title, item count, clear */}
      <div className="flex shrink-0 items-center gap-2 border-b border-pos-muted/10 px-4 pb-3 pt-4">
        <h2 className="text-[14.5px] font-semibold text-pos-text">Venta actual</h2>
        <span className="rounded-pill bg-pos-secondary/10 px-2 py-0.5 text-[11px] font-semibold text-pos-secondary">
          {count} {count === 1 ? "producto" : "productos"}
        </span>
        <button
          type="button"
          onClick={handleClearCart}
          disabled={isEmpty}
          className="ml-auto rounded-control px-2 py-1.5 text-xs font-medium text-pos-muted transition-colors touch-target hover:bg-pos-danger/10 hover:text-pos-danger disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-pos-muted"
        >
          Vaciar
        </button>
      </div>

      {/* Cashier + clock */}
      <div className="flex shrink-0 items-start justify-between gap-2 px-4 pt-3">
        <h3 className="min-w-0 truncate text-sm font-semibold text-pos-text">
          Cajero: <span className="font-mono font-normal">{cashierName}</span>
        </h3>
        <div className="shrink-0 text-right">
          <p className="font-mono text-sm font-bold tabular-nums text-pos-text">
            {clock.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </p>
          <p className="text-[10px] tabular-nums text-pos-muted">
            {clock.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>
      </div>

      {/* Shift status bar */}
      <div className="mx-4 mt-2.5 flex shrink-0 items-center justify-between rounded-control bg-pos-background px-2.5 py-1.5 text-xs">
        {hasOpenShift ? (
          <>
            <div className="flex items-center gap-2">
              <span className="font-medium text-pos-success">● Abierto</span>
              {openShift!.openingBalance > 0 && (
                <span className="font-mono text-pos-muted">
                  Apert.: {formatCurrency(openShift!.openingBalance)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowMovementModal(true)}
                className="rounded-control px-2 py-0.5 text-xs font-medium text-pos-secondary touch-target hover:bg-pos-secondary/10"
              >
                Retirar
              </button>
              <button
                onClick={handleCloseShift}
                className="rounded-control px-2 py-0.5 text-pos-danger touch-target hover:bg-pos-danger/10"
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
                className="rounded-control px-2 py-0.5 font-medium text-pos-secondary touch-target hover:bg-pos-secondary/10"
              >
                Abrir Turno
              </button>
            )}
          </>
        )}
      </div>

      {/* Selected customer */}
      <div className="mx-4 mt-2 flex shrink-0 items-center justify-between rounded-control bg-pos-background px-3 py-2 text-sm">
        <span className="min-w-0 truncate text-pos-muted">
          Cliente:{" "}
          <span className="font-medium text-pos-text">
            {selectedCustomer?.name ?? "Consumidor Final"}
          </span>
        </span>
        {onSelectCustomer && (
          <button
            onClick={onSelectCustomer}
            className="shrink-0 rounded-control px-2 py-1 text-xs font-medium text-pos-secondary touch-target transition-colors hover:bg-pos-secondary/10"
          >
            Cambiar
          </button>
        )}
      </div>

      {/* Items list */}
      <div className="mt-2 min-h-0 flex-1 space-y-1.5 overflow-y-auto px-4 pb-1">
        {isEmpty ? (
          <div className="flex h-48 items-center justify-center">
            <p className="px-2 text-center text-sm italic text-pos-muted">
              Carrito vacío. Tocá un producto, buscá con F2 o escaneá un código de barras.
            </p>
          </div>
        ) : (
          items.map((item, idx) => (
            <div
              key={item.productId}
              onClick={() => selectCartItem(item.productId)}
              className={`grid grid-cols-[1.25rem_1.75rem_minmax(0,1fr)_auto_1.5rem] items-center gap-x-1.5 gap-y-1 rounded-control border px-2.5 py-2 cursor-pointer transition-colors ${
                selectedCartItemId === item.productId
                  ? "border-pos-secondary ring-1 ring-pos-secondary/30"
                  : "border-pos-muted/10 hover:border-pos-muted/25"
              }`}
            >
              {/* Item index */}
              <span className="col-start-1 row-start-1 w-5 text-center text-xs font-mono font-bold text-pos-muted/50">
                {idx + 1}
              </span>

              {/* Thumbnail */}
              <div className="col-start-2 row-start-1 w-7 h-7 rounded-control overflow-hidden bg-pos-muted/10">
                <ProductImage
                  src={products.find((p) => p.id === item.productId)?.image}
                  imgClassName="w-full h-full object-cover"
                  boxClassName="w-full h-full"
                  iconClassName="w-3.5 h-3.5 text-pos-muted/30"
                />
              </div>

              {/* Product name */}
              <span className="col-start-3 row-start-1 min-w-0 text-sm font-medium text-pos-text truncate">
                {item.productName}
              </span>

              {/* Second line: unit price on the left, line subtotal on the right */}
              <div className="col-span-full row-start-2 flex items-baseline justify-between gap-2">
                {/* Unit price — only when it adds information over the line subtotal */}
                <span className="min-w-0 truncate text-[11px] font-mono text-pos-muted tabular-nums">
                  {(item.saleUnit !== "unit" || item.quantity !== 1) &&
                    `${item.saleUnit === "unit" ? `${item.quantity} × ` : ""}${formatCurrency(item.unitPrice)}${item.saleUnit !== "unit" ? "/kg" : ""}`}
                </span>
                <span className="shrink-0 whitespace-nowrap text-sm font-bold font-mono text-pos-text tabular-nums">
                  {formatCurrency(item.subtotal)}
                </span>
              </div>

              {/* Quantity / Weight controls */}
              {item.saleUnit === "unit" ? (
                /* ── Unit controls: inline, beside the product name ── */
                <div className="col-start-4 row-start-1 flex shrink-0 items-center justify-self-end gap-1">
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
                    className="w-7 h-7 flex items-center justify-center bg-pos-background border border-pos-muted/20 rounded-control text-pos-text font-bold text-base touch-target hover:bg-pos-muted/10 transition-colors"
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
                    className="w-10 text-center text-xs font-bold font-mono text-pos-text bg-pos-background border border-pos-muted/20 rounded-control px-0.5 py-1 focus:outline-none focus:ring-2 focus:ring-pos-secondary [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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
                    className="w-7 h-7 flex items-center justify-center bg-pos-background border border-pos-muted/20 rounded-control text-pos-text font-bold text-base touch-target hover:bg-pos-muted/10 transition-colors"
                    aria-label={`Aumentar cantidad de ${item.productName}`}
                  >
                    +
                  </button>
                </div>
              ) : (
                /* ── Weight controls (gramos): six buttons do not fit beside the name ── */
                <div className="col-span-full col-start-1 row-start-3 flex flex-wrap items-center gap-1">
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
                    className="w-7 h-7 flex items-center justify-center bg-pos-background border border-pos-muted/20 rounded-control text-pos-text font-bold text-xs touch-target hover:bg-pos-muted/10 transition-colors"
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
                    className="w-7 h-7 flex items-center justify-center bg-pos-background border border-pos-muted/20 rounded-control text-pos-text font-bold text-sm touch-target hover:bg-pos-muted/10 transition-colors"
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
                    className="w-14 text-center text-xs font-bold font-mono text-pos-text bg-pos-background border border-pos-muted/20 rounded-control px-0.5 py-1 focus:outline-none focus:ring-2 focus:ring-pos-secondary [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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
                    className="w-7 h-7 flex items-center justify-center bg-pos-background border border-pos-muted/20 rounded-control text-pos-text font-bold text-sm touch-target hover:bg-pos-muted/10 transition-colors"
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
                    className="w-7 h-7 flex items-center justify-center bg-pos-background border border-pos-muted/20 rounded-control text-pos-text font-bold text-xs touch-target hover:bg-pos-muted/10 transition-colors"
                    aria-label={`Aumentar 100g de ${item.productName}`}
                    title="+100g"
                  >
                    +100
                  </button>
                </div>
              )}

              {/* Stock warning */}
              {stockError === item.productId && (
                <span
                  className={`col-span-full text-[10px] text-pos-danger font-medium ${
                    item.saleUnit === "unit" ? "row-start-3" : "row-start-4"
                  }`}
                >
                  Stock insuf.
                </span>
              )}

              {/* Remove */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeItem(item.productId);
                }}
                className="col-start-5 row-start-1 justify-self-end w-6 h-6 flex items-center justify-center text-pos-muted/60 hover:text-pos-danger touch-target rounded-control hover:bg-pos-danger/10 transition-colors"
                aria-label={`Eliminar ${item.productName} del carrito`}
              >
                ✕
              </button>
            </div>
          )))}
      </div>

      {/* Totals + checkout */}
      {!isEmpty && (
        <div className="mt-3 shrink-0 space-y-1.5 border-t border-pos-muted/10 px-4 pb-4 pt-3">
          {/* Subtotal line */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="text-pos-muted">Subtotal</span>
              {activePriceList && (
                <span className="inline-flex items-center gap-1 rounded-pill bg-pos-secondary/10 px-2 py-0.5 text-[10px] font-medium text-pos-secondary">
                  {activePriceList.name}
                </span>
              )}
            </div>
            <span className="font-mono font-medium tabular-nums text-pos-text">
              {formatCurrency(rawSubtotal)}
            </span>
          </div>

          {/* Combo savings */}
          {comboInfo && comboInfo.combos.length > 0 && (
            <div className="space-y-0.5">
              {comboInfo.combos.map((c) => (
                <div key={c.comboId} className="flex items-center justify-between text-xs">
                  <span className="text-pos-secondary font-medium">
                    {c.times > 1 ? `${c.times}x ` : ""}Combo: {c.name}
                  </span>
                  <span className="text-pos-secondary font-mono tabular-nums">−{formatCurrency(c.totalSavings)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Bulto savings */}
          {comboInfo && comboInfo.bultos && comboInfo.bultos.length > 0 && (
            <div className="space-y-0.5">
              {comboInfo.bultos.map((b) => (
                <div key={b.bultoId} className="flex items-center justify-between text-xs">
                  <span className="text-pos-secondary font-medium">
                    {b.times > 1 ? `${b.times}x ` : ""}Bulto: {b.name}
                  </span>
                  <span className="text-pos-secondary font-mono tabular-nums">−{formatCurrency(b.totalSavings)}</span>
                </div>
              ))}
            </div>
          )}

          {/* IVA — calculado según la configuración de la empresa */}
          {ivaInfo.alicuota > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-pos-muted">IVA {ivaInfo.alicuota}%</span>
              <span className="font-mono font-medium tabular-nums text-pos-text">
                {formatCurrency(ivaInfo.iva)}
              </span>
            </div>
          )}

          {/* Total */}
          <div className="flex items-baseline justify-between pt-1">
            <span className="text-sm font-semibold text-pos-text">Total</span>
            <span className="font-mono text-[22px] font-bold tracking-tight tabular-nums text-pos-text">
              {formatCurrency(total)}
            </span>
          </div>

          {/* Checkout button */}
          <button
            onClick={onCheckout}
            className="mt-2 w-full rounded-[15px] bg-gradient-to-br from-pos-accent to-pos-accent-2 py-3 text-base font-bold text-pos-on-solid touch-target transition hover:brightness-105 active:scale-[0.995]"
          >
            Cobrar — {formatCurrency(total)}
          </button>
        </div>
      )}

      {/* ── Shift Close Confirmation Modal ── */}
      {showCloseModal && openShift && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-pos-surface rounded-panel shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-pos-danger/10 flex items-center justify-center">
              <svg className="w-6 h-6 text-pos-danger" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
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
                className="px-5 py-2.5 text-sm text-pos-text border border-pos-muted/30 rounded-control touch-target hover:bg-pos-background/50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmCloseShift}
                className="px-5 py-2.5 text-sm bg-pos-danger text-pos-on-solid rounded-control font-medium touch-target hover:opacity-90"
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
