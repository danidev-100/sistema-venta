// Autoridad del precio en una venta (auditoría P0-1).
//
// Los importes de POST /sales se recalculan desde la base; lo que mandó el
// cliente sólo se compara. Este módulo es puro a propósito: no toca la base,
// así que las reglas de dinero se pueden probar solas.
//
// La aritmética reproduce exactamente la del carrito del POS
// (src/lib/iva.ts, cartTotal() en src/store/index.ts, src/lib/combos.ts y
// src/lib/bultos.ts). Si se despega, una venta legítima empieza a rebotar.

export type SaleTotalsItemInput = {
  /** id del producto en la base; negativo o nulo = venta libre. */
  productId?: number | null;
  productName?: string | null;
  /** Unidades, o gramos cuando saleUnit no es "unit". */
  quantity: number;
  /** Precio unitario que declaró el cliente (se ignora si el producto existe). */
  unitPrice: number;
  /** Descuento del ítem, 0–100. */
  discountPercent?: number | null;
  saleUnit?: string | null;
};

export type ProductPrice = {
  id: number;
  price: number;
};

export type PriceListItem = {
  productId: number;
  price: number | null;
  percentage: number | null;
};

export type ComboRef = {
  id: number;
  comboPrice: number;
  items: { productId: number; quantity: number }[];
};

export type BultoRef = {
  id: number;
  productId: number;
  quantity: number;
  bultoPrice: number;
};

export type IvaSettings = {
  /** Alícuota en porcentaje, por ejemplo 21. */
  alicuota: number;
  /** true = el precio ya incluye IVA. */
  incluido: boolean;
};

/** Lo que el cliente dijo que costaba la venta. */
export type ClaimedTotals = {
  total: number;
  subtotal: number;
  iva: number;
  discountAmount: number;
  /** Descuento global en porcentaje; es el único importe que viene del cliente. */
  discountPercent?: number | null;
};

export type ComputedSaleItem = {
  productId: number | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  discountPercent: number;
  /** subtotal menos el descuento del ítem: la base de combos y descuento global. */
  net: number;
};

export type TotalMismatch = {
  field: "subtotal" | "discountAmount" | "iva" | "total";
  claimed: number;
  expected: number;
  difference: number;
};

export type ExpectedSaleTotals = {
  items: ComputedSaleItem[];
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  iva: number;
  total: number;
  comboDiscount: number;
  bultoDiscount: number;
  mismatches: TotalMismatch[];
};

export type ComputeSaleTotalsInput = {
  items: SaleTotalsItemInput[];
  products: ProductPrice[];
  priceListItems?: PriceListItem[];
  combos?: ComboRef[];
  bultos?: BultoRef[];
  iva: IvaSettings;
  claimed: ClaimedTotals;
};

/**
 * Tolerancia por redondeo: hasta un centavo se considera la misma venta.
 * Un importe inventado se mueve en pesos, no en centavos de redondeo.
 */
export const MONEY_TOLERANCE = 0.01;

const MONEY_FIELDS = ["subtotal", "discountAmount", "iva", "total"] as const;

const r2 = (n: number) => Math.round(n * 100) / 100;

const num = (value: unknown, fallback = 0): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clampPercent = (value: number) => Math.min(100, Math.max(0, value));

/** Mismo criterio que getEffectivePrice() de la lista de precios del POS. */
function effectivePrice(basePrice: number, listItem?: PriceListItem): number {
  if (!listItem) return basePrice;
  if (listItem.price != null) return r2(num(listItem.price));
  if (listItem.percentage != null) return r2(basePrice * (1 + num(listItem.percentage) / 100));
  return basePrice;
}

/**
 * Ahorro de combos, con el mismo criterio que detectActiveCombos(): el combo
 * se arma con la cantidad total por producto y el precio regular sale del
 * precio base del producto (no del precio de la lista).
 */
function comboDiscountFor(
  combos: ComboRef[],
  quantityByProduct: Map<number, number>,
  basePrice: (productId: number) => number | null,
): number {
  if (combos.length === 0 || quantityByProduct.size === 0) return 0;

  const matches: { productIds: Set<number>; totalSavings: number }[] = [];

  for (const combo of combos) {
    if (combo.items.length === 0) continue;

    let times = Infinity;
    let missing = false;
    for (const required of combo.items) {
      const inCart = quantityByProduct.get(required.productId) ?? 0;
      if (inCart < required.quantity) {
        missing = true;
        break;
      }
      times = Math.min(times, Math.floor(inCart / required.quantity));
    }
    if (missing || times === 0 || !Number.isFinite(times)) continue;

    const regularTotalPerSet = combo.items.reduce(
      (sum, required) => sum + (basePrice(required.productId) ?? 0) * required.quantity,
      0,
    );
    const savingsPerSet = r2(regularTotalPerSet - num(combo.comboPrice));
    matches.push({
      productIds: new Set(combo.items.map((i) => i.productId)),
      totalSavings: r2(savingsPerSet * times),
    });
  }

  // El POS aplica primero el combo de mayor ahorro y descarta los que comparten
  // productos, para no descontar dos veces el mismo ítem.
  matches.sort((a, b) => b.totalSavings - a.totalSavings);
  const usedProductIds = new Set<number>();
  let total = 0;
  for (const match of matches) {
    const overlaps = [...match.productIds].some((id) => usedProductIds.has(id));
    if (overlaps) continue;
    match.productIds.forEach((id) => usedProductIds.add(id));
    total += match.totalSavings;
  }

  return r2(total);
}

/** Ahorro de bultos, con el mismo criterio que detectActiveBultos(). */
function bultoDiscountFor(
  bultos: BultoRef[],
  quantityByProduct: Map<number, number>,
  basePrice: (productId: number) => number | null,
): number {
  let total = 0;
  for (const bulto of bultos) {
    const inCart = quantityByProduct.get(bulto.productId) ?? 0;
    if (bulto.quantity <= 0 || inCart < bulto.quantity) continue;

    const times = Math.floor(inCart / bulto.quantity);
    if (times === 0) continue;

    const regularTotalPerSet = (basePrice(bulto.productId) ?? 0) * bulto.quantity;
    const savingsPerSet = r2(regularTotalPerSet - num(bulto.bultoPrice));
    total += r2(savingsPerSet * times);
  }
  return r2(total);
}

/** Mismo criterio que computeIva(): alícuota 0 = sin IVA. */
function ivaFor(net: number, settings: IvaSettings): { iva: number; total: number } {
  const rate = Math.max(0, num(settings.alicuota)) / 100;
  if (rate <= 0) return { iva: 0, total: net };
  if (settings.incluido) {
    const base = r2(net / (1 + rate));
    return { iva: r2(net - base), total: net };
  }
  const iva = r2(net * rate);
  return { iva, total: r2(net + iva) };
}

function compareClaimed(
  claimed: ClaimedTotals,
  expected: { subtotal: number; discountAmount: number; iva: number; total: number },
): TotalMismatch[] {
  const mismatches: TotalMismatch[] = [];
  for (const field of MONEY_FIELDS) {
    const claimedValue = num(claimed[field]);
    const difference = r2(claimedValue - expected[field]);
    if (Math.abs(difference) > MONEY_TOLERANCE + 1e-9) {
      mismatches.push({ field, claimed: claimedValue, expected: expected[field], difference });
    }
  }
  return mismatches;
}

/**
 * Recalcula los totales de una venta desde la base y los compara con los del
 * cliente. `mismatches` vacío = la venta es legítima y se puede guardar.
 */
export function computeSaleTotals(input: ComputeSaleTotalsInput): ExpectedSaleTotals {
  const {
    items,
    products,
    priceListItems = [],
    combos = [],
    bultos = [],
    iva,
    claimed,
  } = input;

  const productsById = new Map(products.map((product) => [product.id, product]));
  const priceListByProduct = new Map(priceListItems.map((row) => [row.productId, row]));

  const basePrice = (productId: number): number | null => {
    const product = productsById.get(productId);
    return product ? num(product.price) : null;
  };

  const computedItems: ComputedSaleItem[] = items.map((raw) => {
    const declaredId = raw.productId == null ? null : num(raw.productId);
    const productId = declaredId != null && declaredId > 0 ? declaredId : null;
    const product = productId != null ? productsById.get(productId) : undefined;

    // Sin producto en la base no hay precio que imponer: se conserva el que
    // mandó el cliente (venta libre). El proyecto ya no descuenta stock ahí.
    const unitPrice = product
      ? effectivePrice(num(product.price), priceListByProduct.get(product.id))
      : num(raw.unitPrice);

    const quantity = num(raw.quantity);
    const saleUnit = raw.saleUnit ?? "unit";
    // Los ítems por peso guardan la cantidad en gramos y el precio por kilo.
    const billedQuantity = saleUnit === "unit" ? quantity : quantity / 1000;
    const subtotal = r2(billedQuantity * unitPrice);
    const discountPercent = clampPercent(num(raw.discountPercent));
    const itemDiscount = discountPercent > 0 ? (subtotal * discountPercent) / 100 : 0;

    return {
      productId: declaredId,
      productName: raw.productName ?? "",
      quantity,
      unitPrice,
      subtotal,
      discountPercent,
      net: subtotal - itemDiscount,
    };
  });

  const quantityByProduct = new Map<number, number>();
  for (const computed of computedItems) {
    if (computed.productId == null || computed.productId <= 0) continue;
    quantityByProduct.set(
      computed.productId,
      (quantityByProduct.get(computed.productId) ?? 0) + computed.quantity,
    );
  }

  const comboDiscount = comboDiscountFor(combos, quantityByProduct, basePrice);
  const bultoDiscount = bultoDiscountFor(bultos, quantityByProduct, basePrice);

  const subtotal = r2(computedItems.reduce((sum, item) => sum + item.subtotal, 0));
  const netAfterItemDiscounts = computedItems.reduce((sum, item) => sum + item.net, 0);
  const totalSavings = r2(comboDiscount + bultoDiscount);
  const afterCombos = r2(netAfterItemDiscounts - totalSavings);

  // El descuento global es decisión del cajero: viaja en el body y se aplica
  // sobre el neto que ya descontó ítems y combos.
  const discountPercent = clampPercent(num(claimed.discountPercent));
  const globalDiscount = discountPercent > 0 ? (afterCombos * discountPercent) / 100 : 0;
  const net = r2(afterCombos - globalDiscount);

  const { iva: ivaAmount, total } = ivaFor(net, iva);
  const discountAmount = r2(subtotal - net);

  return {
    items: computedItems,
    subtotal,
    discountPercent,
    discountAmount,
    iva: ivaAmount,
    total,
    comboDiscount,
    bultoDiscount,
    mismatches: compareClaimed(claimed, { subtotal, discountAmount, iva: ivaAmount, total }),
  };
}
