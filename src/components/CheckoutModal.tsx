import { useState, useEffect } from "react";
import { useAppStore, useCustomersStore, usePriceListsStore } from "@/store";
import { useActiveStore } from "@/store/context";
import { useCompanyStore } from "@/store/company";
import { type ComprobanteTipo, getTipoLabel } from "@/store/comprobantes";
import { computeIva } from "@/lib/iva";
import { formatCurrency } from "@/lib/format";
import NumberInput from "@/components/NumberInput";

type CheckoutModalProps = {
  onClose: () => void;
  onComplete: () => void;
};

export default function CheckoutModal({
  onClose,
  onComplete,
}: CheckoutModalProps) {
  const { storeId } = useActiveStore();
  const items = useAppStore((s) => s.items);
  const cartTotal = useAppStore((s) => s.cartTotal);
  const checkout = useAppStore((s) => s.checkout);
  const selectedCustomer = useAppStore((s) => s.selectedCustomer);
  // Live customer data from store (balance updates after collections)
  const liveCustomer = useCustomersStore((s) =>
    selectedCustomer ? s.customers.find((c) => c.id === selectedCustomer.id) ?? selectedCustomer : null,
  );
  const globalDiscountPercent = useAppStore((s) => s.globalDiscountPercent);
  const setGlobalDiscount = useAppStore((s) => s.setGlobalDiscount);
  const selectedComprobanteTipo = useAppStore((s) => s.selectedComprobanteTipo);
  const setSelectedComprobanteTipo = useAppStore((s) => s.setSelectedComprobanteTipo);
  const selectedPriceListId = useAppStore((s) => s.selectedPriceListId);
  const setSelectedPriceListId = useAppStore((s) => s.setSelectedPriceListId);
  const priceLists = usePriceListsStore((s) => s.priceLists);
  const companyData = useCompanyStore((s) => s.data);
  const companyLoaded = useCompanyStore((s) => s.loaded);
  const loadCompany = useCompanyStore((s) => s.loadCompany);

  useEffect(() => {
    if (!companyLoaded) loadCompany(storeId).catch(console.error);
  }, [storeId, companyLoaded, loadCompany]);

  const comboInfo = useAppStore((s) => s.getComboInfo());
  const subtotal = items.reduce((sum, i) => sum + i.subtotal, 0);
  const net = cartTotal();
  const ivaInfo = computeIva(net, companyData?.iva_alicuota ?? 0, companyData?.iva_incluido === 1);
  const total = ivaInfo.total;
  const beforeGlobal = comboInfo ? subtotal - comboInfo.totalSavings : subtotal;
  const nextDiscount = Math.round((beforeGlobal - net) * 100) / 100;
  const discountAmount = Math.round((subtotal - net) * 100) / 100;
  const isEmpty = items.length === 0;

  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "mixed" | "credit" | "mercadopago" | null>(null);
  const [modo, setModo] = useState<"afip" | "interno">("interno");
  const [discountDraft, setDiscountDraft] = useState(String(globalDiscountPercent));
  const [cashAmount, setCashAmount] = useState<string>("");
  const [cardAmount, setCardAmount] = useState<string>("");
  const [mercadopagoAmount, setMercadopagoAmount] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const parsedCash = parseFloat(cashAmount) || 0;
  const parsedCard = parseFloat(cardAmount) || 0;
  const parsedMercadopago = parseFloat(mercadopagoAmount) || 0;
  const enteredTotal = paymentMethod === "mixed" ? parsedCash + parsedCard + parsedMercadopago : parsedCash;
  const change =
    paymentMethod === "cash" && parsedCash >= total
      ? Math.round((parsedCash - total) * 100) / 100
      : paymentMethod === "mixed" && enteredTotal >= total
        ? Math.round((parsedCash - (total - parsedCard - parsedMercadopago)) * 100) / 100
        : 0;

  function resetState() {
    setPaymentMethod(null);
    setModo("interno");
    setCashAmount("");
    setCardAmount("");
    setMercadopagoAmount("");
    setError(null);
    setBusy(false);
  }

  function handlePaymentSelect(method: "cash" | "card" | "mixed" | "credit" | "mercadopago") {
    setPaymentMethod(method);
    setError(null);
    if (method === "card") {
      setCashAmount("");
      setCardAmount("");
    }
    if (method === "cash") {
      setCardAmount("");
    }
    if (method === "mixed") {
      setCashAmount("");
      setCardAmount("");
      setMercadopagoAmount("");
    }
  }

  async function handleConfirm() {
    if (isEmpty) {
      setError("El carrito está vacío");
      return;
    }
    if (!paymentMethod) {
      setError("Seleccioná un método de pago");
      return;
    }

    if (!selectedComprobanteTipo) {
      setError("Seleccioná un tipo de comprobante antes de cobrar");
      return;
    }

    if (paymentMethod === "cash" && parsedCash < total) {
      setError(`Pago insuficiente: ${formatCurrency(parsedCash)} es menor al total de ${formatCurrency(total)}`);
      return;
    }

    if (paymentMethod === "mixed") {
      if (parsedCard <= 0 && parsedCash <= 0 && parsedMercadopago <= 0) {
        setError("Ingresá al menos un monto en efectivo, tarjeta o Mercado Pago");
        return;
      }
      if (enteredTotal < total) {
        setError(`Total ingresado: ${formatCurrency(enteredTotal)} — faltan ${formatCurrency(total - enteredTotal)}`);
        return;
      }
    }

    setBusy(true);
    setError(null);

    try {
      if (paymentMethod === "mixed") {
        await checkout("mixed", total, storeId, selectedCustomer?.name, parsedCash, parsedCard, parsedMercadopago, modo);
      } else if (paymentMethod === "credit") {
        await checkout("credit", total, storeId, selectedCustomer?.name, undefined, undefined, undefined, modo);
      } else if (paymentMethod === "mercadopago") {
        await checkout("mercadopago", total, storeId, selectedCustomer?.name, undefined, undefined, undefined, modo);
      } else {
        await checkout(
          paymentMethod,
          paymentMethod === "cash" ? parsedCash : undefined,
          storeId,
          selectedCustomer?.name,
          undefined,
          undefined,
          undefined,
          modo,
        );
      }
      // Sale completed — only now close the modal and let the receipt show.
      resetState();
      onComplete();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al procesar el pago. Intentá de nuevo.",
      );
      setBusy(false);
    }
  }

  function handleCancel() {
    resetState();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-pos-surface rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-pos-text">Cobrar</h2>
            <button
              onClick={handleCancel}
              className="text-pos-muted text-xl leading-none touch-target w-10 h-10 flex items-center justify-center rounded-lg hover:bg-pos-background transition-colors"
              aria-label="Cerrar cobro"
            >
              ✕
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-pos-danger/10 border border-pos-danger/30 text-pos-danger text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          {/* Items summary */}
          <div>
            <h3 className="text-xs font-semibold text-pos-muted uppercase tracking-wide mb-2">
              Productos ({items.length})
            </h3>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {items.map((item) => (
                <div
                  key={item.productId}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-pos-text truncate flex-1 mr-2">
                    {item.saleUnit !== "unit"
                      ? item.quantity >= 1000
                        ? `${(item.quantity / 1000).toFixed(3)} kg`
                        : `${item.quantity} g`
                      : `${item.quantity}x`} {item.productName}
                  </span>
                  <span className="font-mono text-pos-muted">
                    {formatCurrency(item.subtotal)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Selected customer */}
          {selectedCustomer && (
            <div className="flex items-center justify-between text-sm bg-pos-background/50 rounded-lg px-3 py-2">
              <span className="text-pos-muted">Cliente</span>
              <span className="font-medium text-pos-text">
                {selectedCustomer.name}
              </span>
            </div>
          )}

          {/* Comprobante selector */}
          <div>
            <h3 className="text-xs font-semibold text-pos-muted uppercase tracking-wide mb-2">Comprobante</h3>
            <div className="flex items-center gap-1.5 flex-wrap">
              {(["ticket", "boleta", "factura"] as ComprobanteTipo[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setSelectedComprobanteTipo(selectedComprobanteTipo === t ? null : t);
                    if (t === "ticket") setModo("interno");
                  }}
                  className={`text-xs px-2.5 py-1.5 rounded-lg font-medium touch-target transition-all ${
                    selectedComprobanteTipo === t
                      ? "bg-pos-secondary text-white"
                      : "border border-pos-muted/20 text-pos-muted hover:border-pos-secondary hover:text-pos-text"
                  }`}
                >
                  {getTipoLabel(t)}
                </button>
              ))}
              {selectedComprobanteTipo && (
                <button
                  type="button"
                  onClick={() => setSelectedComprobanteTipo(null)}
                  className="text-xs text-pos-muted hover:text-pos-danger ml-1"
                >
                  ✕
                </button>
              )}
            </div>
            {!selectedComprobanteTipo && (
              <p className="text-[10px] text-pos-muted mt-1">Ninguno — solo venta</p>
            )}
          </div>

          {/* Modo de facturación — AFIP o interno (solo factura y boleta; el ticket es siempre interno) */}
          {(selectedComprobanteTipo === "factura" || selectedComprobanteTipo === "boleta") && (
            <div>
              <h3 className="text-xs font-semibold text-pos-muted uppercase tracking-wide mb-2">Facturar</h3>
              <div className="flex items-center gap-3 flex-wrap">
                <label className="flex items-center gap-1.5 text-sm text-pos-text cursor-pointer touch-target">
                  <input type="radio" name="pos-modo-facturacion" checked={modo === "afip"} onChange={() => setModo("afip")} className="accent-pos-secondary" />
                  AFIP
                </label>
                <label className="flex items-center gap-1.5 text-sm text-pos-text cursor-pointer touch-target">
                  <input type="radio" name="pos-modo-facturacion" checked={modo === "interno"} onChange={() => setModo("interno")} className="accent-pos-secondary" />
                  Interno
                </label>
                {modo === "afip" && (
                  <span className="text-[10px] text-pos-muted">Se pedirá el CAE real al webservice de AFIP</span>
                )}
              </div>
            </div>
          )}

          {/* Discount */}
          <div className="bg-pos-background/30 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-pos-muted">Subtotal</span>
              <span className="text-sm font-mono">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="global-discount" className="text-xs font-medium text-pos-muted whitespace-nowrap">
                Descuento %
              </label>
              <input
                id="global-discount"
                type="text"
                inputMode="numeric"
                value={discountDraft}
                onChange={(e) => {
                  const raw = e.target.value;
                  // Allow empty or digits only
                  if (raw === "") {
                    setDiscountDraft("");
                    setGlobalDiscount(0);
                    return;
                  }
                  if (/^\d+$/.test(raw)) {
                    const clamped = Math.min(100, parseInt(raw, 10));
                    setDiscountDraft(String(clamped));
                    setGlobalDiscount(clamped);
                  }
                }}
                onFocus={(e) => e.target.select()}
                className="w-16 border border-pos-muted/30 rounded-lg px-2 py-1 text-sm text-right font-mono focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target bg-pos-surface [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              {discountAmount > 0 && (
                <span className="text-xs text-pos-danger font-medium">−{formatCurrency(discountAmount)}</span>
              )}
            </div>
            {comboInfo && comboInfo.combos.length > 0 && (
              <div className="space-y-1">
                {comboInfo.combos.map((c) => (
                  <div key={c.comboId} className="flex items-center justify-between text-xs">
                    <span className="text-pos-secondary font-medium">
                      {c.times > 1 ? `${c.times}x ` : ""}Combo: {c.name}
                    </span>
                    <span className="text-pos-secondary font-mono">−{formatCurrency(c.totalSavings)}</span>
                  </div>
                ))}
              </div>
            )}
            {comboInfo && comboInfo.bultos && comboInfo.bultos.length > 0 && (
              <div className="space-y-1">
                {comboInfo.bultos.map((b) => (
                  <div key={b.bultoId} className="flex items-center justify-between text-xs">
                    <span className="text-pos-secondary font-medium">
                      {b.times > 1 ? `${b.times}x ` : ""}Bulto: {b.name}
                    </span>
                    <span className="text-pos-secondary font-mono">−{formatCurrency(b.totalSavings)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Total */}
          <div className="flex items-center justify-between pt-2 border-t border-pos-muted/20">
            <span className="text-base font-bold text-pos-text">Total</span>
            <span className="text-xl font-bold font-mono text-pos-secondary">
              {formatCurrency(total)}
            </span>
          </div>

          {/* Price list selector */}
          <div>
            <h3 className="text-xs font-semibold text-pos-muted uppercase tracking-wide mb-2">
              Lista de Precios
            </h3>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setSelectedPriceListId(null)}
                className={`text-xs px-2.5 py-1.5 rounded-lg font-medium touch-target transition-all ${
                  selectedPriceListId == null
                    ? "bg-pos-muted/20 text-pos-text border border-pos-muted/30"
                    : "border border-pos-muted/20 text-pos-muted hover:border-pos-muted/40 hover:text-pos-text"
                }`}
              >
                Ninguna
              </button>
              {priceLists.map((list) => {
                const active = selectedPriceListId === list.id;
                return (
                  <button
                    key={list.id}
                    type="button"
                    onClick={() => setSelectedPriceListId(active ? null : list.id)}
                    className={`text-xs px-2.5 py-1.5 rounded-lg font-medium touch-target transition-all ${
                      active
                        ? "bg-pos-secondary text-white"
                        : "border border-pos-muted/20 text-pos-muted hover:border-pos-secondary hover:text-pos-secondary"
                    }`}
                  >
                    {list.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Payment method selection */}
          {!paymentMethod && (
            <div>
              <h3 className="text-xs font-semibold text-pos-muted uppercase tracking-wide mb-2">
                Método de pago
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <button
                  onClick={() => handlePaymentSelect("cash")}
                  className="flex flex-col items-center justify-center py-4 px-1 border-2 border-pos-muted/20 rounded-xl touch-target hover:border-pos-secondary hover:bg-pos-secondary/5 transition-all"
                >
                  <svg className="w-7 h-7 mb-1" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <rect x="2" y="6" width="20" height="12" rx="2" />
                    <circle cx="12" cy="12" r="2" />
                    <path d="M6 12h.01" />
                    <path d="M18 12h.01" />
                  </svg>
                  <span className="text-xs font-semibold text-pos-text">
                    Efectivo
                  </span>
                </button>
                <button
                  onClick={() => handlePaymentSelect("card")}
                  className="flex flex-col items-center justify-center py-4 px-1 border-2 border-pos-muted/20 rounded-xl touch-target hover:border-pos-secondary hover:bg-pos-secondary/5 transition-all"
                >
                  <svg className="w-7 h-7 mb-1" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <rect x="1" y="4" width="22" height="16" rx="2" />
                    <line x1="1" y1="10" x2="23" y2="10" />
                  </svg>
                  <span className="text-xs font-semibold text-pos-text">
                    Tarjeta
                  </span>
                </button>
                <button
                  onClick={() => handlePaymentSelect("mercadopago")}
                  className="flex flex-col items-center justify-center py-4 px-1 border-2 border-pos-muted/20 rounded-xl touch-target hover:border-[#00a1e0] hover:bg-[#e5f6ff] transition-all"
                >
                  <svg className="w-7 h-7 mb-1" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.9 6.5c.2 0 .4.08.55.22.15.15.22.34.22.55v4.46c0 .22-.08.4-.22.55-.15.15-.34.22-.55.22h-1.1c-.22 0-.4-.08-.55-.22-.15-.15-.22-.34-.22-.55v-1.8L12.9 14.5c-.15.15-.34.22-.55.22h-.7c-.22 0-.4-.08-.55-.22L9.2 12.38v1.8c0 .22-.08.4-.22.55-.15.15-.34.22-.55.22h-1.1c-.22 0-.4-.08-.55-.22-.15-.15-.22-.34-.22-.55V9.27c0-.22.08-.4.22-.55.15-.15.34-.22.55-.22h.92c.22 0 .4.08.55.22L12 12.15l2.22-2.88c.15-.15.34-.22.55-.22h1.13z" fill="#00a1e0"/>
                  </svg>
                  <span className="text-xs font-semibold text-[#00a1e0]">
                    Mercado Pago
                  </span>
                </button>
                <button
                  onClick={() => handlePaymentSelect("mixed")}
                  className="flex flex-col items-center justify-center py-4 px-1 border-2 border-pos-muted/20 rounded-xl touch-target hover:border-pos-secondary hover:bg-pos-secondary/5 transition-all"
                >
                  <svg className="w-7 h-7 mb-1" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <polyline points="17 1 21 5 17 9" />
                    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                    <polyline points="7 23 3 19 7 15" />
                    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                  </svg>
                  <span className="text-xs font-semibold text-pos-text">
                    Mixto
                  </span>
                </button>
                <button
                  onClick={() => handlePaymentSelect("credit")}
                  disabled={!selectedCustomer}
                  className={`flex flex-col items-center justify-center py-4 px-1 border-2 rounded-xl touch-target transition-all ${
                    !selectedCustomer
                      ? "border-pos-muted/10 opacity-40 cursor-not-allowed"
                      : "border-pos-muted/20 hover:border-pos-secondary hover:bg-pos-secondary/5"
                  }`}
                >
                  <svg className="w-7 h-7 mb-1" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  </svg>
                  <span className="text-xs font-semibold text-pos-text">
                    Cta. Corriente
                  </span>
                </button>
              </div>
              {!selectedCustomer && paymentMethod === null && (
                <p className="text-xs text-pos-muted text-center -mt-2">
                  Seleccioná un cliente para usar cuenta corriente
                </p>
              )}
            </div>
          )}

          {/* Cash amount input */}
          {paymentMethod === "cash" && (
            <div>
              <h3 className="text-xs font-semibold text-pos-muted uppercase tracking-wide mb-2">
                Pago en efectivo
              </h3>
              <div className="space-y-3">
                  <NumberInput
                    value={parseFloat(cashAmount) || 0}
                    onChange={(n) => setCashAmount(n.toString())}
                    placeholder="Monto recibido"
                    decimals={2}
                    aria-label="Monto recibido en efectivo"
                    className="w-full border border-pos-muted/30 rounded-xl px-4 py-3 text-lg font-mono font-bold text-center focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target bg-pos-background"
                    autoFocus
                  />

                {parsedCash >= total && parsedCash > 0 && (
                  <div className="flex items-center justify-between bg-pos-success/10 border border-pos-success/20 rounded-xl px-4 py-3">
                    <span className="text-sm font-semibold text-pos-success">
                      Vuelto
                    </span>
                    <span className="text-lg font-bold font-mono text-pos-success">
                      {formatCurrency(change)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Mixed payment inputs */}
          {paymentMethod === "mixed" && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-pos-muted uppercase tracking-wide mb-2">
                Pago Mixto
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label htmlFor="mixed-cash-input" className="block text-[10px] text-pos-muted mb-1">💵 Efectivo</label>
                  <NumberInput
                    id="mixed-cash-input"
                    value={parseFloat(cashAmount) || 0}
                    onChange={(n) => setCashAmount(n.toString())}
                    placeholder="0,00"
                    decimals={2}
                    className="w-full border border-pos-muted/30 rounded-xl px-2 py-2 text-base font-mono text-center focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target bg-pos-background"
                  />
                </div>
                <div>
                  <label htmlFor="mixed-card-input" className="block text-[10px] text-pos-muted mb-1">💳 Tarjeta</label>
                  <NumberInput
                    id="mixed-card-input"
                    value={parseFloat(cardAmount) || 0}
                    onChange={(n) => setCardAmount(n.toString())}
                    placeholder="0,00"
                    decimals={2}
                    className="w-full border border-pos-muted/30 rounded-xl px-2 py-2 text-base font-mono text-center focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target bg-pos-background"
                  />
                </div>
                <div>
                  <label htmlFor="mixed-mp-input" className="block text-[10px] text-pos-muted mb-1">🧾 M. Pago</label>
                  <NumberInput
                    id="mixed-mp-input"
                    value={parseFloat(mercadopagoAmount) || 0}
                    onChange={(n) => setMercadopagoAmount(n.toString())}
                    placeholder="0,00"
                    decimals={2}
                    className="w-full border border-pos-muted/30 rounded-xl px-2 py-2 text-base font-mono text-center focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target bg-pos-background"
                  />
                </div>
              </div>
              {enteredTotal > 0 && (
                <div className="flex items-center justify-between text-sm bg-pos-background/50 rounded-xl px-3 py-2">
                  <span className="text-pos-muted">Total ingresado</span>
                  <span className={`font-mono font-bold ${enteredTotal >= total ? "text-pos-success" : "text-pos-danger"}`}>
                    {formatCurrency(enteredTotal)}
                  </span>
                </div>
              )}
              {enteredTotal > total && (parsedCard > 0 || parsedMercadopago > 0) && (
                <div className="flex items-center justify-between bg-pos-success/10 border border-pos-success/20 rounded-xl px-4 py-3">
                  <span className="text-sm font-semibold text-pos-success">Vuelto (efectivo)</span>
                  <span className="text-lg font-bold font-mono text-pos-success">
                    {formatCurrency(change)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Credit indicator */}
          {paymentMethod === "credit" && selectedCustomer && (
            <div className="bg-pos-accent/10 border border-pos-accent/20 rounded-xl px-4 py-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium text-pos-accent">Cuenta Corriente</p>
                <span className="text-sm font-mono font-bold">{formatCurrency(total)}</span>
              </div>
              <p className="text-xs text-pos-muted">
                Se suma a la cuenta de <span className="font-semibold text-pos-text">{liveCustomer!.name}</span>
              </p>
              <p className="text-xs text-pos-danger mt-1">
                Saldo actual: {formatCurrency(liveCustomer?.creditBalance ?? 0)}
              </p>
            </div>
          )}

          {/* Card indicator */}
          {paymentMethod === "card" && (
            <div className="bg-pos-secondary/10 border border-pos-secondary/20 rounded-xl px-4 py-3 text-center">
              <p className="text-sm text-pos-secondary font-medium">
                Pago con tarjeta seleccionado
              </p>
              <p className="text-xs text-pos-muted mt-1">
                Tocá "Confirmar" para completar la venta
              </p>
            </div>
          )}

          {/* Mercado Pago indicator */}
          {paymentMethod === "mercadopago" && (
            <div className="bg-[#e5f6ff] border border-[#00a1e0]/30 rounded-xl px-4 py-3 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.9 6.5c.2 0 .4.08.55.22.15.15.22.34.22.55v4.46c0 .22-.08.4-.22.55-.15.15-.34.22-.55.22h-1.1c-.22 0-.4-.08-.55-.22-.15-.15-.22-.34-.22-.55v-1.8L12.9 14.5c-.15.15-.34.22-.55.22h-.7c-.22 0-.4-.08-.55-.22L9.2 12.38v1.8c0 .22-.08.4-.22.55-.15.15-.34.22-.55.22h-1.1c-.22 0-.4-.08-.55-.22-.15-.15-.22-.34-.22-.55V9.27c0-.22.08-.4.22-.55.15-.15.34-.22.55-.22h.92c.22 0 .4.08.55.22L12 12.15l2.22-2.88c.15-.15.34-.22.55-.22h1.13z" fill="#00a1e0"/>
                </svg>
                <p className="text-sm font-semibold text-[#00a1e0]">
                  Mercado Pago
                </p>
              </div>
              <p className="text-xs text-[#0090c8]">
                Mostrá el código QR al cliente para que escanee con la app
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleCancel}
              className="flex-1 px-4 py-3 border border-pos-muted/30 text-pos-text rounded-xl font-medium text-sm touch-target hover:bg-pos-background transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={busy || !paymentMethod}
              className="flex-1 px-4 py-3 bg-pos-accent text-white rounded-xl font-bold text-sm touch-target hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy
                ? "Procesando…"
                : `Confirmar — ${formatCurrency(total)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
