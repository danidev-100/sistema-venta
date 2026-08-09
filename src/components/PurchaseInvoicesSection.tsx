import { useState, useRef, useEffect } from "react";
import { useAppStore } from "@/store";
import { useProveedoresStore } from "@/store/proveedores";
import { useProductsStore } from "@/store/products";
import { usePurchaseInvoicesStore, type PurchaseInvoice } from "@/store/purchase-invoices";
import { useActiveStore } from "@/store/context";

type DraftItem = {
  productId: number;
  name: string;
  quantity: string;
  unitPrice: string;
  salePrice: string;
};

export default function PurchaseInvoicesSection() {
  const { storeId } = useActiveStore();
  const products = useProductsStore((s) => s.products);
  const loadProducts = useProductsStore((s) => s.loadProducts);
  const proveedores = useProveedoresStore((s) => s.proveedores);
  const loadProveedores = useProveedoresStore((s) => s.loadProveedores);
  const purchaseInvoices = usePurchaseInvoicesStore((s) => s.purchaseInvoices);
  const loadingInvoices = usePurchaseInvoicesStore((s) => s.loading);
  const loadPurchaseInvoices = usePurchaseInvoicesStore((s) => s.loadPurchaseInvoices);
  const createPurchaseInvoice = usePurchaseInvoicesStore((s) => s.createPurchaseInvoice);
  const showNotification = useAppStore((s) => s.showNotification);

  const [proveedorId, setProveedorId] = useState<number | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [successInvoice, setSuccessInvoice] = useState<PurchaseInvoice | null>(null);

  const loadedRef = useRef(false);
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    loadProveedores(storeId).catch(console.error);
    loadPurchaseInvoices(storeId).catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const storeProducts = products.filter((p) => p.store_id === storeId);
  const storeProveedores = proveedores
    .filter((p) => p.store_id === storeId)
    .sort((a, b) => a.name.localeCompare(b.name));

  const q = productSearch.toLowerCase();
  const filteredProducts = storeProducts.filter(
    (p) =>
      !q ||
      p.name.toLowerCase().includes(q) ||
      (p.barcode !== null && p.barcode.toLowerCase().includes(q)) ||
      String(p.id).includes(q),
  );

  // Reset highlight when search changes
  useEffect(() => {
    setHighlightIndex(0);
  }, [productSearch]);

  // Scroll highlighted item into view
  useEffect(() => {
    const el = listRef.current?.children[highlightIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [highlightIndex]);

  function addProduct(product: (typeof storeProducts)[number]) {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id ? { ...i, quantity: String((parseFloat(i.quantity) || 0) + 1) } : i,
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          quantity: "1",
          unitPrice: String(product.costPrice ?? 0),
          salePrice: String(product.price ?? 0),
        },
      ];
    });
    setProductSearch("");
    setHighlightIndex(0);
  }

  function updateQuantity(productId: number, raw: string) {
    setItems((prev) => prev.map((i) => (i.productId === productId ? { ...i, quantity: raw } : i)));
  }

  function updateUnitPrice(productId: number, raw: string) {
    setItems((prev) => prev.map((i) => (i.productId === productId ? { ...i, unitPrice: raw } : i)));
  }

  function updateSalePrice(productId: number, raw: string) {
    setItems((prev) => prev.map((i) => (i.productId === productId ? { ...i, salePrice: raw } : i)));
  }

  function removeItem(productId: number) {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }

  const total = items.reduce(
    (sum, i) => sum + (parseFloat(i.quantity) || 0) * (parseFloat(i.unitPrice) || 0),
    0,
  );

  async function handleCargar() {
    if (!proveedorId || items.length === 0 || creating) return;

    const parsedItems = items.map((i) => ({
      product_id: i.productId,
      quantity: parseFloat(i.quantity) || 0,
      unit_price: parseFloat(i.unitPrice) || 0,
      sale_price: parseFloat(i.salePrice) || 0,
    }));
    if (parsedItems.some((i) => i.quantity < 1)) {
      showNotification("Todas las cantidades deben ser mayor a 0");
      return;
    }
    if (parsedItems.some((i) => i.unit_price < 0 || i.sale_price < 0)) {
      showNotification("El costo unitario y el precio de venta no pueden ser negativos");
      return;
    }

    setCreating(true);
    try {
      const created = await createPurchaseInvoice({
        store_id: storeId,
        proveedor_id: proveedorId,
        invoice_number: null,
        notes: null,
        items: parsedItems,
      });
      setSuccessInvoice(created);
      setItems([]);
      setProveedorId(null);
      setProductSearch("");
      loadPurchaseInvoices(storeId).catch(console.error);
      loadProducts(storeId).catch(console.error);
    } catch (err) {
      showNotification(err instanceof Error ? err.message : "Error al cargar la factura");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <h3 className="text-base font-semibold text-pos-text mb-4">Facturas de Compra</h3>
      <div className="max-w-2xl space-y-6">
        {/* ── Form ── */}
        <div className="rounded-xl border border-pos-muted/10 bg-pos-surface p-4 dark:border-gray-600/30 dark:bg-gray-800">
          <h4 className="text-sm font-semibold text-pos-text mb-3">Nueva Factura de Compra</h4>
          <div className="space-y-3">
            {/* Proveedor */}
            <div>
              <p className="text-xs font-medium text-pos-muted mb-2">Proveedor</p>
              <select
                value={proveedorId ?? ""}
                onChange={(e) => setProveedorId(e.target.value ? Number(e.target.value) : null)}
                className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary bg-pos-surface"
              >
                <option value="">Seleccioná un proveedor…</option>
                {storeProveedores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {storeProveedores.length === 0 && (
                <p className="text-xs text-pos-muted mt-1">
                  No hay proveedores en esta tienda. Creá uno desde la página Proveedores.
                </p>
              )}
            </div>

            {/* Product search */}
            <div>
              <p className="text-xs font-medium text-pos-muted mb-2">Productos</p>
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setHighlightIndex((i) => Math.min(i + 1, filteredProducts.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setHighlightIndex((i) => Math.max(i - 1, 0));
                  } else if (e.key === "Enter" && filteredProducts[highlightIndex]) {
                    e.preventDefault();
                    addProduct(filteredProducts[highlightIndex]);
                  }
                }}
                placeholder="Buscá por nombre, código de barras o ID…"
                className="w-full mb-2 border border-pos-muted/30 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary bg-pos-surface"
              />
              <div ref={listRef} className="max-h-48 overflow-y-auto space-y-1">
                {filteredProducts.length === 0 && storeProducts.length > 0 && (
                  <p className="text-xs text-pos-muted text-center py-4">Sin resultados</p>
                )}
                {filteredProducts.map((p, idx) => {
                  const alreadyAdded = items.some((i) => i.productId === p.id);
                  const highlighted = idx === highlightIndex;
                  return (
                    <div
                      key={p.id}
                      onClick={() => addProduct(p)}
                      onMouseEnter={() => setHighlightIndex(idx)}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                        highlighted
                          ? "bg-pos-secondary/10 ring-1 ring-pos-secondary/30"
                          : "hover:bg-pos-background"
                      }`}
                    >
                      <span className="text-sm text-pos-text flex-1 truncate">{p.name}</span>
                      <span className="text-xs text-pos-muted font-mono text-right shrink-0">
                        ${p.costPrice.toFixed(2)}
                      </span>
                      {alreadyAdded && (
                        <span className="text-xs font-medium text-emerald-500 dark:text-emerald-400 shrink-0">
                          ✓ agregado
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Items table */}
            {items.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-pos-muted/60 border-b border-pos-muted/10">
                      <th className="text-left font-medium py-1 pr-2">Producto</th>
                      <th className="text-right font-medium py-1 px-2 w-20">Cant</th>
                      <th className="text-right font-medium py-1 px-2 w-28">Costo unit.</th>
                      <th className="text-right font-medium py-1 px-2 w-28">Precio venta</th>
                      <th className="text-right font-medium py-1 px-2">Subtotal</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.productId} className="border-b border-pos-muted/5 last:border-0">
                        <td className="py-1 pr-2 text-pos-text truncate max-w-[180px]">{item.name}</td>
                        <td className="py-1 px-2 text-right">
                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => updateQuantity(item.productId, e.target.value)}
                            className="w-16 border border-pos-muted/30 rounded px-2 py-0.5 text-xs text-right font-mono focus:outline-none focus:ring-1 focus:ring-pos-secondary bg-pos-surface [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </td>
                        <td className="py-1 px-2 text-right">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => updateUnitPrice(item.productId, e.target.value)}
                            className="w-24 border border-pos-muted/30 rounded px-2 py-0.5 text-xs text-right font-mono focus:outline-none focus:ring-1 focus:ring-pos-secondary bg-pos-surface [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </td>
                        <td className="py-1 px-2 text-right">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={item.salePrice}
                            onChange={(e) => updateSalePrice(item.productId, e.target.value)}
                            className="w-24 border border-pos-muted/30 rounded px-2 py-0.5 text-xs text-right font-mono focus:outline-none focus:ring-1 focus:ring-pos-secondary bg-pos-surface [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </td>
                        <td className="py-1 px-2 text-right font-mono text-pos-text">
                          ${((parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0)).toFixed(2)}
                        </td>
                        <td className="py-1 text-right">
                          <button
                            onClick={() => removeItem(item.productId)}
                            className="text-pos-danger hover:text-pos-danger/70 transition-colors touch-target px-1"
                            aria-label={`Quitar ${item.name}`}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-pos-muted/10">
                  <span className="text-xs text-pos-muted">{items.length} producto{items.length !== 1 ? "s" : ""}</span>
                  <span className="text-sm font-bold text-pos-text">
                    Total: <span className="font-mono">${total.toFixed(2)}</span>
                  </span>
                </div>
              </div>
            )}

            <button
              onClick={handleCargar}
              disabled={!proveedorId || items.length === 0 || creating}
              className="px-4 py-2 bg-pos-secondary text-white rounded-lg text-sm font-medium touch-target hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {creating ? "Cargando…" : "Cargar"}
            </button>
          </div>
        </div>

        {/* ── Invoices list ── */}
        <div>
          <h4 className="text-sm font-semibold text-pos-text mb-3">Facturas cargadas</h4>
          <div className="space-y-2">
            {loadingInvoices && purchaseInvoices.length === 0 && (
              <p className="text-sm text-pos-muted">Cargando facturas…</p>
            )}
            {!loadingInvoices && purchaseInvoices.length === 0 && (
              <p className="text-sm text-pos-muted">No hay facturas de compra todavía.</p>
            )}
            {purchaseInvoices.map((inv) => (
              <div
                key={inv.id}
                className="rounded-xl border border-pos-muted/10 bg-pos-surface p-4 dark:border-gray-600/30 dark:bg-gray-800"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-pos-text">
                      #{inv.id} · {inv.proveedorName}
                    </h4>
                    <p className="text-xs text-pos-muted mt-0.5">
                      {new Date(inv.createdAt).toLocaleString("es-AR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-bold text-pos-text font-mono">
                      ${inv.total.toFixed(2)}
                    </span>
                    <button
                      onClick={() => setExpandedId(expandedId === inv.id ? null : inv.id)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-pos-muted/20 text-pos-text touch-target hover:bg-pos-background"
                    >
                      {expandedId === inv.id ? "Ocultar" : "Detalle"}
                    </button>
                  </div>
                </div>

                {expandedId === inv.id && inv.items.length > 0 && (
                  <table className="w-full mt-3 text-xs">
                    <thead>
                      <tr className="text-pos-muted/60 border-b border-pos-muted/10">
                        <th className="text-left font-medium py-1 pr-2">Producto</th>
                        <th className="text-right font-medium py-1 px-2">Cant</th>
                        <th className="text-right font-medium py-1 px-2">Costo unit.</th>
                        <th className="text-right font-medium py-1 px-2">Precio venta</th>
                        <th className="text-right font-medium py-1 pl-2">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inv.items.map((item) => (
                        <tr key={item.id} className="border-b border-pos-muted/5 last:border-0">
                          <td className="py-1 pr-2 text-pos-muted">{item.productName}</td>
                          <td className="py-1 px-2 text-right font-mono text-pos-muted">{item.quantity}</td>
                          <td className="py-1 px-2 text-right font-mono text-pos-muted">
                            ${item.unitPrice.toFixed(2)}
                          </td>
                          <td className="py-1 px-2 text-right font-mono text-pos-muted">
                            ${item.salePrice.toFixed(2)}
                          </td>
                          <td className="py-1 pl-2 text-right font-mono text-pos-muted">
                            ${item.subtotal.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {successInvoice && (
        <SuccessModal invoice={successInvoice} onClose={() => setSuccessInvoice(null)} />
      )}
    </div>
  );
}

function SuccessModal({
  invoice,
  onClose,
}: {
  invoice: PurchaseInvoice;
  onClose: () => void;
}) {
  const [animOut, setAnimOut] = useState(false);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeWithAnim();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function closeWithAnim() {
    setAnimOut(true);
    setTimeout(onClose, 150);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={closeWithAnim}
    >
      <div
        className={`w-full max-w-sm bg-pos-surface rounded-2xl shadow-2xl border border-pos-muted/10 mx-4 p-6 text-center space-y-5 transition-all duration-150 ${
          animOut ? "opacity-0 scale-95" : "opacity-100 scale-100"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center text-4xl">
          ✅
        </div>
        <div>
          <h3 className="text-lg font-bold text-pos-text">¡Factura cargada al stock!</h3>
          <p className="text-xs text-pos-muted mt-1">
            Factura #{invoice.id} · {invoice.proveedorName}
          </p>
        </div>
        <div className="rounded-xl bg-pos-background/60 border border-pos-muted/10 divide-y divide-pos-muted/10 text-sm">
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-pos-muted">Productos</span>
            <span className="font-semibold text-pos-text">{invoice.items.length}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-pos-muted">Total</span>
            <span className="font-semibold text-pos-text font-mono">
              ${invoice.total.toFixed(2)}
            </span>
          </div>
        </div>
        <button
          onClick={closeWithAnim}
          className="w-full px-4 py-3 bg-pos-secondary text-white rounded-xl font-medium text-sm touch-target hover:opacity-90 transition-opacity"
        >
          Listo
        </button>
      </div>
    </div>
  );
}
