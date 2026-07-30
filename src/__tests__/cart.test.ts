import { describe, it, expect, beforeEach } from "vitest";
import { useAppStore, type CartItem } from "@/store";

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function resetStore() {
  useAppStore.setState({
    items: [],
    lastCompletedSale: null,
    completedSales: [],
    busy: false,
    notification: null,
  });
}

beforeEach(() => {
  resetStore();
});

// ──────────────────────────────────────────────
// Cart item helpers
// ──────────────────────────────────────────────

function addItemToCart(
  productId: number,
  name: string,
  price: number,
  quantity = 1,
) {
  const store = useAppStore.getState();
  for (let i = 0; i < quantity; i++) {
    store.addItem(productId, name, price);
  }
}

// ──────────────────────────────────────────────
// 3.7 — Cart totals calculation
// ──────────────────────────────────────────────

describe("Cart totals calculation", () => {
  it("returns 0 for an empty cart", () => {
    expect(useAppStore.getState().cartTotal()).toBe(0);
    expect(useAppStore.getState().itemCount()).toBe(0);
  });

  it("calculates total for a single item", () => {
    addItemToCart(1, "Product A", 150);

    const state = useAppStore.getState();
    expect(state.cartTotal()).toBe(150);
    expect(state.itemCount()).toBe(1);
  });

  it("calculates total for multiple items of the same product", () => {
    addItemToCart(1, "Product A", 100, 3);

    const state = useAppStore.getState();
    expect(state.cartTotal()).toBe(300);
    expect(state.itemCount()).toBe(3);
  });

  it("calculates total for multiple different products", () => {
    addItemToCart(1, "Product A", 100);
    addItemToCart(2, "Product B", 200);
    addItemToCart(3, "Product C", 50, 2); // 2 × $50 = $100

    const state = useAppStore.getState();
    expect(state.cartTotal()).toBe(400); // 100 + 200 + 100
    expect(state.itemCount()).toBe(4); // 1 + 1 + 2
  });

  it("handles decimal prices correctly (cent precision)", () => {
    useAppStore.getState().addItem(1, "Product A", 99.99);
    useAppStore.getState().addItem(2, "Product B", 0.01);

    const state = useAppStore.getState();
    expect(state.cartTotal()).toBe(100.0);
  });

  it("does not add a product with zero or negative price", () => {
    useAppStore.getState().addItem(1, "Free Product", 0);
    useAppStore.getState().addItem(2, "Negative Product", -10);

    const state = useAppStore.getState();
    expect(state.items).toHaveLength(0);
    expect(state.cartTotal()).toBe(0);
  });
});

// ──────────────────────────────────────────────
// 3.7 — Quantity updates
// ──────────────────────────────────────────────

describe("Quantity updates", () => {
  it("increments quantity on re-add", () => {
    addItemToCart(1, "Product A", 100);
    addItemToCart(1, "Product A", 100); // increment

    const state = useAppStore.getState();
    expect(state.itemCount()).toBe(2);
    expect(state.items[0].quantity).toBe(2);
    expect(state.items[0].subtotal).toBe(200);
  });

  it("decrements quantity via updateQuantity", () => {
    addItemToCart(1, "Product A", 100, 3);

    useAppStore.getState().updateQuantity(1, 2);

    const state = useAppStore.getState();
    expect(state.items[0].quantity).toBe(2);
    expect(state.items[0].subtotal).toBe(200);
  });

  it("removes item when quantity goes below 1", () => {
    addItemToCart(1, "Product A", 100);

    useAppStore.getState().updateQuantity(1, 0);

    const state = useAppStore.getState();
    expect(state.items).toHaveLength(0);
  });

  it("removes item via removeItem", () => {
    addItemToCart(1, "Product A", 100);
    addItemToCart(2, "Product B", 200);

    useAppStore.getState().removeItem(1);

    const state = useAppStore.getState();
    expect(state.items).toHaveLength(1);
    expect(state.items[0].productId).toBe(2);
  });

  it("recalculates total after quantity change", () => {
    addItemToCart(1, "Product A", 100);
    addItemToCart(2, "Product B", 50);

    useAppStore.getState().updateQuantity(1, 5); // 5 × $100 = $500

    const state = useAppStore.getState();
    expect(state.cartTotal()).toBe(550); // 500 + 50
    expect(state.itemCount()).toBe(6); // 5 + 1
  });

  it("recalculates total after removing an item", () => {
    addItemToCart(1, "Product A", 100);
    addItemToCart(2, "Product B", 200);
    addItemToCart(3, "Product C", 300);

    useAppStore.getState().removeItem(2);

    const state = useAppStore.getState();
    expect(state.cartTotal()).toBe(400); // 100 + 300
    expect(state.items).toHaveLength(2);
  });
});

// ──────────────────────────────────────────────
// 3.7 — Empty cart checkout guard
// ──────────────────────────────────────────────

describe("Empty cart checkout guard", () => {
  it("throws error when checking out with an empty cart", () => {
    expect(() => {
      useAppStore.getState().checkout("cash", 0, "store_1");
    }).toThrow(/empty cart/i);
  });

  it("throws error when checking out with 0 items after clearing", () => {
    addItemToCart(1, "Product A", 100);
    useAppStore.getState().clearCart();

    expect(() => {
      useAppStore.getState().checkout("card", undefined, "store_1");
    }).toThrow(/empty cart/i);
  });

  it("does not throw when cart has items", () => {
    addItemToCart(1, "Product A", 100);

    expect(() => {
      useAppStore.getState().checkout("card", undefined, "store_1");
    }).not.toThrow();
  });
});

// ──────────────────────────────────────────────
// 3.7 — Cash payment change calculation
// ──────────────────────────────────────────────

describe("Cash payment change calculation", () => {
  it("calculates change correctly for exact amount", () => {
    addItemToCart(1, "Product A", 100);
    addItemToCart(2, "Product B", 50);

    const sale = useAppStore.getState().checkout("cash", 150, "store_1");

    expect(sale.change).toBe(0);
    expect(sale.amountPaid).toBe(150);
    expect(sale.total).toBe(150);
  });

  it("calculates change correctly for overpayment", () => {
    addItemToCart(1, "Product A", 100);
    addItemToCart(2, "Product B", 50);

    const sale = useAppStore.getState().checkout("cash", 200, "store_1");

    expect(sale.change).toBe(50);
    expect(sale.amountPaid).toBe(200);
    expect(sale.total).toBe(150);
  });

  it("calculates change correctly for large overpayment", () => {
    addItemToCart(1, "Product A", 550);

    const sale = useAppStore.getState().checkout("cash", 600, "store_1");

    expect(sale.change).toBe(50);
    expect(sale.amountPaid).toBe(600);
    expect(sale.total).toBe(550);
  });

  it("handles cent-level precision in change", () => {
    useAppStore.getState().addItem(1, "Product A", 99.99);

    const sale = useAppStore.getState().checkout("cash", 100, "store_1");

    expect(sale.change).toBe(0.01);
  });

  it("throws an error when payment is less than total", () => {
    addItemToCart(1, "Product A", 550);

    expect(() => {
      useAppStore.getState().checkout("cash", 500, "store_1");
    }).toThrow(/pago insuficiente/i);
  });

  it("throws an error when payment is significantly less than total", () => {
    addItemToCart(1, "Product A", 1000);

    expect(() => {
      useAppStore.getState().checkout("cash", 100, "store_1");
    }).toThrow(/pago insuficiente/i);
  });

  it("has null change for card payments", () => {
    addItemToCart(1, "Product A", 200);

    const sale = useAppStore.getState().checkout("card", undefined, "store_1");

    expect(sale.change).toBeNull();
    expect(sale.amountPaid).toBeNull();
    expect(sale.paymentMethod).toBe("card");
  });
});

// ──────────────────────────────────────────────
// 3.7 — Cart cleared after successful checkout
// ──────────────────────────────────────────────

describe("Cart cleared after successful checkout", () => {
  it("clears cart items after cash checkout", () => {
    addItemToCart(1, "Product A", 100);
    addItemToCart(2, "Product B", 200);

    useAppStore.getState().checkout("cash", 300, "store_1");

    const state = useAppStore.getState();
    expect(state.items).toHaveLength(0);
    expect(state.cartTotal()).toBe(0);
    expect(state.itemCount()).toBe(0);
  });

  it("clears cart items after card checkout", () => {
    addItemToCart(1, "Product A", 100);

    useAppStore.getState().checkout("card", undefined, "store_1");

    const state = useAppStore.getState();
    expect(state.items).toHaveLength(0);
  });

  it("stores the completed sale in lastCompletedSale", () => {
    addItemToCart(1, "Product A", 100);

    const sale = useAppStore.getState().checkout("cash", 100, "store_1");

    const state = useAppStore.getState();
    expect(state.lastCompletedSale).not.toBeNull();
    expect(state.lastCompletedSale?.id).toBe(sale.id);
    expect(state.lastCompletedSale?.total).toBe(100);
    expect(state.lastCompletedSale?.items).toHaveLength(1);
  });

  it("appends to completedSales history", () => {
    addItemToCart(1, "Product A", 100);
    useAppStore.getState().checkout("card", undefined, "store_1");

    addItemToCart(2, "Product B", 50);
    useAppStore.getState().checkout("cash", 50, "store_1");

    const state = useAppStore.getState();
    expect(state.completedSales).toHaveLength(2);
    expect(state.completedSales[0].paymentMethod).toBe("card");
    expect(state.completedSales[1].paymentMethod).toBe("cash");
  });

  it("dismisses the receipt via dismissReceipt", () => {
    addItemToCart(1, "Product A", 100);
    useAppStore.getState().checkout("cash", 100, "store_1");

    useAppStore.getState().dismissReceipt();

    const state = useAppStore.getState();
    expect(state.lastCompletedSale).toBeNull();
    // Sale is still in history
    expect(state.completedSales).toHaveLength(1);
  });

  it("stores store_id in completed sale", () => {
    addItemToCart(1, "Product A", 100);

    const sale = useAppStore.getState().checkout("cash", 100, "store_2");

    expect(sale.storeId).toBe("store_2");
  });
});
