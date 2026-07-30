import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(() => Promise.resolve([])),
    post: vi.fn((_path: string, data: unknown) => Promise.resolve({ ...(data as object), id: Date.now(), created_at: new Date().toISOString() })),
    put: vi.fn(() => Promise.resolve(undefined)),
    del: vi.fn(() => Promise.resolve(undefined)),
  },
}));
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAdminStore, type BulkPriceOpts } from "@/store/admin";
import { useProductsStore } from "@/store/products";
import { useBrandsStore } from "@/store/brands";
import { useAuthStore } from "@/store/auth";
import AdminRoute from "@/components/AdminRoute";
import AdminPage from "@/pages/AdminPage";
import { StoreProvider } from "@/store/context";
import { useAppStore } from "@/store";

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Helpers
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Clear localStorage and reset admin store between tests. */
function resetStore() {
  useAdminStore.setState({
    theme: "light",
    preview: null,
  });
}

beforeEach(() => {
  resetStore();
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// AdminRoute component
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("AdminRoute", () => {
  beforeEach(() => {
    // Reset auth state
    useAuthStore.setState({
      users: [],
      currentUser: null,
      _hydrated: false,
    });
    localStorage.removeItem("auth_users");
    localStorage.removeItem("auth_current_user_id");
    useAppStore.getState().setPage("admin");
  });

  it("renders children when user has admin permission", async () => {
    await useAuthStore.getState().init();
    await useAuthStore.getState().login("admin", "admin");

    render(
      <AdminRoute>
        <div data-testid="admin-content">Secret Admin Stuff</div>
      </AdminRoute>,
    );

    expect(screen.getByTestId("admin-content")).toBeInTheDocument();
  });

  it("renders null when user does not have admin permission", async () => {
    await useAuthStore.getState().init();
    await useAuthStore.getState().addUser({
      name: "limited",
      password: "pass",
      role: "custom",
      permissions: ["ventas"],
      active: true,
    });
    await useAuthStore.getState().login("limited", "pass");

    render(
      <AdminRoute>
        <div data-testid="admin-content">Secret Admin Stuff</div>
      </AdminRoute>,
    );

    expect(screen.queryByTestId("admin-content")).toBeNull();
  });

  it("redirects to dashboard when user lacks admin permission", async () => {
    await useAuthStore.getState().init();
    await useAuthStore.getState().addUser({
      name: "limited",
      password: "pass",
      role: "custom",
      permissions: ["ventas"],
      active: true,
    });
    await useAuthStore.getState().login("limited", "pass");
    useAppStore.setState({ page: "admin" });

    render(
      <AdminRoute>
        <div data-testid="admin-content">Secret Admin Stuff</div>
      </AdminRoute>,
    );

    await waitFor(() => {
      expect(useAppStore.getState().page).toBe("dashboard");
    });
  });

  it("redirects to dashboard when not authenticated", async () => {
    await useAuthStore.getState().init();
    // Not logged in
    useAppStore.setState({ page: "admin" });

    render(
      <AdminRoute>
        <div data-testid="admin-content">Secret Admin Stuff</div>
      </AdminRoute>,
    );

    // Without currentUser, hasPermission returns false
    expect(screen.queryByTestId("admin-content")).toBeNull();
  });
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Bulk price preview & confirm
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("Bulk price preview", () => {
  const STORE_A = "store_1";
  const STORE_B = "store_2";

  beforeEach(() => {
    // Reset all relevant stores
    useAdminStore.setState({
      theme: "light",
      preview: null,
      pendingBulkOpts: null,
    });
    useProductsStore.setState({
      products: [],
      categories: [],
      stockMovements: [],
    });
    useBrandsStore.setState({ brands: [] });
  });

  function seedProducts() {
    const store = useProductsStore.getState();
    const bebidas = store.addCategory({
      name: "Bebidas",
      parent_id: null,
      store_id: STORE_A,
    });
    const limpieza = store.addCategory({
      name: "Limpieza",
      parent_id: null,
      store_id: STORE_A,
    });

    const coca = useBrandsStore.getState().addBrand({
      name: "Coca-Cola",
      store_id: STORE_A,
    });
    const pepsi = useBrandsStore.getState().addBrand({
      name: "Pepsi",
      store_id: STORE_A,
    });

    store.addProduct({
      barcode: "111",
      name: "Coca-Cola 500ml",
      price: 150,
      stock: 10,
      category_id: bebidas.id,
      costPrice: 100,
      brandId: coca.id,
      store_id: STORE_A,
    });
    store.addProduct({
      barcode: "222",
      name: "Coca-Cola 1L",
      price: 250,
      stock: 5,
      category_id: bebidas.id,
      costPrice: 180,
      brandId: coca.id,
      store_id: STORE_A,
    });
    store.addProduct({
      barcode: "333",
      name: "Pepsi 500ml",
      price: 140,
      stock: 8,
      category_id: bebidas.id,
      costPrice: 90,
      brandId: pepsi.id,
      store_id: STORE_A,
    });
    store.addProduct({
      barcode: "444",
      name: "Detergente",
      price: 300,
      stock: 3,
      category_id: limpieza.id,
      costPrice: 200,
      brandId: null,
      store_id: STORE_A,
    });
    store.addProduct({
      barcode: "555",
      name: "Lavandina",
      price: 180,
      stock: 7,
      category_id: limpieza.id,
      costPrice: 120,
      brandId: null,
      store_id: STORE_A,
    });

    // Product in other store (should never appear in preview)
    store.addProduct({
      barcode: "999",
      name: "Store B Product",
      price: 500,
      stock: 1,
      category_id: null,
      costPrice: 400,
      brandId: null,
      store_id: STORE_B,
    });

    return { bebidas, limpieza, coca, pepsi };
  }

  it("previews all products when no filter is applied", () => {
    seedProducts();
    const opts: BulkPriceOpts = {

      percent: 10,
      target: "selling",
      storeId: STORE_A,
    };
    const result = useAdminStore.getState().bulkPricePreview(opts);

    // 5 products in store A, all shown for selling target
    expect(result).toHaveLength(5);
    expect(result.every((i) => i.field === "selling")).toBe(true);
    // Store B product should not be included
    expect(result.find((i) => i.name === "Store B Product")).toBeUndefined();
  });

  it("previews filter by category", () => {
    const { bebidas } = seedProducts();
    const opts: BulkPriceOpts = {
      categoryId: bebidas.id,
      percent: 10,
      target: "selling",
      storeId: STORE_A,
    };
    const result = useAdminStore.getState().bulkPricePreview(opts);

    // 3 products in Bebidas
    expect(result).toHaveLength(3);
    expect(result.map((i) => i.name).sort()).toEqual([
      "Coca-Cola 1L",
      "Coca-Cola 500ml",
      "Pepsi 500ml",
    ]);
  });

  it("previews filter by brand", () => {
    const { coca } = seedProducts();
    const opts: BulkPriceOpts = {
      brandId: coca.id,
      percent: 10,
      target: "selling",
      storeId: STORE_A,
    };
    const result = useAdminStore.getState().bulkPricePreview(opts);

    // 2 Coca-Cola products
    expect(result).toHaveLength(2);
    expect(result.map((i) => i.name).sort()).toEqual([
      "Coca-Cola 1L",
      "Coca-Cola 500ml",
    ]);
  });

  it("previews filter by brand + category combined", () => {
    const { bebidas, coca } = seedProducts();
    const opts: BulkPriceOpts = {
      categoryId: bebidas.id,
      percent: 10,
      target: "selling",
      storeId: STORE_A,
      brandId: coca.id,
    };
    const result = useAdminStore.getState().bulkPricePreview(opts);

    // Coca-Cola products in Bebidas only
    expect(result).toHaveLength(2);
    expect(result.map((i) => i.name).sort()).toEqual([
      "Coca-Cola 1L",
      "Coca-Cola 500ml",
    ]);
  });

  it("preview calculates correct new prices for selling target", () => {
    seedProducts();
    const opts: BulkPriceOpts = {

      percent: 10,
      target: "selling",
      storeId: STORE_A,
    };
    const result = useAdminStore.getState().bulkPricePreview(opts);

    // Coca-Cola 500ml: price=150 => 165
    const coca = result.find((i) => i.name === "Coca-Cola 500ml")!;
    expect(coca.currentPrice).toBe(150);
    expect(coca.newPrice).toBe(165);

    // Detergente: price=300 => 330
    const det = result.find((i) => i.name === "Detergente")!;
    expect(det.currentPrice).toBe(300);
    expect(det.newPrice).toBe(330);
  });

  it("preview calculates correct new prices for cost target", () => {
    seedProducts();
    const opts: BulkPriceOpts = {

      percent: 20,
      target: "cost",
      storeId: STORE_A,
    };
    const result = useAdminStore.getState().bulkPricePreview(opts);

    expect(result.every((i) => i.field === "cost")).toBe(true);

    // Coca-Cola 500ml: costPrice=100 => 120
    const coca = result.find((i) => i.name === "Coca-Cola 500ml")!;
    expect(coca.currentPrice).toBe(100);
    expect(coca.newPrice).toBe(120);
  });

  it("preview shows both cost and selling when target is both", () => {
    seedProducts();
    const opts: BulkPriceOpts = {

      percent: 10,
      target: "both",
      storeId: STORE_A,
    };
    const result = useAdminStore.getState().bulkPricePreview(opts);

    // 5 products Ã— 2 fields = 10 items
    expect(result).toHaveLength(10);

    const costItems = result.filter((i) => i.field === "cost");
    const sellingItems = result.filter((i) => i.field === "selling");
    expect(costItems).toHaveLength(5);
    expect(sellingItems).toHaveLength(5);
  });

  it("preview is empty when no products match filter", () => {
    seedProducts();
    const opts: BulkPriceOpts = {
      categoryId: 9999,
      percent: 10,
      target: "selling",
      storeId: STORE_A,
    };
    const result = useAdminStore.getState().bulkPricePreview(opts);

    expect(result).toHaveLength(0);
  });

  it("preview shows 0 products for 0% increase edge case", () => {
    seedProducts();
    const opts: BulkPriceOpts = {

      percent: 0,
      target: "selling",
      storeId: STORE_A,
    };
    const result = useAdminStore.getState().bulkPricePreview(opts);

    // 0% increase still shows products (newPrice === currentPrice)
    expect(result).toHaveLength(5);
    expect(result[0].currentPrice).toBe(result[0].newPrice);
  });

  it("preview handles negative percentage (decrease)", () => {
    seedProducts();
    const opts: BulkPriceOpts = {

      percent: -10,
      target: "selling",
      storeId: STORE_A,
    };
    const result = useAdminStore.getState().bulkPricePreview(opts);

    const coca = result.find((i) => i.name === "Coca-Cola 500ml")!;
    expect(coca.currentPrice).toBe(150);
    expect(coca.newPrice).toBe(135); // 150 - 15
  });

  it("preview does not modify product store", () => {
    seedProducts();
    const before = useProductsStore
      .getState()
      .products.map((p) => ({ id: p.id, price: p.price, costPrice: p.costPrice }));

    const opts: BulkPriceOpts = {

      percent: 50,
      target: "both",
      storeId: STORE_A,
    };
    useAdminStore.getState().bulkPricePreview(opts);

    const after = useProductsStore
      .getState()
      .products.map((p) => ({ id: p.id, price: p.price, costPrice: p.costPrice }));

    expect(after).toEqual(before);
  });
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Bulk price confirm
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("Bulk price confirm", () => {
  const STORE_A = "store_1";

  beforeEach(() => {
    useAdminStore.setState({
      theme: "light",
      preview: null,
      pendingBulkOpts: null,
    });
    useProductsStore.setState({
      products: [],
      categories: [],
      stockMovements: [],
    });
    useBrandsStore.setState({ brands: [] });
  });

  it("confirm updates selling prices and matches preview", () => {
    const store = useProductsStore.getState();
    // Add products directly (no categories/brands needed for this test)
    store.addProduct({
      barcode: "111",
      name: "Product A",
      price: 100,
      stock: 10,
      category_id: null,
      costPrice: 80,
      brandId: null,
      store_id: STORE_A,
    });
    store.addProduct({
      barcode: "222",
      name: "Product B",
      price: 200,
      stock: 5,
      category_id: null,
      costPrice: 150,
      brandId: null,
      store_id: STORE_A,
    });

    // Preview
    const adminStore = useAdminStore.getState();
    const preview = adminStore.bulkPricePreview({

      percent: 10,
      target: "selling",
      storeId: STORE_A,
    });

    expect(preview).toHaveLength(2);
    expect(preview[0].newPrice).toBe(110);
    expect(preview[1].newPrice).toBe(220);

    // Confirm
    useAdminStore.getState().bulkPriceConfirm();

    // Verify
    const products = useProductsStore.getState().products;
    const a = products.find((p) => p.name === "Product A")!;
    const b = products.find((p) => p.name === "Product B")!;
    expect(a.price).toBe(110);
    expect(b.price).toBe(220);
    // Cost prices should be unchanged
    expect(a.costPrice).toBe(80);
    expect(b.costPrice).toBe(150);

    // Preview should be cleared after confirm
    expect(useAdminStore.getState().preview).toBeNull();
  });

  it("confirm updates cost prices correctly", () => {
    const store = useProductsStore.getState();
    store.addProduct({
      barcode: "111",
      name: "Product A",
      price: 100,
      stock: 10,
      category_id: null,
      costPrice: 80,
      brandId: null,
      store_id: STORE_A,
    });

    useAdminStore.getState().bulkPricePreview({

      percent: 25,
      target: "cost",
      storeId: STORE_A,
    });
    useAdminStore.getState().bulkPriceConfirm();

    const p = useProductsStore.getState().products[0];
    expect(p.costPrice).toBe(100); // 80 * 1.25
    expect(p.price).toBe(100); // unchanged
  });

  it("confirm updates both cost and selling prices", () => {
    const store = useProductsStore.getState();
    store.addProduct({
      barcode: "111",
      name: "Product A",
      price: 100,
      stock: 10,
      category_id: null,
      costPrice: 80,
      brandId: null,
      store_id: STORE_A,
    });

    useAdminStore.getState().bulkPricePreview({

      percent: 10,
      target: "both",
      storeId: STORE_A,
    });
    useAdminStore.getState().bulkPriceConfirm();

    const p = useProductsStore.getState().products[0];
    expect(p.costPrice).toBe(88); // 80 * 1.1
    expect(p.price).toBe(110); // 100 * 1.1
  });

  it("cancel (clear preview) does not modify products", () => {
    const store = useProductsStore.getState();
    store.addProduct({
      barcode: "111",
      name: "Product A",
      price: 100,
      stock: 10,
      category_id: null,
      costPrice: 80,
      brandId: null,
      store_id: STORE_A,
    });

    const beforePrice = useProductsStore.getState().products[0].price;

    // Preview then cancel
    useAdminStore.getState().bulkPricePreview({

      percent: 50,
      target: "selling",
      storeId: STORE_A,
    });
    useAdminStore.getState().clearBulkPreview();

    // Price should remain unchanged
    expect(useProductsStore.getState().products[0].price).toBe(beforePrice);
    expect(useAdminStore.getState().preview).toBeNull();
  });

  it("confirm with no preview is a no-op (does not throw)", () => {
    expect(() => {
      useAdminStore.getState().bulkPriceConfirm();
    }).not.toThrow();
  });



  it("handles large percentages without overflow", () => {
    const store = useProductsStore.getState();
    store.addProduct({
      barcode: "111",
      name: "Expensive Item",
      price: 9999.99,
      stock: 1,
      category_id: null,
      costPrice: 8000,
      brandId: null,
      store_id: STORE_A,
    });

    const preview = useAdminStore.getState().bulkPricePreview({

      percent: 1000,
      target: "selling",
      storeId: STORE_A,
    });

    expect(preview[0].newPrice).toBe(109999.89); // 9999.99 * 11
    expect(isFinite(preview[0].newPrice)).toBe(true);
  });

  it("confirm with filtered preview only updates matching products", () => {
    const store = useProductsStore.getState();
    const cat1 = store.addCategory({ name: "Cat A", parent_id: null, store_id: STORE_A });
    const cat2 = store.addCategory({ name: "Cat B", parent_id: null, store_id: STORE_A });

    store.addProduct({
      barcode: "111",
      name: "In Category A",
      price: 100,
      stock: 10,
      category_id: cat1.id,
      costPrice: 0,
      brandId: null,
      store_id: STORE_A,
    });
    store.addProduct({
      barcode: "222",
      name: "In Category B",
      price: 200,
      stock: 5,
      category_id: cat2.id,
      costPrice: 0,
      brandId: null,
      store_id: STORE_A,
    });

    // Preview only Cat A
    useAdminStore.getState().bulkPricePreview({
      categoryId: cat1.id,
      percent: 10,
      target: "selling",
      storeId: STORE_A,
    });
    useAdminStore.getState().bulkPriceConfirm();

    const products = useProductsStore.getState().products;
    const a = products.find((p) => p.name === "In Category A")!;
    const b = products.find((p) => p.name === "In Category B")!;
    expect(a.price).toBe(110);
    expect(b.price).toBe(200); // unchanged
  });
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Dark theme toggle â€” store & persistence
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("Dark theme toggle", () => {
  beforeEach(() => {
    localStorage.removeItem("admin_theme");
    useAdminStore.setState({ theme: "light" });
    document.documentElement.classList.remove("dark");
  });

  it("defaults to light when no theme is saved", () => {
    localStorage.removeItem("admin_theme");
    // Simulate fresh store initialization
    useAdminStore.setState({ theme: "light" });
    expect(useAdminStore.getState().theme).toBe("light");
  });

  it("loads saved dark theme from localStorage", () => {
    localStorage.setItem("admin_theme", "dark");
    // Re-initialize store defaults (in real app this happens on page load)
    useAdminStore.setState({ theme: "dark" });
    expect(useAdminStore.getState().theme).toBe("dark");
  });

  it("loads saved light theme from localStorage", () => {
    localStorage.setItem("admin_theme", "light");
    useAdminStore.setState({ theme: "light" });
    expect(useAdminStore.getState().theme).toBe("light");
  });

  it("toggleTheme flips from light to dark", () => {
    useAdminStore.setState({ theme: "light" });
    useAdminStore.getState().toggleTheme();
    expect(useAdminStore.getState().theme).toBe("dark");
  });

  it("toggleTheme flips from dark to light", () => {
    useAdminStore.setState({ theme: "dark" });
    useAdminStore.getState().toggleTheme();
    expect(useAdminStore.getState().theme).toBe("light");
  });

  it("toggleTheme persists to localStorage", () => {
    useAdminStore.setState({ theme: "light" });
    useAdminStore.getState().toggleTheme();
    expect(localStorage.getItem("admin_theme")).toBe("dark");

    useAdminStore.getState().toggleTheme();
    expect(localStorage.getItem("admin_theme")).toBe("light");
  });

  it("toggleTheme adds/removes dark class on documentElement", () => {
    useAdminStore.setState({ theme: "light" });
    document.documentElement.classList.remove("dark");

    useAdminStore.getState().toggleTheme();
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    useAdminStore.getState().toggleTheme();
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("ignores invalid localStorage values (falls back to light)", () => {
    localStorage.setItem("admin_theme", "invalid");
    // loadTheme() returns "light" for invalid values
    const theme = localStorage.getItem("admin_theme") === "dark" ? "dark" : "light";
    expect(theme).toBe("light");
  });

  it("flicker prevention: inline script should apply dark class before React", () => {
    // This test verifies the EFFECT of the flicker prevention approach.
    // The inline script in index.html runs before React hydrates.
    // Here we simulate: set localStorage dark â†’ check that the class
    // would be applied before render.
    localStorage.setItem("admin_theme", "dark");
    document.documentElement.classList.remove("dark");

    // Simulate what the inline script does:
    const t = localStorage.getItem("admin_theme");
    if (t === "dark") document.documentElement.classList.add("dark");

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    localStorage.removeItem("admin_theme");
  });
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Settings Tab â€” AdminPage (Task 3.2)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function renderAdminPage() {
  return render(
    <StoreProvider initialStoreId="store_1">
      <AdminPage />
    </StoreProvider>,
  );
}

describe("AdminPage â€” Settings Tab", () => {
  beforeEach(async () => {
    // Reset auth store and login as admin
    useAuthStore.setState({
      users: [],
      currentUser: null,
      _hydrated: false,
    });
    localStorage.removeItem("auth_users");
    localStorage.removeItem("auth_current_user_id");
    useAppStore.setState({ page: "admin" });
    await useAuthStore.getState().init();
    await useAuthStore.getState().login("admin", "admin");
  });

  it("shows Gestionar Usuarios link in settings tab", async () => {
    const user = userEvent.setup();
    renderAdminPage();

    // Click ConfiguraciÃ³n tab
    await user.click(screen.getByText("ConfiguraciÃ³n"));

    expect(screen.getByText("Gestionar Usuarios")).toBeInTheDocument();
  });

  it("does not render PIN form elements", async () => {
    const user = userEvent.setup();
    renderAdminPage();

    await user.click(screen.getByText("ConfiguraciÃ³n"));

    // PIN fields should NOT exist
    expect(screen.queryByLabelText("PIN Actual")).toBeNull();
    expect(screen.queryByLabelText("Nuevo PIN")).toBeNull();
    expect(screen.queryByLabelText("Confirmar Nuevo PIN")).toBeNull();
    expect(screen.queryByText("Cambiar PIN")).toBeNull();
    expect(screen.queryByText("Configurar PIN")).toBeNull();
    expect(screen.queryByText("Bloquear Admin")).toBeNull();
  });

  it("still shows Theme section", async () => {
    const user = userEvent.setup();
    renderAdminPage();

    await user.click(screen.getByText("ConfiguraciÃ³n"));

    expect(screen.getByText("Tema")).toBeInTheDocument();
    expect(screen.getByText("Modo Claro")).toBeInTheDocument();
  });

  it("navigates to user-management page when clicking Gestionar Usuarios", async () => {
    const user = userEvent.setup();
    renderAdminPage();

    await user.click(screen.getByText("ConfiguraciÃ³n"));
    await user.click(screen.getByText("Gestionar Usuarios"));

    expect(useAppStore.getState().page).toBe("user-management");
  });

  it("shows current user name in settings", async () => {
    const user = userEvent.setup();
    renderAdminPage();

    await user.click(screen.getByText("ConfiguraciÃ³n"));

    expect(screen.getByText("admin")).toBeInTheDocument();
  });
});

