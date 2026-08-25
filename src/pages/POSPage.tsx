import { useEffect, useCallback, useState, useRef } from "react";
import { useAppStore, usePriceListsStore, useCustomersStore } from "@/store";
import { useProductsStore } from "@/store/products";
import { useActiveStore } from "@/store/context";
import { useInvoicesStore } from "@/store/invoices";
import { useComprobantesStore } from "@/store/comprobantes";
import { useAuthStore } from "@/store/auth";
import { useCashClosingStore } from "@/store/cash-closing";
import { exportInvoicePdf, printComprobante } from "@/lib/pdf-export";
import { api } from "@/lib/api";
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

// ──────────────────────────────────────────────
// Demo seed data — runs once on first POSPage mount
// ──────────────────────────────────────────────

let seeded = false;

async function seedDemoProducts() {
  if (seeded) return;
  seeded = true;

  const existing = await api.get<any[]>("/products?storeId=store_1").catch(() => []);
  if (existing.length > 0) return; // database already has products

  const store = useProductsStore.getState();

  const bebidas = await store.addCategory({
    name: "Bebidas",
    parent_id: null,
    store_id: "store_1",
  });
  const lacteos = await store.addCategory({
    name: "Lácteos",
    parent_id: null,
    store_id: "store_1",
  });
  const almacen = await store.addCategory({
    name: "Almacén",
    parent_id: null,
    store_id: "store_1",
  });

  await store.addProduct({
    barcode: "77912345",
    name: "Coca-Cola 500ml",
    price: 150,
    stock: 100,
    category_id: bebidas.id,
    store_id: "store_1",
  });
  await store.addProduct({
    barcode: "77912346",
    name: "Agua Mineral 1L",
    price: 120,
    stock: 80,
    category_id: bebidas.id,
    store_id: "store_1",
  });
  await store.addProduct({
    barcode: "77912347",
    name: "Leche Entera 1L",
    price: 200,
    stock: 50,
    category_id: lacteos.id,
    store_id: "store_1",
  });
  await store.addProduct({
    barcode: "77912348",
    name: "Yogur Natural 200g",
    price: 180,
    stock: 40,
    category_id: lacteos.id,
    store_id: "store_1",
  });
  await store.addProduct({
    barcode: "77912349",
    name: "Arroz 1kg",
    price: 250,
    stock: 60,
    category_id: almacen.id,
    store_id: "store_1",
  });
  await store.addProduct({
    barcode: "77912350",
    name: "Fideos Tallarín 500g",
    price: 120,
    stock: 90,
    category_id: almacen.id,
    store_id: "store_1",
  });
  await store.addProduct({
    barcode: "77912351",
    name: "Aceite Girasol 1.5L",
    price: 450,
    stock: 30,
    category_id: almacen.id,
    store_id: "store_1",
  });
  await store.addProduct({
    barcode: "77912352",
    name: "Harina 0000 1kg",
    price: 180,
    stock: 45,
    category_id: almacen.id,
    store_id: "store_1",
  });
  await store.addProduct({
    barcode: "77912353",
    name: "Azúcar 1kg",
    price: 220,
    stock: 55,
    category_id: almacen.id,
    store_id: "store_1",
  });
  await store.addProduct({
    barcode: "77912354",
    name: "Yerba Mate 1kg",
    price: 380,
    stock: 35,
    category_id: almacen.id,
    store_id: "store_1",
  });
  await store.addProduct({
    barcode: "77912355",
    name: "Galletitas Saladas",
    price: 160,
    stock: 70,
    category_id: almacen.id,
    store_id: "store_1",
  });
  await store.addProduct({
    barcode: "77912356",
    name: "Jugo Naranja 1L",
    price: 190,
    stock: 8,
    category_id: bebidas.id,
    store_id: "store_1",
  });

  // Weight products (gram)
  await store.addProduct({
    barcode: "77912357",
    name: "Queso Cremoso",
    price: 250,
    stock: 5000,
    saleUnit: "gram",
    category_id: lacteos.id,
    store_id: "store_1",
  });
  await store.addProduct({
    barcode: "77912358",
    name: "Fiambre Jamón Cocido",
    price: 320,
    stock: 8000,
    saleUnit: "gram",
    category_id: almacen.id,
    store_id: "store_1",
  });

  // Weight products (kilogram)
  await store.addProduct({
    barcode: "77912359",
    name: "Carne Molida Especial",
    price: 450,
    stock: 15000,
    saleUnit: "kilogram",
    category_id: almacen.id,
    store_id: "store_1",
  });

  // Also seed store_2 with a few products for cross-store testing
  const store2Bebidas = await store.addCategory({
    name: "Bebidas",
    parent_id: null,
    store_id: "store_2",
  });
  await store.addProduct({
    barcode: "77922345",
    name: "Sprite 500ml",
    price: 140,
    stock: 50,
    category_id: store2Bebidas.id,
    store_id: "store_2",
  });
  await store.addProduct({
    barcode: "77922346",
    name: "Fanta Naranja 500ml",
    price: 140,
    stock: 40,
    category_id: store2Bebidas.id,
    store_id: "store_2",
  });
}

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

  // Load shifts, products, customers, and seed demo products on mount
  useEffect(() => {
    loadShifts(storeId);
    loadProducts(storeId).catch(console.error);
    loadCustomers(storeId).catch(console.error);
    seedDemoProducts();
  }, [storeId, loadShifts, loadProducts, loadCustomers]);

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
    <div className="flex flex-col gap-3 lg:gap-4 h-full">
      {/* ── Cash Register Gate ── */}
      {!hasOpenShift ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-sm dark:text-gray-100">
            <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-pos-secondary/10 flex items-center justify-center">
              <svg className="w-7 h-7 text-pos-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-pos-text mb-2">
              No hay caja abierta
            </h2>
            <p className="text-sm text-pos-muted mb-6">
              Necesitás abrir un turno antes de poder vender. Tus ventas se registran dentro del turno abierto.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleOpenShift}
                className="px-6 py-3 bg-pos-secondary text-white rounded-xl font-medium text-sm touch-target hover:opacity-90 transition-opacity"
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
          {/* ── Price List selector ── */}
          <PriceListStrip />

          {/* ── Search trigger ── */}
          <div className="shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSearchModal(true)}
                className="flex-1 flex items-center gap-3 bg-pos-surface border border-pos-muted/20 rounded-xl px-4 py-3.5 text-sm text-pos-muted hover:text-pos-text hover:border-pos-secondary/40 transition-all touch-target group dark:bg-gray-800 dark:border-gray-600/30 dark:hover:border-pos-secondary/40"
              >
                <svg className="w-5 h-5 text-pos-muted/40 group-hover:text-pos-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <span>Buscar productos por nombre, código o ID</span>
                <kbd className="hidden lg:inline ml-auto text-[11px] font-mono text-pos-muted/30 bg-pos-background/50 px-1.5 py-0.5 rounded border border-pos-muted/10">F2</kbd>
              </button>
              <button
                onClick={() => setShowScanner(true)}
                title="Escanear con la cámara"
                aria-label="Escanear con la cámara"
                className="shrink-0 flex items-center justify-center w-12 h-12 bg-pos-surface border border-pos-muted/20 rounded-xl text-pos-muted hover:text-pos-text hover:border-pos-secondary/40 transition-all touch-target dark:bg-gray-800 dark:border-gray-600/30 dark:hover:border-pos-secondary/40"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </button>
            </div>
            <p className="text-[11px] text-pos-muted/40 text-center mt-1.5">
              O escaneá el código de barras directamente
            </p>
          </div>

          {/* ── Cart Panel (vertical — full height) ── */}
          <aside className={`flex-1 min-h-[45vh] lg:min-h-0 bg-pos-surface rounded-xl border border-pos-muted/10 p-4 overflow-y-auto dark:bg-gray-800 dark:border-gray-600/30 ${scanFlash ? "scan-flash" : ""}`}>
            <CartPanel
              onCheckout={handleCheckout}
              onSelectCustomer={() => setShowCustomerSelect(true)}
              onOpenShift={handleOpenShift}
            />
          </aside>

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
          className={`text-[11px] px-2 py-1 rounded-lg font-medium touch-target transition-all ${
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
              className={`text-[11px] px-2 py-1 rounded-lg font-medium touch-target transition-all ${
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

