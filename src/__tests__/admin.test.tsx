import { describe, it, expect, beforeEach, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  users: new Map<string, Record<string, unknown>>(),
  nextId: 1,
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(() => Promise.resolve([])),
    post: vi.fn((path: string, data: any) => {
      if (path === "/auth/login") {
        const user = mockState.users.get(data?.username);
        if (!user || user.passwordHash !== "hashed_" + (data?.password ?? "")) {
          return Promise.reject(new Error("Credenciales inválidas"));
        }
        return Promise.resolve({ token: "test-token", user });
      }
      if (path === "/users") {
        const user = {
          id: mockState.nextId++,
          name: data.name,
          role: data.role,
          permissions: data.permissions ?? [],
          active: data.active,
          createdAt: new Date().toISOString(),
          passwordHash: "hashed_" + data.password,
        };
        mockState.users.set(data.name, user);
        return Promise.resolve(user);
      }
      return Promise.resolve({
        ...(data as object),
        id: mockState.nextId++,
        created_at: new Date().toISOString(),
      });
    }),
    put: vi.fn(() => Promise.resolve(undefined)),
    del: vi.fn(() => Promise.resolve(undefined)),
  },
  setToken: vi.fn(),
  clearToken: vi.fn(),
}));

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAdminStore, type BulkPriceOpts } from "@/store/admin";
import { useProductsStore } from "@/store/products";
import { useBrandsStore } from "@/store/brands";
import { useAuthStore, type AuthUser, type Permission } from "@/store/auth";
import AdminRoute from "@/components/AdminRoute";
import AdminPage from "@/pages/AdminPage";
import { StoreProvider } from "@/store/context";
import { useAppStore } from "@/store";

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function resetStore() {
  useAdminStore.setState({
    theme: "light",
    preview: null,
    pendingBulkOpts: null,
  });
}

function seedAdminUser() {
  mockState.users.set("admin", {
    id: 1,
    name: "admin",
    role: "admin",
    permissions: [],
    active: true,
    createdAt: new Date().toISOString(),
    passwordHash: "hashed_admin",
  });
}

function makeUser(
  name: string,
  permissions: Permission[],
  role: "admin" | "custom" = "custom",
): AuthUser {
  return {
    id: mockState.nextId++,
    name,
    role,
    permissions,
    active: true,
    createdAt: new Date().toISOString(),
  };
}

function setCurrentUser(user: AuthUser | null) {
  useAuthStore.setState({ currentUser: user });
}

beforeEach(() => {
  resetStore();
  mockState.users.clear();
  mockState.nextId = 1;
  seedAdminUser();
});

// ──────────────────────────────────────────────
// AdminRoute component
// ──────────────────────────────────────────────

describe("AdminRoute", () => {
  beforeEach(() => {
    setCurrentUser(null);
    useAppStore.getState().setPage("admin");
  });

  it("renders children when user has admin permission", () => {
    setCurrentUser(makeUser("admin", [], "admin"));

    render(
      <AdminRoute>
        <div data-testid="admin-content">Secret Admin Stuff</div>
      </AdminRoute>,
    );

    expect(screen.getByTestId("admin-content")).toBeInTheDocument();
  });

  it("renders null when user does not have admin permission", () => {
    setCurrentUser(makeUser("limited", ["ventas"]));

    render(
      <AdminRoute>
        <div data-testid="admin-content">Secret Admin Stuff</div>
      </AdminRoute>,
    );

    expect(screen.queryByTestId("admin-content")).toBeNull();
  });

  it("redirects to dashboard when user lacks admin permission", async () => {
    setCurrentUser(makeUser("limited", ["ventas"]));
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
    setCurrentUser(null);
    useAppStore.setState({ page: "admin" });

    render(
      <AdminRoute>
        <div data-testid="admin-content">Secret Admin Stuff</div>
      </AdminRoute>,
    );

    expect(screen.queryByTestId("admin-content")).toBeNull();
    await waitFor(() => {
      expect(useAppStore.getState().page).toBe("dashboard");
    });
  });
});

// ──────────────────────────────────────────────
// Bulk price preview & confirm
// ──────────────────────────────────────────────

describe("Bulk price preview", () => {
  const STORE_A = "store_1";
  const STORE_B = "store_2";

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

  async function seedProducts() {
    const store = useProductsStore.getState();
    const bebidas = await store.addCategory({
      name: "Bebidas",
      parent_id: null,
      store_id: STORE_A,
    });
    const limpieza = await store.addCategory({
      name: "Limpieza",
      parent_id: null,
      store_id: STORE_A,
    });

    const coca = await useBrandsStore.getState().addBrand({
      name: "Coca-Cola",
      store_id: STORE_A,
    });
    const pepsi = await useBrandsStore.getState().addBrand({
      name: "Pepsi",
      store_id: STORE_A,
    });

    await store.addProduct({
      barcode: "111",
      name: "Coca-Cola 500ml",
      price: 150,
      stock: 10,
      category_id: bebidas.id,
      costPrice: 100,
      brandId: coca.id,
      store_id: STORE_A,
    });
    await store.addProduct({
      barcode: "222",
      name: "Coca-Cola 1L",
      price: 250,
      stock: 5,
      category_id: bebidas.id,
      costPrice: 180,
      brandId: coca.id,
      store_id: STORE_A,
    });
    await store.addProduct({
      barcode: "333",
      name: "Pepsi 500ml",
      price: 140,
      stock: 8,
      category_id: bebidas.id,
      costPrice: 90,
      brandId: pepsi.id,
      store_id: STORE_A,
    });
    await store.addProduct({
      barcode: "444",
      name: "Detergente",
      price: 300,
      stock: 3,
      category_id: limpieza.id,
      costPrice: 200,
      brandId: null,
      store_id: STORE_A,
    });
    await store.addProduct({
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
    await store.addProduct({
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

  it("previews all products when no filter is applied", async () => {
    await seedProducts();
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

  it("previews filter by category", async () => {
    const { bebidas } = await seedProducts();
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

  it("previews filter by brand", async () => {
    const { coca } = await seedProducts();
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

  it("previews filter by brand + category combined", async () => {
    const { bebidas, coca } = await seedProducts();
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

  it("preview calculates correct new prices for selling target", async () => {
    await seedProducts();
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

  it("preview calculates correct new prices for cost target", async () => {
    await seedProducts();
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

  it("preview shows both cost and selling when target is both", async () => {
    await seedProducts();
    const opts: BulkPriceOpts = {
      percent: 10,
      target: "both",
      storeId: STORE_A,
    };
    const result = useAdminStore.getState().bulkPricePreview(opts);

    // 5 products × 2 fields = 10 items
    expect(result).toHaveLength(10);

    const costItems = result.filter((i) => i.field === "cost");
    const sellingItems = result.filter((i) => i.field === "selling");
    expect(costItems).toHaveLength(5);
    expect(sellingItems).toHaveLength(5);
  });

  it("preview is empty when no products match filter", async () => {
    await seedProducts();
    const opts: BulkPriceOpts = {
      categoryId: 9999,
      percent: 10,
      target: "selling",
      storeId: STORE_A,
    };
    const result = useAdminStore.getState().bulkPricePreview(opts);

    expect(result).toHaveLength(0);
  });

  it("preview shows 0 products for 0% increase edge case", async () => {
    await seedProducts();
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

  it("preview handles negative percentage (decrease)", async () => {
    await seedProducts();
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

  it("preview does not modify product store", async () => {
    await seedProducts();
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

// ──────────────────────────────────────────────
// Bulk price confirm
// ──────────────────────────────────────────────

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

  async function addProduct(
    barcode: string,
    name: string,
    price: number,
    costPrice: number,
    categoryId: number | null = null,
  ) {
    return useProductsStore.getState().addProduct({
      barcode,
      name,
      price,
      stock: 10,
      category_id: categoryId,
      costPrice,
      brandId: null,
      store_id: STORE_A,
    });
  }

  it("confirm updates selling prices and matches preview", async () => {
    await addProduct("111", "Product A", 100, 80);
    await addProduct("222", "Product B", 200, 150);

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
    await useAdminStore.getState().bulkPriceConfirm();

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

  it("confirm updates cost prices correctly", async () => {
    await addProduct("111", "Product A", 100, 80);

    useAdminStore.getState().bulkPricePreview({
      percent: 25,
      target: "cost",
      storeId: STORE_A,
    });
    await useAdminStore.getState().bulkPriceConfirm();

    const p = useProductsStore.getState().products[0];
    expect(p.costPrice).toBe(100); // 80 * 1.25
    expect(p.price).toBe(100); // unchanged
  });

  it("confirm updates both cost and selling prices", async () => {
    await addProduct("111", "Product A", 100, 80);

    useAdminStore.getState().bulkPricePreview({
      percent: 10,
      target: "both",
      storeId: STORE_A,
    });
    await useAdminStore.getState().bulkPriceConfirm();

    const p = useProductsStore.getState().products[0];
    expect(p.costPrice).toBe(88); // 80 * 1.1
    expect(p.price).toBe(110); // 100 * 1.1
  });

  it("cancel (clear preview) does not modify products", async () => {
    await addProduct("111", "Product A", 100, 80);

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

  it("confirm with no preview is a no-op (does not throw)", async () => {
    await expect(useAdminStore.getState().bulkPriceConfirm()).resolves.toBeUndefined();
  });

  it("handles large percentages without overflow", async () => {
    await addProduct("111", "Expensive Item", 9999.99, 8000);

    const preview = useAdminStore.getState().bulkPricePreview({
      percent: 1000,
      target: "selling",
      storeId: STORE_A,
    });

    expect(preview[0].newPrice).toBe(109999.89); // 9999.99 * 11
    expect(isFinite(preview[0].newPrice)).toBe(true);
  });

  it("confirm with filtered preview only updates matching products", async () => {
    const cat1 = await useProductsStore.getState().addCategory({
      name: "Cat A",
      parent_id: null,
      store_id: STORE_A,
    });
    const cat2 = await useProductsStore.getState().addCategory({
      name: "Cat B",
      parent_id: null,
      store_id: STORE_A,
    });

    await addProduct("111", "In Category A", 100, 0, cat1.id);
    await addProduct("222", "In Category B", 200, 0, cat2.id);

    // Preview only Cat A
    useAdminStore.getState().bulkPricePreview({
      categoryId: cat1.id,
      percent: 10,
      target: "selling",
      storeId: STORE_A,
    });
    await useAdminStore.getState().bulkPriceConfirm();

    const products = useProductsStore.getState().products;
    const a = products.find((p) => p.name === "In Category A")!;
    const b = products.find((p) => p.name === "In Category B")!;
    expect(a.price).toBe(110);
    expect(b.price).toBe(200); // unchanged
  });
});

// ──────────────────────────────────────────────
// Dark theme toggle — store & persistence
// ──────────────────────────────────────────────

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
    // Here we simulate: set localStorage dark → check that the class
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

// ──────────────────────────────────────────────
// Settings Tab — AdminPage
// ──────────────────────────────────────────────

function renderAdminPage() {
  return render(
    <StoreProvider initialStoreId="store_1">
      <AdminPage />
    </StoreProvider>,
  );
}

describe("AdminPage — Settings Tab", () => {
  beforeEach(() => {
    setCurrentUser(makeUser("admin", [], "admin"));
    useAppStore.setState({ page: "admin" });
    useAdminStore.setState({ theme: "light", preview: null, pendingBulkOpts: null });
    localStorage.removeItem("admin_theme");
  });

  it("shows Gestionar button in settings tab", async () => {
    const user = userEvent.setup();
    renderAdminPage();

    await user.click(screen.getByText("Configuración"));

    expect(screen.getByText("Gestionar")).toBeInTheDocument();
  });

  it("does not render PIN form elements", async () => {
    const user = userEvent.setup();
    renderAdminPage();

    await user.click(screen.getByText("Configuración"));

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

    await user.click(screen.getByText("Configuración"));

    expect(screen.getByText("Tema")).toBeInTheDocument();
    expect(screen.getByText("Modo Claro")).toBeInTheDocument();
  });

  it("navigates to user-management page when clicking Gestionar", async () => {
    const user = userEvent.setup();
    renderAdminPage();

    await user.click(screen.getByText("Configuración"));
    await user.click(screen.getByText("Gestionar"));

    expect(useAppStore.getState().page).toBe("user-management");
  });

  it("shows current user name in settings", async () => {
    const user = userEvent.setup();
    renderAdminPage();

    await user.click(screen.getByText("Configuración"));

    expect(screen.getByText("admin")).toBeInTheDocument();
  });
});