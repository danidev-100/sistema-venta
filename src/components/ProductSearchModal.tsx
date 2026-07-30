import { useState, useMemo, useEffect, useRef } from "react";
import { useAppStore, usePriceListsStore } from "@/store";
import { useActiveStore } from "@/store/context";
import { useProductsStore } from "@/store/products";

const RENDER_BATCH = 200;

// ──────────────────────────────────────────────
// Props
// ──────────────────────────────────────────────

type ProductSearchModalProps = {
  onAddToCart: (product: {
    id: number;
    name: string;
    price: number;
  }) => void;
  onClose: () => void;
  /** Called when user wants to quick-add an unregistered product from the empty state. */
  onQuickAdd?: (name: string) => void;
};

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export default function ProductSearchModal({
  onAddToCart,
  onClose,
  onQuickAdd,
}: ProductSearchModalProps) {
  const { storeId } = useActiveStore();
  const products = useProductsStore((s) => s.products);
  const cartItems = useAppStore((s) => s.items);
  const selectedPriceListId = useAppStore((s) => s.selectedPriceListId);
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [animOut, setAnimOut] = useState(false);
  const [renderCount, setRenderCount] = useState(RENDER_BATCH);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  function getEffectivePrice(product: typeof storeProducts[0]): number {
    if (selectedPriceListId != null) {
      return usePriceListsStore.getState().getEffectivePrice(selectedPriceListId, product.id, product.price);
    }
    return product.price;
  }

  const storeProducts = useMemo(
    () => products.filter((p) => p.store_id === storeId),
    [products, storeId],
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return storeProducts;
    const q = search.toLowerCase();
    return storeProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.barcode !== null && p.barcode.toLowerCase().includes(q)) ||
        String(p.id).includes(q),
    );
  }, [storeProducts, search]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filtered.length]);

  // Auto-focus search on mount
  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setAnimOut(true);
        setTimeout(onClose, 150);
        return;
      }
      if (filtered.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const product = filtered[selectedIndex];
        if (!product) return;
        const inCart = cartItems
          .filter((i) => i.productId === product.id)
          .reduce((sum, i) => sum + i.quantity, 0);
        if (!product.price || product.price <= 0 || product.stock - inCart <= 0)
          return;
        const effectivePrice = getEffectivePrice(product);
        onAddToCart({
          id: product.id,
          name: product.name,
          price: effectivePrice,
        });
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, selectedIndex, cartItems, onAddToCart]);

  // Reset render limit when search changes
  useEffect(() => {
    setRenderCount(RENDER_BATCH);
    setSelectedIndex(0);
  }, [search]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || renderCount >= filtered.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setRenderCount((prev) => Math.min(prev + RENDER_BATCH, filtered.length));
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [filtered.length, renderCount]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selected = listRef.current.children[
      selectedIndex
    ] as HTMLElement | undefined;
    selected?.scrollIntoView?.({ block: "nearest" });
  }, [selectedIndex]);

  function handleTap(product: (typeof storeProducts)[number]) {
    const inCart = cartItems
      .filter((i) => i.productId === product.id)
      .reduce((sum, i) => sum + i.quantity, 0);
    if (!product.price || product.price <= 0 || product.stock - inCart <= 0)
      return;
    const effectivePrice = getEffectivePrice(product);
    onAddToCart({ id: product.id, name: product.name, price: effectivePrice });
    inputRef.current?.focus();
  }

  const hasNoProducts = storeProducts.length === 0;

  function closeWithAnim() {
    setAnimOut(true);
    setTimeout(onClose, 150);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-12 sm:pt-20 bg-black/50 backdrop-blur-sm"
      onClick={closeWithAnim}
    >
      <div
        className={`w-full max-w-lg bg-pos-surface rounded-2xl shadow-2xl border border-pos-muted/10 overflow-hidden mx-4 transition-all duration-150 ${
          animOut ? "opacity-0 scale-95 translate-y-2" : "opacity-100 scale-100 translate-y-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Search header ── */}
        <div className="p-4 border-b border-pos-muted/10">
          <div className="relative">
            <svg
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-pos-muted/35"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
               placeholder="Buscá por nombre, código de barras o ID…"
               aria-label="Buscar productos"
              className="w-full border border-pos-muted/25 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary bg-pos-background"
            />
          </div>
          <div className="flex items-center justify-center gap-3 mt-2">
            <kbd className="text-[11px] font-mono text-pos-muted/40 bg-pos-background/50 px-1.5 py-0.5 rounded border border-pos-muted/10">
              ↑↓
            </kbd>
            <span className="text-[11px] text-pos-muted/50">Navegar</span>
            <span className="text-pos-muted/20">·</span>
            <kbd className="text-[11px] font-mono text-pos-muted/40 bg-pos-background/50 px-1.5 py-0.5 rounded border border-pos-muted/10">
              Enter
            </kbd>
            <span className="text-[11px] text-pos-muted/50">Agregar</span>
            <span className="text-pos-muted/20">·</span>
            <kbd className="text-[11px] font-mono text-pos-muted/40 bg-pos-background/50 px-1.5 py-0.5 rounded border border-pos-muted/10">
              Esc
            </kbd>
            <span className="text-[11px] text-pos-muted/50">Cerrar</span>
          </div>
        </div>

        {/* ── Product list ── */}
        <div className="max-h-[55vh] overflow-y-auto p-2">
          {hasNoProducts ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="text-4xl mb-3 text-pos-muted/30">📦</div>
              <p className="text-sm text-pos-muted font-medium">
                No hay productos en esta tienda
              </p>
              <p className="text-xs text-pos-muted/50 mt-1">
                Agregá productos desde la página Productos
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="text-4xl mb-3 text-pos-muted/30">🔍</div>
              <p className="text-sm text-pos-muted font-medium">
                No hay resultados para "{search}"
              </p>
              {onQuickAdd ? (
                <>
                  <p className="text-xs text-pos-muted/50 mt-1 mb-4">
                    ¿No encontraste lo que buscabas? Agregalo al toque.
                  </p>
                  <button
                    onClick={() => onQuickAdd(search)}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-pos-secondary text-white rounded-xl font-medium text-sm touch-target hover:opacity-90 transition-opacity"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-4 h-4"
                    >
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Agregar producto
                  </button>
                </>
              ) : (
                <p className="text-xs text-pos-muted/50 mt-1">
                  Probá con otro nombre o código de barras
                </p>
              )}
            </div>
          ) : (
            <div ref={listRef} className="flex flex-col gap-1">
              {filtered.slice(0, renderCount).map((product, idx) => {
                const isSelected = idx === selectedIndex;
                const cartQty = cartItems
                  .filter((i) => i.productId === product.id)
                  .reduce((sum, i) => sum + i.quantity, 0);
                const availableStock = product.stock - cartQty;
                const outOfStock = availableStock <= 0;
                return (
                  <button
                    key={product.id}
                    onClick={() => handleTap(product)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    disabled={outOfStock}
                    className={`flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-xl border touch-target transition-all active:scale-[0.99] ${
                      isSelected
                        ? "border-pos-secondary ring-2 ring-pos-secondary/30 bg-pos-secondary/8 shadow-sm"
                        : outOfStock
                          ? "border-pos-muted/8 opacity-40 cursor-not-allowed"
                          : availableStock < 25
                            ? "border-pos-danger/25 hover:border-pos-danger/60 bg-pos-danger/5"
                            : "border-pos-muted/8 hover:border-pos-secondary/30 hover:bg-pos-secondary/5"
                    }`}
                    aria-label={
                      outOfStock
                        ? `${product.name} — sin stock`
                        : `${product.name} — $${product.price}`
                    }
                  >
                    {/* Stock dot */}
                    <span
                      className={`shrink-0 w-2 h-2 rounded-full ${
                        outOfStock
                          ? "bg-pos-muted/30"
                          : product.minStock > 0 && availableStock <= product.minStock
                            ? "bg-pos-danger"
                            : product.midStock > 0 && availableStock <= product.midStock
                              ? "bg-yellow-500"
                              : "bg-pos-success"
                      }`}
                    />

                    {/* Thumbnail */}
                    <div className="shrink-0 w-8 h-8 rounded-lg overflow-hidden bg-pos-muted/10">
                      {product.image ? (
                        <img src={product.image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-pos-muted/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Name + barcode + price inline */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-pos-text truncate">
                          {product.name}
                          {product.saleUnit !== "unit" && (
                            <span className="ml-1.5 inline-block px-1 py-0.5 rounded text-[10px] font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 align-middle">
                              {product.saleUnit === "gram" ? "g" : "kg"}
                            </span>
                          )}
                        </p>
                        {selectedPriceListId != null ? (
                          <div className="shrink-0 text-right">
                            <span className="text-xs font-mono text-pos-muted/50 line-through mr-1">
                              ${product.price.toFixed(2)}
                            </span>
                            <span className="text-sm font-bold font-mono text-violet-600 dark:text-violet-400 tabular-nums">
                              ${getEffectivePrice(product).toFixed(2)}
                            </span>
                          </div>
                        ) : (
                          <span className="shrink-0 text-sm font-bold font-mono text-pos-secondary tabular-nums">
                            ${product.price.toFixed(2)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {product.barcode && (
                          <p className="text-[10px] text-pos-muted/50 font-mono truncate">
                            {product.barcode}
                          </p>
                        )}
                        <span
                          className={`shrink-0 text-[10px] font-medium ${
                            outOfStock
                              ? "text-pos-muted"
                              : product.minStock > 0 && availableStock <= product.minStock
                                ? "text-pos-danger"
                                : "text-pos-muted/60"
                          }`}
                        >
                          {outOfStock
                            ? "Sin stock"
                            : product.saleUnit === "unit"
                              ? `${availableStock} uds`
                              : `${availableStock} g`}
                        </span>
                      </div>
                    </div>

                    {/* Add icon */}
                    {!outOfStock && (
                      <div className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-pos-secondary/10 text-pos-secondary transition-colors group-hover:bg-pos-secondary/20">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="w-3.5 h-3.5"
                        >
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
              {/* Sentinel — infinite scroll trigger */}
              <div
                ref={sentinelRef}
                className="flex items-center justify-center py-4 text-xs text-pos-muted/40"
              >
                {renderCount < filtered.length
                  ? `${filtered.length - renderCount} más… — seguí scrolleando`
                  : filtered.length > RENDER_BATCH
                    ? `Mostrando ${filtered.length} productos`
                    : ""}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="p-3 border-t border-pos-muted/10 flex items-center justify-between">
          <span className="text-xs text-pos-muted/40">
            {filtered.length > 0
              ? `${filtered.length} producto${filtered.length !== 1 ? "s" : ""}`
              : "Sin resultados"}
          </span>
          <div className="flex gap-2">
            {search && (
              <button
                onClick={() => setSearch("")}
                className="text-xs px-3 py-1.5 text-pos-muted hover:text-pos-text touch-target rounded-lg hover:bg-pos-background/50 transition-colors"
              >
                Limpiar
              </button>
            )}
            <button
              onClick={closeWithAnim}
              className="text-xs px-3 py-1.5 text-pos-muted hover:text-pos-text touch-target rounded-lg hover:bg-pos-background/50 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
