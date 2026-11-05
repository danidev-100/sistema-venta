import { useEffect, useCallback, useMemo, useState, useRef } from "react";
import { useAppStore, usePriceListsStore, useCustomersStore } from "@/store";
import { useProductsStore } from "@/store/products";
import { useActiveStore } from "@/store/context";
import { useInvoicesStore } from "@/store/invoices";
import { useComprobantesStore } from "@/store/comprobantes";
import { useAuthStore } from "@/store/auth";
import { useCashClosingStore } from "@/store/cash-closing";
import { exportInvoicePdf, printComprobante } from "@/lib/pdf-export";
import ProductSearchModal from "@/components/ProductSearchModal";
import BarcodeScannerModal from "@/components/BarcodeScannerModal";
import CartPanel from "@/components/CartPanel";
import CheckoutModal from "@/components/CheckoutModal";
import CustomerSelectModal from "@/components/CustomerSelectModal";
import OpenShiftModal from "@/components/OpenShiftModal";
import NoStockModal from "@/components/NoStockModal";
import QuickSaleModal from "@/components/QuickSaleModal";
import ReceiptPreview from "@/components/ReceiptPreview";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useBarcodeScan } from "@/hooks/useBarcodeScan";
import { formatCurrency } from "@/lib/format";

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export default function POSPage() {
  const { storeId } = useActiveStore();
  const showNotification = useAppStore((s) => s.showNotification);
  const dismissNotification = useAppStore((s) => s.dismissNotification);
  const addItem = useAppStore((s) => s.addItem);
  const lastCompletedSale = useAppStore((s) => s.lastCompletedSale);
  const dismissReceipt = useAppStore((s) => s.dismissReceipt);
  const setPage = useAppStore((s) => s.setPage);
  const currentUser = useAuthStore((s) => s.currentUser);
  const shifts = useCashClosingStore((s) => s.shifts);
  const loadShifts = useCashClosingStore((s) => s.loadShifts);
  const openShiftAction = useCashClosingStore((s) => s.openShift);
  const loadProducts = useProductsStore((s) => s.loadProducts);
  const loadCategories = useProductsStore((s) => s.loadCategories);
  const loadCustomers = useCustomersStore((s) => s.loadCustomers);

  const [showCheckout, setShowCheckout] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showCustomerSelect, setShowCustomerSelect] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showOpenShift, setShowOpenShift] = useState(false);
  const [noStockProduct, setNoStockProduct] = useState<string | null>(null);
  const [weightInput, setWeightInput] = useState<{
    productId: number;
    productName: string;
    unitPrice: number;
    saleUnit: "gram" | "kilogram";
  } | null>(null);
  const [quickAddData, setQuickAddData] = useState<{
    name: string;
    barcode: string;
  } | null>(null);
  const hintShown = useRef(false);

  // Check for open shift (reactively — subscribes to shifts)
  const openShiftData = shifts.find(
    (s) => s.storeId === storeId && s.status === "open",
  ) ?? null;
  const hasOpenShift = openShiftData !== null;

  // Load shifts, products, categories, and customers on mount
  useEffect(() => {
    loadShifts(storeId);
    loadProducts(storeId).catch(console.error);
    loadCategories(storeId).catch(console.error);
    loadCustomers(storeId).catch(console.error);
  }, [storeId, loadShifts, loadProducts, loadCategories, loadCustomers]);

  // Hint toast on first POS load
  useEffect(() => {
    if (hintShown.current) return;
    hintShown.current = true;
    showNotification("⌨️ F1 Cobrar · F2 Buscar · F3 Nueva venta · +/- Cantidad");
    const timer = setTimeout(() => dismissNotification(), 5000);
    return () => clearTimeout(timer);
  }, [showNotification, dismissNotification]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onCheckout: useCallback(() => {
      const { items } = useAppStore.getState();
      if (items.length === 0) return;
      const openShift = useCashClosingStore.getState().getOpenShift(storeId);
      if (!openShift) {
        useAppStore.getState().showNotification("Abrí un turno en Caja antes de cobrar");
        setTimeout(() => useAppStore.getState().dismissNotification(), 4000);
        return;
      }
      setShowCheckout(true);
    }, [storeId]),
    onFocusSearch: useCallback(() => {
      setShowSearchModal(true);
    }, []),
    onNewSale: useCallback(() => {
      const { items } = useAppStore.getState();
      if (items.length === 0) return;
      if (window.confirm("¿Iniciar una nueva venta? Se borrará el carrito actual.")) {
        useAppStore.getState().clearCart();
        setShowCheckout(false);
        setShowReceipt(false);
        setShowCustomerSelect(false);
        dismissNotification();
      }
    }, [dismissNotification]),
    onIncreaseQty: useCallback(() => {
      const { selectedCartItemId, items, updateQuantity } = useAppStore.getState();
      if (selectedCartItemId == null) return;
      const item = items.find((i) => i.productId === selectedCartItemId);
      if (item) updateQuantity(selectedCartItemId, item.quantity + 1);
    }, []),
    onDecreaseQty: useCallback(() => {
      const { selectedCartItemId, items, updateQuantity } = useAppStore.getState();
      if (selectedCartItemId == null) return;
      const item = items.find((i) => i.productId === selectedCartItemId);
      if (item) updateQuantity(selectedCartItemId, item.quantity - 1);
    }, []),
    onEscape: useCallback(() => {
      if (showReceipt) {
        setShowReceipt(false);
        useAppStore.getState().dismissReceipt();
      } else if (showCheckout) {
        setShowCheckout(false);
      } else if (showCustomerSelect) {
        setShowCustomerSelect(false);
      } else if (quickAddData) {
        setQuickAddData(null);
      }
    }, [showReceipt, showCheckout, showCustomerSelect, quickAddData]),
  });

  // Barcode scan hook (lector USB)
  const storeProducts = useProductsStore((s) => s.products);
  const storeCategories = useProductsStore((s) => s.categories);
  const selectedPriceListId = useAppStore((s) => s.selectedPriceListId);

  // ── Catalog grid ──
  // Real products of the active store, grouped by their real category names.
  // Nothing is hardcoded: a store without products renders the empty state.
  const [catalogCategory, setCatalogCategory] = useState<string | null>(null);

  const catalogProducts = useMemo(
    () => storeProducts.filter((p) => p.store_id === storeId),
    [storeProducts, storeId],
  );

  const categoryNameById = useMemo(() => {
    const names = new Map<number, string>();
    for (const category of storeCategories) {
      if (category.store_id === storeId) names.set(category.id, category.name);
    }
    return names;
  }, [storeCategories, storeId]);

  // Category chips come from the products actually on sale (deduped by name).
  const catalogCategories = useMemo(() => {
    const seen = new Map<string, string>();
    for (const product of catalogProducts) {
      const name =
        product.category_id != null
          ? categoryNameById.get(product.category_id)
          : undefined;
      if (!name) continue;
      const key = name.trim().toLowerCase();
      if (!seen.has(key)) seen.set(key, name);
    }
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, "es"));
  }, [catalogProducts, categoryNameById]);

  const visibleCatalog = useMemo(() => {
    if (catalogCategory === null) return catalogProducts;
    const key = catalogCategory.trim().toLowerCase();
    return catalogProducts.filter((product) => {
      const name =
        product.category_id != null
          ? categoryNameById.get(product.category_id)
          : undefined;
      return name != null && name.trim().toLowerCase() === key;
    });
  }, [catalogCategory, catalogProducts, categoryNameById]);

  // Same price the search modal uses: the selected price list wins over the
  // base price, so both entry points add the product with an identical amount.
  function catalogPrice(product: { id: number; price: number }): number {
    if (selectedPriceListId == null) return product.price;
    return usePriceListsStore
      .getState()
      .getEffectivePrice(selectedPriceListId, product.id, product.price);
  }

  const handleBarcodeMatch = useCallback(
    (id: number, name: string, price: number) => {
      if (!hasOpenShift) {
        showNotification("Abrí un turno antes de vender");
        setTimeout(() => dismissNotification(), 4000);
        return;
      }
      const prod = useProductsStore.getState().products.find(
        (p) => p.id === id,
      );
      if (prod && prod.stock <= 0) {
        setNoStockProduct(name);
        return;
      }
      // Weight products: show weight input modal
      if (prod && prod.saleUnit !== "unit") {
        setWeightInput({
          productId: id,
          productName: name,
          unitPrice: price,
          saleUnit: prod.saleUnit,
        });
        return;
      }
      addItem(id, name, price);
    },
    [addItem, showNotification, dismissNotification, hasOpenShift],
  );

  const handleBarcodeMiss = useCallback(
    (barcode: string) => {
      setQuickAddData({ name: "", barcode });
    },
    [],
  );

  const { scanFlash } = useBarcodeScan(storeProducts, {
    onMatch: handleBarcodeMatch,
    onMiss: handleBarcodeMiss,
  });

  // Escáner con cámara (mobile)
  const [showScanner, setShowScanner] = useState(false);

  function handleCameraDetected(barcode: string) {
    setShowScanner(false);
    const prod = storeProducts.find((p) => p.barcode === barcode);
    if (!prod) {
      handleBarcodeMiss(barcode);
      return;
    }
    handleBarcodeMatch(prod.id, prod.name, prod.price);
  }

  // Show receipt when a sale completes
  useEffect(() => {
    if (lastCompletedSale) {
      setShowCheckout(false);
      setShowReceipt(true);
    }
  }, [lastCompletedSale]);

  function handleOpenShift() {
    setShowOpenShift(true);
  }

  function handleShiftOpened() {
    const employee = currentUser?.name ?? "Cajero";
    showNotification(`Turno abierto — ${employee}`);
    setTimeout(() => dismissNotification(), 3000);
  }

  const handleAddToCart = useCallback(
    (product: { id: number; name: string; price: number }) => {
      // Check open shift
      if (!hasOpenShift) {
        showNotification("Abrí un turno antes de vender");
        setTimeout(() => dismissNotification(), 4000);
        return;
      }
      // Check price
      if (!product.price || product.price <= 0) {
        showNotification("El producto no tiene precio");
        setTimeout(() => dismissNotification(), 3000);
        return;
      }
      // Check stock
      const prod = useProductsStore.getState().products.find(
        (p) => p.id === product.id,
      );
      if (prod && prod.stock <= 0) {
        setNoStockProduct(product.name);
        return;
      }
      // Weight products: show weight input modal
      if (prod && prod.saleUnit !== "unit") {
        setWeightInput({
          productId: product.id,
          productName: product.name,
          unitPrice: product.price,
          saleUnit: prod.saleUnit,
        });
        return;
      }
      addItem(product.id, product.name, product.price);
    },
    [addItem, showNotification, dismissNotification, hasOpenShift],
  );

  function handleQuickAdd(name: string) {
    setShowSearchModal(false);
    setQuickAddData({ name, barcode: "" });
  }

  // Receives a free-sale item ({ id, name, price }) and adds it straight to the
  // cart. The id is a negative synthetic value (no real product exists), so no
  // catalog product is created and no stock is touched.
  function handleQuickAddConfirm(sale: {
    id: number;
    name: string;
    price: number;
  }) {
    setQuickAddData(null);
    addItem(sale.id, sale.name, sale.price);
    showNotification(`✓ ${sale.name} agregado al carrito`);
    setTimeout(() => dismissNotification(), 2500);
  }

  function handleCheckout() {
    if (!hasOpenShift) {
      showNotification("Abrí un turno en Caja antes de cobrar");
      setTimeout(() => dismissNotification(), 4000);
      return;
    }
    const store = useProductsStore.getState();
    if (store.products.length === 0) {
      showNotification("Agregá productos antes de cobrar");
      setTimeout(() => dismissNotification(), 3000);
      return;
    }
    setShowCheckout(true);
  }

  function handleCheckoutComplete() {
    setShowCheckout(false);
    // Receipt will auto-show via the useEffect above
  }

  function handleRefund() {
    if (!lastCompletedSale) return;
    const refundSale = useAppStore.getState().refundSale;
    refundSale(lastCompletedSale.id);
    showNotification(`Venta #${lastCompletedSale.id} devuelta — stock restablecido`);
    setTimeout(() => dismissNotification(), 4000);
  }

  async function handlePrint() {
    if (!lastCompletedSale) return;

    // Use comprobante if user selected a tipo at checkout
    const comprobante = useComprobantesStore
      .getState()
      .comprobantes
      .find((c) => c.sale_id === lastCompletedSale.id);

    if (comprobante) {
      printComprobante(comprobante);
      showNotification(`Imprimiendo ${comprobante.tipo} ${comprobante.numero}`);
      setTimeout(() => dismissNotification(), 4000);
      return;
    }

    // Fallback: legacy Invoice (shouldn't happen if user picked a tipo)
    const invoice = await useInvoicesStore
      .getState()
      .generateInvoice(
        lastCompletedSale,
        lastCompletedSale.customerName ?? undefined,
        currentUser?.name,
      );

    exportInvoicePdf(invoice, "ticket");

    showNotification(`Comprobante ${invoice.invoiceNumber} — elegí "Guardar como PDF" en el diálogo de impresión`);
    setTimeout(() => dismissNotification(), 5000);
  }

  function handleNewSale() {
    setShowReceipt(false);
    dismissReceipt();
  }

  return (
    <div className="flex h-full flex-col gap-3 lg:gap-4">
      {/* ── Cash Register Gate ── */}
      {!hasOpenShift ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="max-w-sm text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-pos-secondary/10">
              <svg className="h-7 w-7 text-pos-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h2 className="mb-2 text-lg font-semibold text-pos-text">
              No hay caja abierta
            </h2>
            <p className="mb-6 text-sm text-pos-muted">
              Necesitás abrir un turno antes de poder vender. Tus ventas se registran dentro del turno abierto.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleOpenShift}
                className="rounded-control bg-gradient-to-br from-pos-accent to-pos-accent-2 px-6 py-3 text-sm font-semibold text-white touch-target transition hover:brightness-105"
              >
                Abrir Turno como {currentUser?.name ?? "Cajero"}
              </button>
              <button
                onClick={() => setPage("cash-closing")}
                className="text-sm text-pos-secondary hover:underline touch-target"
              >
                Ir a Caja
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* ── Catalogue + sale panel ── */}
          <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row lg:gap-[18px]">
            {/* ── Catalogue column ── */}
            <section
              aria-label="Catálogo"
              className="flex min-h-0 flex-1 flex-col gap-3 max-lg:min-h-[42vh]"
            >
              <PriceListStrip />

              {/* Search trigger + camera */}
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => setShowSearchModal(true)}
                  className="group flex flex-1 items-center gap-3 rounded-pill border border-pos-muted/15 bg-pos-surface px-4 py-3 text-sm text-pos-muted transition-colors touch-target hover:border-pos-secondary/40 hover:text-pos-text"
                >
                  <svg className="h-5 w-5 text-pos-muted/50 group-hover:text-pos-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <span className="truncate">Buscar productos por nombre, código o ID</span>
                  <kbd className="ml-auto hidden shrink-0 rounded-pill border border-pos-muted/15 bg-pos-background px-1.5 py-0.5 font-mono text-[11px] text-pos-muted/60 lg:inline">F2</kbd>
                </button>
                <button
                  onClick={() => setShowScanner(true)}
                  title="Escanear con la cámara"
                  aria-label="Escanear con la cámara"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control border border-pos-muted/15 bg-pos-surface text-pos-muted transition-colors touch-target hover:border-pos-secondary/40 hover:text-pos-text"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </button>
              </div>

              <p className="shrink-0 text-center text-[11px] text-pos-muted/50">
                O escaneá el código de barras directamente
              </p>

              {/* Category chips — real categories of the products on sale */}
              {catalogCategories.length > 0 && (
                <div
                  role="group"
                  aria-label="Categorías"
                  className="flex shrink-0 flex-wrap gap-1.5"
                >
                  {["Todos", ...catalogCategories].map((name) => {
                    const value = name === "Todos" ? null : name;
                    const active = catalogCategory === value;
                    return (
                      <button
                        key={name}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setCatalogCategory(value)}
                        className={`h-8 rounded-pill px-3.5 text-[12.5px] font-medium transition-colors touch-target ${
                          active
                            ? "bg-pos-text text-pos-surface"
                            : "border border-pos-muted/10 bg-pos-surface text-pos-muted hover:border-pos-muted/25 hover:text-pos-text"
                        }`}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Product grid */}
              {catalogProducts.length === 0 ? (
                <div className="flex min-h-0 flex-1 items-center justify-center rounded-card border border-dashed border-pos-muted/20 bg-pos-surface/60 p-8 text-center">
                  <div>
                    <p className="text-sm font-medium text-pos-text">
                      No hay productos en esta sucursal
                    </p>
                    <p className="mt-1 text-xs text-pos-muted">
                      Cargalos desde Productos o usá F2 para una venta libre.
                    </p>
                  </div>
                </div>
              ) : visibleCatalog.length === 0 ? (
                <div className="flex min-h-0 flex-1 items-center justify-center rounded-card border border-dashed border-pos-muted/20 bg-pos-surface/60 p-8 text-center">
                  <p className="text-sm text-pos-muted">
                    No hay productos en «{catalogCategory}».
                  </p>
                </div>
              ) : (
                <div className="grid min-h-0 flex-1 grid-cols-2 content-start gap-3 overflow-y-auto pb-1 pr-1 lg:grid-cols-3">
                  {visibleCatalog.map((product) => {
                    const categoryName =
                      product.category_id != null
                        ? categoryNameById.get(product.category_id)
                        : undefined;
                    const price = catalogPrice(product);
                    const outOfStock = product.stock <= 0;
                    const stockClass = outOfStock
                      ? "text-pos-danger"
                      : product.stock <= 5
                        ? "text-pos-warn"
                        : "text-pos-success";
                    const stockLabel = outOfStock
                      ? "Sin stock"
                      : product.stock <= 5
                        ? `Últimas ${product.stock}`
                        : `Stock ${product.stock}`;

                    return (
                      <button
                        key={product.id}
                        type="button"
                        disabled={outOfStock}
                        onClick={() =>
                          handleAddToCart({
                            id: product.id,
                            name: product.name,
                            price,
                          })
                        }
                        className="flex min-h-[132px] flex-col rounded-card border border-pos-muted/10 bg-pos-surface p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-pos-secondary/35 hover:shadow-lg hover:shadow-pos-secondary/20 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0 disabled:hover:border-pos-muted/10 disabled:hover:shadow-none"
                      >
                        {categoryName && (
                          <span className="mb-2 self-start rounded-pill bg-pos-background px-2 py-0.5 text-[10.5px] font-semibold text-pos-muted">
                            {categoryName}
                          </span>
                        )}
                        <span className="line-clamp-2 text-[13.5px] font-semibold leading-snug text-pos-text">
                          {product.name}
                        </span>
                        <span className="mt-auto pt-2 font-mono text-[14.5px] font-semibold tabular-nums text-pos-text">
                          {formatCurrency(price)}
                          {product.saleUnit !== "unit" && (
                            <span className="ml-1 text-[10.5px] font-normal text-pos-muted">
                              /kg
                            </span>
                          )}
                        </span>
                        <span className={`mt-0.5 text-[11px] ${stockClass}`}>
                          {stockLabel}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ── Sale panel ── */}
            <aside
              aria-label="Venta actual"
              className={`flex min-h-0 flex-col overflow-hidden rounded-panel border border-pos-muted/10 bg-pos-surface shadow-[0_24px_48px_-34px_rgba(20,22,31,0.45)] max-lg:min-h-[46vh] lg:w-[396px] lg:shrink-0 ${
                scanFlash ? "scan-flash" : ""
              }`}
            >
              <CartPanel
                onCheckout={handleCheckout}
                onSelectCustomer={() => setShowCustomerSelect(true)}
                onOpenShift={handleOpenShift}
              />
            </aside>
          </div>

          {/* ── Product Search Modal ── */}
          {showSearchModal && (
            <ProductSearchModal
              onAddToCart={handleAddToCart}
              onClose={() => setShowSearchModal(false)}
              onQuickAdd={handleQuickAdd}
            />
          )}

          {/* ── Barcode Camera Scanner ── */}
          {showScanner && (
            <BarcodeScannerModal
              onDetected={handleCameraDetected}
              onClose={() => setShowScanner(false)}
            />
          )}
        </>
      )}

      {/* ── Customer Select Modal ── */}
      {showCustomerSelect && (
        <CustomerSelectModal
          onSelect={(customer) => {
            useAppStore.getState().selectCustomer(customer);
            if (customer?.priceListId) {
              useAppStore.getState().setSelectedPriceListId(customer.priceListId);
            }
            setShowCustomerSelect(false);
          }}
          onClose={() => setShowCustomerSelect(false)}
        />
      )}

      {/* ── Checkout Modal ── */}
      {showCheckout && (
        <CheckoutModal
          onClose={() => setShowCheckout(false)}
          onComplete={handleCheckoutComplete}
        />
      )}

      {/* ── Receipt Preview ── */}
      {showReceipt && lastCompletedSale && (
        <ReceiptPreview
          sale={lastCompletedSale}
          onPrint={handlePrint}
          onClose={handleNewSale}
          onRefund={handleRefund}
        />
      )}

      {/* ── Open Shift Modal ── */}
      {showOpenShift && (
        <OpenShiftModal
          employeeName={currentUser?.name ?? "Cajero"}
          onClose={() => setShowOpenShift(false)}
          onOpened={handleShiftOpened}
        />
      )}

      {/* ── No Stock Modal ── */}
      {noStockProduct !== null && (
        <NoStockModal
          productName={noStockProduct}
          onClose={() => setNoStockProduct(null)}
        />
      )}

      {/* ── Weight Input Modal ── */}
      {weightInput !== null && (
        <WeightInputModal
          productName={weightInput.productName}
          unitPrice={weightInput.unitPrice}
          saleUnit={weightInput.saleUnit}
          onConfirm={(weightGrams) => {
            addItem(weightInput.productId, weightInput.productName, weightInput.unitPrice, weightGrams, weightInput.saleUnit);
            setWeightInput(null);
          }}
          onCancel={() => setWeightInput(null)}
        />
      )}

      {/* ── Quick Sale Modal (free sale — no catalog product) ── */}
      {quickAddData !== null && (
        <QuickSaleModal
          initialName={quickAddData.name}
          initialBarcode={quickAddData.barcode}
          onClose={() => setQuickAddData(null)}
          onConfirm={handleQuickAddConfirm}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Weight Input Modal
// ──────────────────────────────────────────────

function WeightInputModal({
  productName,
  unitPrice,
  saleUnit,
  onConfirm,
  onCancel,
}: {
  productName: string;
  unitPrice: number;
  saleUnit: "gram" | "kilogram";
  onConfirm: (weightGrams: number) => void;
  onCancel: () => void;
}) {
  const [kg, setKg] = useState("1.000");

  function handleSubmit() {
    const parsed = parseFloat(kg);
    if (isNaN(parsed) || parsed <= 0) return;
    const grams = Math.round(parsed * 1000);
    if (grams < 10) return;
    onConfirm(grams);
  }

  const grams = Math.round(parseFloat(kg || "0") * 1000);
  const total = Math.round((grams / 1000) * unitPrice * 100) / 100;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onCancel}
    >
      <div
        className="bg-pos-surface rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-pos-text text-center">
          {productName}
        </h3>
        <p className="text-xs text-pos-muted text-center">
          Precio: ${unitPrice.toFixed(2)} / kg
        </p>

        {/* Weight input */}
        <div className="flex items-center justify-center gap-2">
          <input
            type="number"
            step="0.001"
            min="0.010"
            value={kg}
            autoFocus
            onChange={(e) => setKg(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
              if (e.key === "Escape") onCancel();
            }}
            className="w-32 text-center text-2xl font-bold font-mono tabular-nums bg-pos-background border border-pos-muted/30 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-pos-secondary [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <span className="text-lg font-medium text-pos-muted">kg</span>
        </div>

        {/* Quick weights */}
        <div className="flex justify-center gap-2">
          {["0.500", "1.000", "1.500", "2.000", "3.000"].map((w) => (
            <button
              key={w}
              onClick={() => setKg(w)}
              className={`px-3 py-1.5 rounded-lg text-sm font-mono font-medium touch-target transition-colors ${
                kg === w
                  ? "bg-pos-secondary text-white"
                  : "bg-pos-background border border-pos-muted/20 text-pos-muted hover:border-pos-secondary/40"
              }`}
            >
              {w} kg
            </button>
          ))}
        </div>

        {/* Total preview */}
        <div className="text-center py-2">
          <p className="text-xs text-pos-muted">
            ${(grams / 1000).toFixed(3)} kg × $${unitPrice.toFixed(2)}/kg
          </p>
          <p className="text-2xl font-bold font-mono text-pos-text tabular-nums">
            ${total.toFixed(2)}
          </p>
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 border border-pos-muted/30 text-pos-text rounded-xl font-medium text-sm touch-target hover:bg-pos-background transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={grams < 10}
            className="flex-1 px-4 py-2.5 bg-pos-secondary text-white rounded-xl font-medium text-sm touch-target hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            Agregar
          </button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Price List Strip — compact selector in POS
// ──────────────────────────────────────────────

function PriceListStrip() {
  const priceLists = usePriceListsStore((s) => s.priceLists);
  const selectedPriceListId = useAppStore((s) => s.selectedPriceListId);
  const setSelectedPriceListId = useAppStore((s) => s.setSelectedPriceListId);
  const showNotification = useAppStore((s) => s.showNotification);

  if (priceLists.length === 0) return null;

  const activeList = selectedPriceListId != null
    ? priceLists.find((pl) => pl.id === selectedPriceListId)
    : null;

  return (
    <div className="shrink-0 mb-2">
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          onClick={() => setSelectedPriceListId(null)}
          className={`text-[11px] px-2.5 py-1 rounded-pill font-medium touch-target transition-all ${
            selectedPriceListId == null
              ? "bg-pos-muted/20 text-pos-text border border-pos-muted/30"
              : "border border-pos-muted/20 text-pos-muted hover:border-pos-muted/40 hover:text-pos-text"
          }`}
        >
          Sin lista
        </button>
        {priceLists.map((list) => {
          const active = selectedPriceListId === list.id;
          return (
            <button
              key={list.id}
              onClick={() => {
                setSelectedPriceListId(active ? null : list.id);
                if (!active) {
                  showNotification(`Lista "${list.name}" seleccionada`);
                  setTimeout(() => useAppStore.getState().dismissNotification(), 2000);
                }
              }}
              className={`text-[11px] px-2.5 py-1 rounded-pill font-medium touch-target transition-all ${
                active
                  ? "bg-pos-secondary text-white shadow-sm"
                  : "border border-pos-muted/20 text-pos-muted hover:border-pos-secondary hover:text-pos-secondary"
              }`}
            >
              {list.name}
            </button>
          );
        })}
      </div>
      {activeList && (
        <p className="text-[10px] text-pos-secondary mt-1 ml-1">
          Precios de {activeList.name} — los productos nuevos se agregarán con precio ajustado
        </p>
      )}
    </div>
  );
}

