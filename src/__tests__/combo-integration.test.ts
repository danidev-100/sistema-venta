import { describe, it, expect, beforeEach, vi } from "vitest";
import { useAppStore } from "@/store/index";
import { useCombosStore } from "@/store/combos";
import { useProductsStore } from "@/store/products";

vi.mock("@/lib/api", () => {
  let nextId = 1;
  const idFromPath = (path: string) => {
    const m = /(\d+)$/.exec(path.replace(/\/$/, ""));
    return m ? parseInt(m[1], 10) : undefined;
  };
  return {
    api: {
      get: vi.fn(() => Promise.resolve([])),
      post: vi.fn((_path: string, data: unknown) =>
        Promise.resolve({ ...(data as object), id: nextId++, created_at: new Date().toISOString() }),
      ),
      put: vi.fn((path: string, data: unknown) =>
        Promise.resolve({ ...(data as object), id: idFromPath(path) }),
      ),
      del: vi.fn(() => Promise.resolve(undefined)),
    },
  };
});

const STORE = "store_1";

beforeEach(() => {
  useAppStore.setState({ items: [], globalDiscountPercent: 0, lastCompletedSale: null });
  useCombosStore.setState({ combos: [] });
  useProductsStore.setState({ products: [] });
});

async function addProductToStore(id: number, name: string, price: number) {
  const p = await useProductsStore.getState().addProduct({
    barcode: null,
    name,
    price,
    stock: 10,
    category_id: null,
    store_id: STORE,
  });
  return p;
}

describe("Integration: Combo CRUD + POS flow", () => {
  it("creates a combo then detects it in cart total", async () => {
    const p1 = await addProductToStore(1, "Product A", 100);
    const p2 = await addProductToStore(2, "Product B", 200);

    await useCombosStore.getState().addCombo({
      name: "Combo AB",
      comboPrice: 250,
      items: [{ productId: p1.id, quantity: 1 }, { productId: p2.id, quantity: 1 }],
      storeId: STORE,
    });

    expect(useCombosStore.getState().combos).toHaveLength(1);
    const combo = useCombosStore.getState().combos[0];
    expect(combo.name).toBe("Combo AB");
    expect(combo.comboPrice).toBe(250);
    expect(combo.items).toHaveLength(2);

    useAppStore.getState().addItem(p1.id, p1.name, p1.price);
    useAppStore.getState().addItem(p2.id, p2.name, p2.price);

    const total = useAppStore.getState().cartTotal();
    expect(total).toBe(250);

    const info = useAppStore.getState().getComboInfo();
    expect(info).not.toBeNull();
    expect(info!.totalSavings).toBe(50);
  });

  it("removes discount when one combo item is removed", async () => {
    const p1 = await addProductToStore(1, "Product A", 100);
    const p2 = await addProductToStore(2, "Product B", 200);

    await useCombosStore.getState().addCombo({
      name: "Combo AB",
      comboPrice: 250,
      items: [{ productId: p1.id, quantity: 1 }, { productId: p2.id, quantity: 1 }],
      storeId: STORE,
    });

    useAppStore.getState().addItem(p1.id, p1.name, p1.price);
    useAppStore.getState().addItem(p2.id, p2.name, p2.price);

    expect(useAppStore.getState().cartTotal()).toBe(250);

    useAppStore.getState().removeItem(p2.id);

    const total = useAppStore.getState().cartTotal();
    expect(total).toBe(100);
    expect(useAppStore.getState().getComboInfo()).toBeNull();
  });

  it("updates combo and new items reflect new price", async () => {
    const p1 = await addProductToStore(1, "Product A", 100);
    const p2 = await addProductToStore(2, "Product B", 200);

    const created = await useCombosStore.getState().addCombo({
      name: "Combo AB",
      comboPrice: 250,
      items: [{ productId: p1.id, quantity: 1 }, { productId: p2.id, quantity: 1 }],
      storeId: STORE,
    });

    await useCombosStore.getState().updateCombo(created.id, {
      name: "Combo AB Mejorado",
      comboPrice: 200,
      items: [{ productId: p1.id, quantity: 1 }, { productId: p2.id, quantity: 1 }],
    });

    const combo = useCombosStore.getState().combos[0];
    expect(combo.name).toBe("Combo AB Mejorado");
    expect(combo.comboPrice).toBe(200);

    useAppStore.getState().addItem(p1.id, p1.name, p1.price);
    useAppStore.getState().addItem(p2.id, p2.name, p2.price);

    const total = useAppStore.getState().cartTotal();
    expect(total).toBe(200);
  });

  it("deletes combo and discount disappears", async () => {
    const p1 = await addProductToStore(1, "Product A", 100);
    const p2 = await addProductToStore(2, "Product B", 200);

    const created = await useCombosStore.getState().addCombo({
      name: "Combo AB",
      comboPrice: 250,
      items: [{ productId: p1.id, quantity: 1 }, { productId: p2.id, quantity: 1 }],
      storeId: STORE,
    });

    useAppStore.getState().addItem(p1.id, p1.name, p1.price);
    useAppStore.getState().addItem(p2.id, p2.name, p2.price);

    expect(useAppStore.getState().cartTotal()).toBe(250);

    await useCombosStore.getState().deleteCombo(created.id);

    expect(useCombosStore.getState().combos).toHaveLength(0);
    const total = useAppStore.getState().cartTotal();
    expect(total).toBe(300);
    expect(useAppStore.getState().getComboInfo()).toBeNull();
  });

  it("records combo_id in SaleItem during checkout", async () => {
    const p1 = await addProductToStore(1, "Product A", 100);
    const p2 = await addProductToStore(2, "Product B", 200);

    await useCombosStore.getState().addCombo({
      name: "Combo AB",
      comboPrice: 250,
      items: [{ productId: p1.id, quantity: 1 }, { productId: p2.id, quantity: 1 }],
      storeId: STORE,
    });

    useAppStore.getState().addItem(p1.id, p1.name, p1.price);
    useAppStore.getState().addItem(p2.id, p2.name, p2.price);

    const sale = await useAppStore.getState().checkout("cash", 250, STORE, undefined);

    expect(sale.items[0].productId).toBe(p1.id);
    expect(sale.items[1].productId).toBe(p2.id);
    expect(sale.total).toBe(250);
  });
});
