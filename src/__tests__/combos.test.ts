import { describe, it, expect } from "vitest";
import { detectActiveCombos, calculateComboSavings } from "@/lib/combos";
import type { Combo } from "@/store/combos";
import type { CartItem } from "@/store/index";
import type { Product } from "@/store/products";

const STORE = "store_1";

function makeProduct(id: number, name: string, price: number): Product {
  return { id, barcode: null, name, price, image: "", stock: 10, minStock: 0, midStock: 0, category_id: null, costPrice: 0, brandId: null, saleUnit: "unit", store_id: STORE };
}

function makeCartItem(productId: number, name: string, price: number, quantity: number): CartItem {
  return { productId, productName: name, quantity, unitPrice: price, subtotal: price * quantity, discountPercent: 0, saleUnit: "unit" };
}

function makeCombo(id: number, name: string, comboPrice: number, items: { productId: number; quantity: number }[]): Combo {
  return { id, name, comboPrice, items, storeId: STORE };
}

const prodA = makeProduct(1, "Product A", 100);
const prodB = makeProduct(2, "Product B", 200);
const prodC = makeProduct(3, "Product C", 300);
const prodD = makeProduct(4, "Product D", 400);
const allProducts = [prodA, prodB, prodC, prodD];

const comboAB = makeCombo(1, "Combo A+B", 250, [
  { productId: 1, quantity: 1 },
  { productId: 2, quantity: 1 },
]);

const comboCD = makeCombo(2, "Combo C+D", 600, [
  { productId: 3, quantity: 1 },
  { productId: 4, quantity: 1 },
]);

describe("detectActiveCombos", () => {
  it("returns match when cart fulfills all requirements of a combo", () => {
    const cart = [makeCartItem(1, "Product A", 100, 1), makeCartItem(2, "Product B", 200, 1)];
    const matches = detectActiveCombos(cart, [comboAB], allProducts);
    expect(matches).toHaveLength(1);
    expect(matches[0].comboId).toBe(1);
    expect(matches[0].comboName).toBe("Combo A+B");
    expect(matches[0].comboPrice).toBe(250);
    expect(matches[0].regularTotalPerSet).toBe(300);
    expect(matches[0].savingsPerSet).toBe(50);
    expect(matches[0].times).toBe(1);
    expect(matches[0].totalSavings).toBe(50);
  });

  it("returns no match when only one product of a combo is in cart", () => {
    const cart = [makeCartItem(1, "Product A", 100, 1)];
    const matches = detectActiveCombos(cart, [comboAB], allProducts);
    expect(matches).toHaveLength(0);
  });

  it("returns no match when quantity is insufficient", () => {
    const combo = makeCombo(3, "Qty Combo", 150, [
      { productId: 1, quantity: 3 },
    ]);
    const cart = [makeCartItem(1, "Product A", 100, 2)];
    const matches = detectActiveCombos(cart, [combo], allProducts);
    expect(matches).toHaveLength(0);
  });

  it("returns overlapping combos (caller picks best deal)", () => {
    const comboABcheap = makeCombo(3, "Cheap AB", 200, [
      { productId: 1, quantity: 1 },
      { productId: 2, quantity: 1 },
    ]);
    const cart = [makeCartItem(1, "Product A", 100, 1), makeCartItem(2, "Product B", 200, 1)];
    const matches = detectActiveCombos(cart, [comboAB, comboABcheap], allProducts);
    expect(matches).toHaveLength(2);
  });

  it("returns empty for empty cart", () => {
    const matches = detectActiveCombos([], [comboAB], allProducts);
    expect(matches).toHaveLength(0);
  });

  it("returns empty when no combos are defined", () => {
    const cart = [makeCartItem(1, "Product A", 100, 1)];
    const matches = detectActiveCombos(cart, [], allProducts);
    expect(matches).toHaveLength(0);
  });

  it("handles quantity spread across multiple cart items of same product", () => {
    const combo = makeCombo(4, "Multi-item Combo", 500, [
      { productId: 1, quantity: 3 },
    ]);
    const cart = [
      makeCartItem(1, "Product A", 100, 2),
      makeCartItem(1, "Product A", 100, 1),
    ];
    const matches = detectActiveCombos(cart, [combo], allProducts);
    expect(matches).toHaveLength(1);
    expect(matches[0].comboId).toBe(4);
  });

  it("returns match with times=2 when cart has 2 complete sets", () => {
    const cart = [
      makeCartItem(1, "Product A", 100, 2),
      makeCartItem(2, "Product B", 200, 2),
    ];
    const matches = detectActiveCombos(cart, [comboAB], allProducts);
    expect(matches).toHaveLength(1);
    expect(matches[0].times).toBe(2);
    expect(matches[0].regularTotalPerSet).toBe(300);
    expect(matches[0].savingsPerSet).toBe(50);
    expect(matches[0].totalSavings).toBe(100);
  });

  it("returns match with times=3 when cart has 3 sets but more extra stock", () => {
    const cart = [
      makeCartItem(1, "Product A", 100, 5),
      makeCartItem(2, "Product B", 200, 3),
    ];
    const matches = detectActiveCombos(cart, [comboAB], allProducts);
    expect(matches).toHaveLength(1);
    // Product B limits to 3 sets (B has qty 3, each set needs 1 B)
    expect(matches[0].times).toBe(3);
    expect(matches[0].totalSavings).toBe(150);
  });

  it("returns two matches when cart fulfills two independent combos", () => {
    const cart = [
      makeCartItem(1, "Product A", 100, 1),
      makeCartItem(2, "Product B", 200, 1),
      makeCartItem(3, "Product C", 300, 1),
      makeCartItem(4, "Product D", 400, 1),
    ];
    const matches = detectActiveCombos(cart, [comboAB, comboCD], allProducts);
    expect(matches).toHaveLength(2);
  });
});

describe("calculateComboSavings", () => {
  it("returns the difference between regular total and combo price", () => {
    const savings = calculateComboSavings(comboAB, allProducts);
    expect(savings).toBe(50);
  });
});
