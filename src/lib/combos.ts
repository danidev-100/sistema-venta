import type { Combo } from "@/store/combos";
import type { CartItem } from "@/store/index";
import type { Product } from "@/store/products";

export type ComboMatch = {
  comboId: number;
  comboName: string;
  comboPrice: number;
  regularTotalPerSet: number;
  savingsPerSet: number;
  /** How many complete sets the cart fulfills */
  times: number;
  /** totalSavings = savingsPerSet * times */
  totalSavings: number;
};

function getCartQuantity(cart: CartItem[], productId: number): number {
  return cart
    .filter((i) => i.productId === productId)
    .reduce((sum, i) => sum + i.quantity, 0);
}

export function calculateComboSavings(combo: Combo, products: Product[]): number {
  const regularTotal = combo.items.reduce((sum, item) => {
    const product = products.find((p) => p.id === item.productId);
    return sum + (product ? product.price * item.quantity : 0);
  }, 0);
  return Math.round((regularTotal - combo.comboPrice) * 100) / 100;
}

export function detectActiveCombos(
  cart: CartItem[],
  combos: Combo[],
  products: Product[],
): ComboMatch[] {
  if (cart.length === 0 || combos.length === 0) return [];

  const matches: ComboMatch[] = [];

  for (const combo of combos) {
    // How many complete sets can we form?
    let times = Infinity;
    let anyMissing = false;
    for (const req of combo.items) {
      const cartQty = getCartQuantity(cart, req.productId);
      if (cartQty < req.quantity) { anyMissing = true; break; }
      times = Math.min(times, Math.floor(cartQty / req.quantity));
    }
    if (anyMissing || times === 0 || !isFinite(times)) continue;

    const regularTotalPerSet = combo.items.reduce((sum, item) => {
      const product = products.find((p) => p.id === item.productId);
      return sum + (product ? product.price * item.quantity : 0);
    }, 0);

    const savingsPerSet = Math.round((regularTotalPerSet - combo.comboPrice) * 100) / 100;
    const totalSavings = Math.round(savingsPerSet * times * 100) / 100;

    matches.push({
      comboId: combo.id,
      comboName: combo.name,
      comboPrice: combo.comboPrice,
      regularTotalPerSet,
      savingsPerSet,
      times,
      totalSavings,
    });
  }

  return matches;
}
