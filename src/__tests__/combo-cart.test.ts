import { describe, it, expect, beforeEach } from "vitest";
import { useAppStore } from "@/store/index";
import { useCombosStore } from "@/store/combos";
import { useProductsStore } from "@/store/products";
import { detectActiveCombos } from "@/lib/combos";
import type { Combo } from "@/store/combos";
import type { CartItem } from "@/store/index";
import type { Product } from "@/store/products";

const STORE = "store_1";

function makeProduct(id: number, name: string, price: number): Product {
  return { id, barcode: null, name, price, image: "", stock: 10, minStock: 0, midStock: 0, category_id: null, costPrice: 0, brandId: null, saleUnit: "unit", store_id: STORE };
}

function makeCombo(id: number, name: string, comboPrice: number, items: { productId: number; quantity: number }[]): Combo {
  return { id, name, comboPrice, items, storeId: STORE };
}

beforeEach(() => {
  useAppStore.setState({ items: [], globalDiscountPercent: 0, lastCompletedSale: null });
  useCombosStore.setState({ combos: [] });
  useProductsStore.setState({ products: [] });
});

describe("cartTotal with combos", () => {
  it("returns normal total when no combos exist", () => {
    useProductsStore.setState({ products: [makeProduct(1, "A", 100)] });
    useAppStore.setState({
      items: [{ productId: 1, productName: "A", quantity: 1, unitPrice: 100, subtotal: 100, discountPercent: 0, saleUnit: "unit" }],
    });
    const total = useAppStore.getState().cartTotal();
    expect(total).toBe(100);
  });

  it("applies combo savings when cart fulfills a combo", () => {
    const prodA = makeProduct(1, "A", 100);
    const prodB = makeProduct(2, "B", 200);
    useProductsStore.setState({ products: [prodA, prodB] });
    useCombosStore.setState({
      combos: [makeCombo(1, "A+B", 250, [{ productId: 1, quantity: 1 }, { productId: 2, quantity: 1 }])],
    });
    useAppStore.setState({
      items: [
        { productId: 1, productName: "A", quantity: 1, unitPrice: 100, subtotal: 100, discountPercent: 0, saleUnit: "unit" },
        { productId: 2, productName: "B", quantity: 1, unitPrice: 200, subtotal: 200, discountPercent: 0, saleUnit: "unit" },
      ],
    });
    const total = useAppStore.getState().cartTotal();
    expect(total).toBe(250);
  });

  it("removes combo savings when a combo item is removed", () => {
    const prodA = makeProduct(1, "A", 100);
    const prodB = makeProduct(2, "B", 200);
    useProductsStore.setState({ products: [prodA, prodB] });
    useCombosStore.setState({
      combos: [makeCombo(1, "A+B", 250, [{ productId: 1, quantity: 1 }, { productId: 2, quantity: 1 }])],
    });
    useAppStore.setState({
      items: [
        { productId: 1, productName: "A", quantity: 1, unitPrice: 100, subtotal: 100, discountPercent: 0, saleUnit: "unit" },
      ],
    });
    const total = useAppStore.getState().cartTotal();
    expect(total).toBe(100);
  });

  it("stacks combo savings with global discount", () => {
    const prodA = makeProduct(1, "A", 100);
    const prodB = makeProduct(2, "B", 200);
    useProductsStore.setState({ products: [prodA, prodB] });
    useCombosStore.setState({
      combos: [makeCombo(1, "A+B", 250, [{ productId: 1, quantity: 1 }, { productId: 2, quantity: 1 }])],
    });
    useAppStore.setState({
      items: [
        { productId: 1, productName: "A", quantity: 1, unitPrice: 100, subtotal: 100, discountPercent: 0, saleUnit: "unit" },
        { productId: 2, productName: "B", quantity: 1, unitPrice: 200, subtotal: 200, discountPercent: 0, saleUnit: "unit" },
      ],
      globalDiscountPercent: 10,
    });
    const total = useAppStore.getState().cartTotal();
    expect(total).toBe(225);
  });

  it("stacks per-item discount with combo savings", () => {
    const prodA = makeProduct(1, "A", 100);
    const prodB = makeProduct(2, "B", 200);
    useProductsStore.setState({ products: [prodA, prodB] });
    useCombosStore.setState({
      combos: [makeCombo(1, "A+B", 250, [{ productId: 1, quantity: 1 }, { productId: 2, quantity: 1 }])],
    });
    useAppStore.setState({
      items: [
        { productId: 1, productName: "A", quantity: 1, unitPrice: 100, subtotal: 100, discountPercent: 20, saleUnit: "unit" },
        { productId: 2, productName: "B", quantity: 1, unitPrice: 200, subtotal: 200, discountPercent: 0, saleUnit: "unit" },
      ],
    });
    const total = useAppStore.getState().cartTotal();
    expect(total).toBe(230);
  });
});

describe("getComboInfo", () => {
  it("returns null when no combos match", () => {
    useProductsStore.setState({ products: [makeProduct(1, "A", 100)] });
    useAppStore.setState({
      items: [{ productId: 1, productName: "A", quantity: 1, unitPrice: 100, subtotal: 100, discountPercent: 0, saleUnit: "unit" }],
    });
    expect(useAppStore.getState().getComboInfo()).toBeNull();
  });

  it("returns combo info when combo matches", () => {
    const prodA = makeProduct(1, "A", 100);
    const prodB = makeProduct(2, "B", 200);
    useProductsStore.setState({ products: [prodA, prodB] });
    useCombosStore.setState({
      combos: [makeCombo(1, "A+B", 250, [{ productId: 1, quantity: 1 }, { productId: 2, quantity: 1 }])],
    });
    useAppStore.setState({
      items: [
        { productId: 1, productName: "A", quantity: 1, unitPrice: 100, subtotal: 100, discountPercent: 0, saleUnit: "unit" },
        { productId: 2, productName: "B", quantity: 1, unitPrice: 200, subtotal: 200, discountPercent: 0, saleUnit: "unit" },
      ],
    });
    const info = useAppStore.getState().getComboInfo();
    expect(info).not.toBeNull();
    expect(info!.totalSavings).toBe(50);
    expect(info!.combos[0].name).toBe("A+B");
  });
});
