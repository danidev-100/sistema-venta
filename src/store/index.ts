import { create } from "zustand";
import { useProductsStore } from "./products";
import { useCustomersStore, type Customer } from "./customers";
import { useAuthStore } from "./auth";
import { useComprobantesStore, type ComprobanteTipo } from "./comprobantes";
import { useCombosStore } from "./combos";
import { useBultosStore } from "./bultos";
import { detectActiveCombos, type ComboMatch } from "@/lib/combos";
import { detectActiveBultos, type BultoMatch } from "@/lib/bultos";
import { api } from "@/lib/api";

// ──────────────────────────────────────────────
// Page navigation enum (no React Router)
// ──────────────────────────────────────────────

export type Page =
  | "pos"
  | "products"
  | "cash-closing"
  | "billing"
  | "stats"
  | "admin"
  | "customers"
  | "dashboard"
  | "expenses"
  | "login"
  | "user-management"
  | "proveedores"
  | "pedidos"
  | "comprobantes";

// ──────────────────────────────────────────────
// Cart item
// ──────────────────────────────────────────────

export type CartItem = {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  discountPercent: number; // 0–100, per-item discount
  saleUnit: "unit" | "gram" | "kilogram";
};

// ──────────────────────────────────────────────
// Completed sale record
// ──────────────────────────────────────────────

export type CompletedSale = {
  id: number;
  items: CartItem[];
  total: number;
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  paymentMethod: "cash" | "card" | "mixed" | "credit" | "mercadopago";
  amountPaid: number | null;
  cashAmount: number | null;
  cardAmount: number | null;
  mercadopagoAmount: number | null;
  change: number | null;
  date: string;
  storeId: string;
  customerName: string | null;
  createdBy: string;
  status: "completed" | "refunded";
  priceListId: number | null;
};

// ──────────────────────────────────────────────
// UI state slice
// ──────────────────────────────────────────────

export type UiState = {
  /** Currently visible page. */
  page: Page;
  /** Whether a checkout or sync operation is in progress. */
  busy: boolean;
  /** Toast / notification text, or null when idle. */
  notification: string | null;
};

export type AppliedComboInfo = {
  combos: Array<{ comboId: number; name: string; times: number; savingsPerSet: number; totalSavings: number }>;
  bultos: Array<{ bultoId: number; name: string; times: number; savingsPerSet: number; totalSavings: number }>;
  totalSavings: number;
};

// ──────────────────────────────────────────────
// Cart state slice
// ──────────────────────────────────────────────

export type CartState = {
  items: CartItem[];
};

// ──────────────────────────────────────────────
// Combined store shape
// ──────────────────────────────────────────────

export type AppStore = {
  // ── Navigation ──
  page: Page;
  setPage: (p: Page) => void;

  // ── UI ──
  busy: boolean;
  setBusy: (b: boolean) => void;
  notification: string | null;
  showNotification: (msg: string) => void;
  dismissNotification: () => void;

  // ── Cart ──
  items: CartItem[];
  addItem: (productId: number, name: string, price: number, quantity?: number, saleUnit?: "unit" | "gram" | "kilogram") => void;
  setItemDiscount: (productId: number, discountPercent: number) => void;
  updateQuantity: (productId: number, qty: number) => void;
  removeItem: (productId: number) => void;
  clearCart: () => void;
  cartTotal: () => number;
  itemCount: () => number;
  getComboInfo: () => AppliedComboInfo | null;

  // ── Cart selection (keyboard shortcuts) ──
  selectedCartItemId: number | null;
  selectCartItem: (productId: number) => void;
  clearSelectedCartItem: () => void;

  // ── Customer selection ──
  selectedCustomer: Customer | null;
  selectCustomer: (customer: Customer | null) => void;

  // ── Discount ──
  globalDiscountPercent: number;
  setGlobalDiscount: (percent: number) => void;

  // ── Comprobante ──
  selectedComprobanteTipo: ComprobanteTipo | null;
  setSelectedComprobanteTipo: (tipo: ComprobanteTipo | null) => void;

  // ── Price List ──
  selectedPriceListId: number | null;
  setSelectedPriceListId: (id: number | null) => void;

  // ── Sales ──
  lastCompletedSale: CompletedSale | null;
  completedSales: CompletedSale[];
  checkout: (
    paymentMethod: "cash" | "card" | "mixed" | "credit" | "mercadopago",
    amountPaid?: number,
    storeId?: string,
    customerName?: string,
    cashAmount?: number,
    cardAmount?: number,
    mercadopagoAmount?: number,
  ) => Promise<CompletedSale>;
  refundSale: (saleId: number) => Promise<void>;
  dismissReceipt: () => void;
};

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function calcSubtotal(qty: number, price: number): number {
  return Math.round(qty * price * 100) / 100;
}

function computeComboInfo(items: CartItem[]): AppliedComboInfo | null {
  if (items.length === 0) return null;
  const products = useProductsStore.getState().products;
  if (products.length === 0) return null;

  // ── Detect combos ──
  const combos = useCombosStore.getState().combos;
  let picked: ComboMatch[] = [];
  if (combos.length > 0) {
    const matches = detectActiveCombos(items, combos, products);
    const sorted = [...matches].sort((a, b) => b.totalSavings - a.totalSavings);
    const usedProductIds = new Set<number>();

    for (const match of sorted) {
      const combo = combos.find((c) => c.id === match.comboId);
      if (!combo) continue;
      const productIds = new Set(combo.items.map((i) => i.productId));
      const overlaps = [...productIds].some((pid) => usedProductIds.has(pid));
      if (!overlaps) {
        picked.push(match);
        productIds.forEach((pid) => usedProductIds.add(pid));
      }
    }
  }

  // ── Detect bultos ──
  const bultos = useBultosStore.getState().bultos;
  let bultoMatches: BultoMatch[] = [];
  if (bultos.length > 0) {
    bultoMatches = detectActiveBultos(items, bultos, products);
  }

  const hasCombos = picked.length > 0;
  const hasBultos = bultoMatches.length > 0;
  if (!hasCombos && !hasBultos) return null;

  const comboSavings = picked.reduce((sum, m) => sum + m.totalSavings, 0);
  const bultoSavings = bultoMatches.reduce((sum, m) => sum + m.totalSavings, 0);

  return {
    combos: picked.map((m) => ({
      comboId: m.comboId,
      name: m.comboName,
      times: m.times,
      savingsPerSet: m.savingsPerSet,
      totalSavings: m.totalSavings,
    })),
    bultos: bultoMatches.map((m) => ({
      bultoId: m.bultoId,
      name: m.bultoName,
      times: m.times,
      savingsPerSet: m.savingsPerSet,
      totalSavings: m.totalSavings,
    })),
    totalSavings: Math.round((comboSavings + bultoSavings) * 100) / 100,
  };
}

// ──────────────────────────────────────────────
// Store factory
// ──────────────────────────────────────────────

export const useAppStore = create<AppStore>((set, get) => ({
  // ── Defaults ──
  page: "pos",
  busy: false,
  notification: null,
  items: [],
  lastCompletedSale: null,
  completedSales: [],
  selectedCustomer: null,
  selectedCartItemId: null,
  globalDiscountPercent: 0,
  selectedComprobanteTipo: null,
  selectedPriceListId: null,

  // ── Navigation ──
  setPage: (page) => set({ page }),

  // ── Discount ──
  setGlobalDiscount: (percent) => set({ globalDiscountPercent: Math.max(0, Math.min(100, percent)) }),

  // ── Comprobante ──
  setSelectedComprobanteTipo: (tipo) => set({ selectedComprobanteTipo: tipo }),

  // ── Price List ──
  setSelectedPriceListId: (id) => set({ selectedPriceListId: id }),
  setItemDiscount: (productId, discountPercent) => {
    const clamped = Math.max(0, Math.min(100, discountPercent));
    set({
      items: get().items.map((i) =>
        i.productId === productId ? { ...i, discountPercent: clamped } : i,
      ),
    });
  },

  // ── UI ──
  setBusy: (busy) => set({ busy }),
  showNotification: (msg) => set({ notification: msg }),
  dismissNotification: () => set({ notification: null }),

  // ── Cart ──
  addItem: (productId, name, price, quantity, saleUnit) => {
    if (price <= 0) return;

    const resolvedSaleUnit = saleUnit ?? "unit";
    const resolvedQty = quantity ?? (
      resolvedSaleUnit === "unit" ? 1 : 1000
    );

    const { items } = get();

    // Weight items always add a new line (each weight entry is unique)
    if (resolvedSaleUnit !== "unit") {
      set({
        items: [
          ...items,
          {
            productId,
            productName: name,
            quantity: resolvedQty,
            unitPrice: price,
            subtotal: calcSubtotal(resolvedQty / 1000, price),
            discountPercent: 0,
            saleUnit: resolvedSaleUnit,
          },
        ],
      });
      return;
    }

    // Unit items: increment quantity if already in cart
    const existing = items.find((i) => i.productId === productId);
    if (existing) {
      set({
        items: items.map((i) =>
          i.productId === productId
            ? {
                ...i,
                quantity: i.quantity + 1,
                subtotal: calcSubtotal(i.quantity + 1, i.unitPrice),
              }
            : i,
        ),
      });
    } else {
      set({
        items: [
          ...items,
          {
            productId,
            productName: name,
            quantity: 1,
            unitPrice: price,
            subtotal: price,
            discountPercent: 0,
            saleUnit: "unit",
          },
        ],
      });
    }
  },

  updateQuantity: (productId, qty) => {
    const item = get().items.find((i) => i.productId === productId);
    const minQty = item && item.saleUnit !== "unit" ? 10 : 1;
    if (qty < minQty) {
      get().removeItem(productId);
      return;
    }
    const { items } = get();
    set({
      items: items.map((i) =>
        i.productId === productId
          ? {
              ...i,
              quantity: qty,
              subtotal: i.saleUnit !== "unit" ? calcSubtotal(qty / 1000, i.unitPrice) : calcSubtotal(qty, i.unitPrice),
            }
          : i,
      ),
    });
  },

  removeItem: (productId) => {
    set({ items: get().items.filter((i) => i.productId !== productId) });
  },

  clearCart: () => set({ items: [], selectedCartItemId: null }),

  cartTotal: () => {
    const { items, globalDiscountPercent } = get();
    const subtotal = items.reduce((sum, i) => {
      const itemDiscount = i.discountPercent > 0 ? i.subtotal * i.discountPercent / 100 : 0;
      return sum + i.subtotal - itemDiscount;
    }, 0);
    const comboInfo = computeComboInfo(items);
    const afterCombo = comboInfo ? Math.round((subtotal - comboInfo.totalSavings) * 100) / 100 : subtotal;
    const globalDiscount = globalDiscountPercent > 0 ? afterCombo * globalDiscountPercent / 100 : 0;
    const total = Math.round((afterCombo - globalDiscount) * 100) / 100;
    return total;
  },

  getComboInfo: () => computeComboInfo(get().items),

  itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

  // ── Cart Selection ──
  selectCartItem: (productId) => set({ selectedCartItemId: productId }),
  clearSelectedCartItem: () => set({ selectedCartItemId: null }),

  // ── Sales / Checkout ──

  checkout: async (paymentMethod, amountPaid, storeId, customerName, cashAmount, cardAmount, mercadopagoAmount) => {
    const { items, cartTotal, globalDiscountPercent } = get();
    if (items.length === 0) {
      throw new Error("Cannot checkout with an empty cart");
    }

    const total = cartTotal();
    const subtotal = items.reduce((sum, i) => sum + i.subtotal, 0);
    const discountAmount = Math.round((subtotal - total) * 100) / 100;

    let change: number | null = null;
    if (paymentMethod === "cash" && amountPaid != null) {
      change = Math.round((amountPaid - total) * 100) / 100;
      if (amountPaid < total) {
        throw new Error(`Pago insuficiente: $${amountPaid.toFixed(2)} es menor al total de $${total.toFixed(2)}`);
      }
    }
    if (paymentMethod === "mixed") {
      const cash = cashAmount ?? 0;
      const card = cardAmount ?? 0;
      const mp = mercadopagoAmount ?? 0;
      const paid = cash + card + mp;
      if (paid < total) {
        throw new Error(`Total ingresado: $${paid.toFixed(2)} — faltan $${(total - paid).toFixed(2)}`);
      }
      change = Math.round((cash - (total - card - mp)) * 100) / 100;
    }
    if (paymentMethod === "credit") {
      // Sale goes through — customer balance will be increased
    }
    if (paymentMethod === "mercadopago") {
      // Electronic payment — no cash handling needed
    }

    const resolvedStoreId = storeId ?? "store_1";

    const currentUserName = useAuthStore.getState().currentUser?.name ?? "—";
    const resolvedPayment = paymentMethod;
    const paidAmount = paymentMethod === "mixed" ? (cashAmount ?? 0) + (cardAmount ?? 0) + (mercadopagoAmount ?? 0) : paymentMethod === "mercadopago" ? total : (amountPaid ?? null);

    // ── Persist sale via API ──
    const created = await api.post<any>("/sales", {
      items: items.map((i) => ({ ...i })),
      createdBy: currentUserName,
      total,
      subtotal,
      discountPercent: globalDiscountPercent,
      discountAmount,
      paymentMethod: resolvedPayment,
      amountPaid: paidAmount,
      cashAmount: paymentMethod === "mixed" ? (cashAmount ?? 0) : (paymentMethod === "cash" ? amountPaid ?? null : null),
      cardAmount: paymentMethod === "mixed" ? (cardAmount ?? 0) + (mercadopagoAmount ?? 0) : paymentMethod === "card" || paymentMethod === "mercadopago" ? total : null,
      change,
      storeId: resolvedStoreId,
      customerName: customerName ?? null,
      priceListId: get().selectedPriceListId,
    });

    // ── Normalize snake_case API response to the frontend CompletedSale shape ──
    const sale: CompletedSale = {
      id: created.id,
      items: items.map((i) => ({ ...i })),
      total,
      subtotal,
      discountPercent: globalDiscountPercent,
      discountAmount,
      paymentMethod: resolvedPayment,
      amountPaid: paidAmount,
      cashAmount: paymentMethod === "mixed" ? (cashAmount ?? 0) : (paymentMethod === "cash" ? amountPaid ?? null : null),
      cardAmount: paymentMethod === "mixed" ? (cardAmount ?? 0) + (mercadopagoAmount ?? 0) : paymentMethod === "card" || paymentMethod === "mercadopago" ? total : null,
      mercadopagoAmount: mercadopagoAmount ?? null,
      change,
      date: created.created_at ?? new Date().toISOString(),
      storeId: resolvedStoreId,
      customerName: customerName ?? null,
      createdBy: currentUserName,
      status: "completed",
      priceListId: get().selectedPriceListId,
    };

    // ── Record stock movements for each item ──
    // Items with a negative product id are free-sale entries with no real
    // product behind them — skip stock movement entirely.
    const { recordMovement } = useProductsStore.getState();
    for (const item of items) {
      if (item.productId < 0) continue;
      await recordMovement({
        product_id: item.productId,
        type: "sale",
        quantity: item.quantity,
        delta: -item.quantity,
        reference_id: `sale-${sale.id}`,
        user_id: null,
        store_id: sale.storeId,
      });
    }

    // ── Compute combo_id x qty map for sale_items ──
    const comboInfo = computeComboInfo(items);
    const comboMap = new Map<number, { comboId: number; coveredQty: number }>();
    const bultoMap = new Map<number, { bultoId: number; coveredQty: number }>();
    if (comboInfo) {
      for (const c of comboInfo.combos) {
        const combo = useCombosStore.getState().combos.find((co) => co.id === c.comboId);
        if (combo) {
          for (const ci of combo.items) {
            comboMap.set(ci.productId, { comboId: c.comboId, coveredQty: ci.quantity * c.times });
          }
        }
      }
      for (const b of comboInfo.bultos) {
        const bulto = useBultosStore.getState().bultos.find((bl) => bl.id === b.bultoId);
        if (bulto) {
          bultoMap.set(bulto.productId, { bultoId: b.bultoId, coveredQty: bulto.quantity * b.times });
        }
      }
    }

    // ── Generate comprobante if selected ──
    const comprobanteTipo = get().selectedComprobanteTipo;
    let comprobanteId: number | null = null;
    if (comprobanteTipo) {
      const { createComprobante } = useComprobantesStore.getState();
      const comp = await createComprobante({
        tipo: comprobanteTipo,
        payment_method: paymentMethod,
        cliente_nombre: sale.customerName ?? "Consumidor Final",
        created_by: currentUserName,
        store_id: resolvedStoreId,
        sale_id: sale.id,
        subtotal: sale.subtotal,
        total: sale.total,
        iva: 0,
        items: sale.items.map((i) => ({
          product_name: i.productName,
          quantity: i.quantity,
          unit_price: i.unitPrice,
          subtotal: i.subtotal,
          combo_name: comboMap.get(i.productId) != null
            ? (useCombosStore.getState().combos.find((c) => c.id === comboMap.get(i.productId)!.comboId)?.name ?? null)
            : null,
          bulto_name: bultoMap.get(i.productId) != null
            ? (useBultosStore.getState().bultos.find((b) => b.id === bultoMap.get(i.productId)!.bultoId)?.name ?? null)
            : null,
        })),
      });
      comprobanteId = comp.id;
      set({ selectedComprobanteTipo: null });
    }

    // ── Update customer credit balance ──
    if (paymentMethod === "credit" && customerName) {
      const { updateCreditBalance } = useCustomersStore.getState();
      const customer = useCustomersStore.getState().customers.find(
        (c) => c.name === customerName && c.store_id === resolvedStoreId,
      );
      if (customer) {
        await updateCreditBalance(customer.id, total, resolvedStoreId, `Venta #${sale.id}`, sale.id, comprobanteId ?? undefined);
      }
    }

    set({
      items: [],
      lastCompletedSale: sale,
      completedSales: [...get().completedSales, sale],
    });

    return sale;
  },

  refundSale: async (saleId) => {
    const sale = get().completedSales.find((s) => s.id === saleId);
    if (!sale || sale.status === "refunded") return;

    await api.post(`/sales/${saleId}/refund`);

    // Reverse stock movements
    // Negative product ids are free-sale items — no real product to restore.
    const { recordMovement } = useProductsStore.getState();
    for (const item of sale.items) {
      if (item.productId < 0) continue;
      await recordMovement({
        product_id: item.productId,
        type: "adjustment",
        quantity: item.quantity,
        delta: item.quantity,
        reference_id: `refund-${sale.id}`,
        user_id: null,
        store_id: sale.storeId,
      });
    }

    // Mark sale as refunded in memory
    set({
      completedSales: get().completedSales.map((s) =>
        s.id === saleId ? { ...s, status: "refunded" as const } : s,
      ),
    });
  },

  dismissReceipt: () => set({ lastCompletedSale: null }),

  // ── Customer selection ──
  selectCustomer: (customer) => set({ selectedCustomer: customer }),
}));

// Re-export stores for convenience
export { useAdminStore } from "./admin";
export { useAuthStore } from "./auth";
export { useCustomersStore } from "./customers";
export { useBrandsStore } from "./brands";
export { useProductsStore } from "./products";
export { useInvoicesStore } from "./invoices";
export { useCashClosingStore } from "./cash-closing";
export { useProveedoresStore } from "./proveedores";
export { usePedidosStore } from "./pedidos";
export { useComprobantesStore } from "./comprobantes";
export { useExpensesStore } from "./expenses";
export { usePlantillasStore } from "./plantillas";
export { useCompanyStore } from "./company";
export { useCombosStore } from "./combos";
export { useBultosStore } from "./bultos";
export { usePriceListsStore } from "./price-lists";
