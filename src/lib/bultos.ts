import type { Bulto } from "@/store/bultos";
import type { CartItem } from "@/store/index";
import type { Product } from "@/store/products";

export type BultoMatch = {
  bultoId: number;
  bultoName: string;
  bultoPrice: number;
  regularTotalPerSet: number;
  savingsPerSet: number;
  times: number;
  totalSavings: number;
};

function getCartQuantity(cart: CartItem[], productId: number): number {
  return cart
    .filter((i) => i.productId === productId)
    .reduce((sum, i) => sum + i.quantity, 0);
}

export function detectActiveBultos(
  cart: CartItem[],
  bultos: Bulto[],
  products: Product[],
): BultoMatch[] {
  if (cart.length === 0 || bultos.length === 0) return [];

  const matches: BultoMatch[] = [];

  for (const bulto of bultos) {
    const cartQty = getCartQuantity(cart, bulto.productId);
    if (cartQty < bulto.quantity) continue;

    const times = Math.floor(cartQty / bulto.quantity);
    if (times === 0) continue;

    const product = products.find((p) => p.id === bulto.productId);
    const unitPrice = product?.price ?? 0;
    const regularTotalPerSet = unitPrice * bulto.quantity;
    const savingsPerSet = Math.round((regularTotalPerSet - bulto.bultoPrice) * 100) / 100;
    const totalSavings = Math.round(savingsPerSet * times * 100) / 100;

    matches.push({
      bultoId: bulto.id,
      bultoName: bulto.name,
      bultoPrice: bulto.bultoPrice,
      regularTotalPerSet,
      savingsPerSet,
      times,
      totalSavings,
    });
  }

  return matches;
}
