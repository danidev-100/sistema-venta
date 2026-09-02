import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProductForm from "@/components/ProductForm";
import ProductsPage from "@/pages/ProductsPage";
import { useAdminStore } from "@/store/admin";
import { useAuthStore } from "@/store/auth";
import { useBrandsStore } from "@/store/brands";
import { useProductsStore } from "@/store/products";
import { useStockConsolidatedStore } from "@/store/stockConsolidated";
import { StoreProvider } from "@/store/context";

// ──────────────────────────────────────────────
// ProductsPage carga productos/categorías/marcas desde
// la API al montar (loadProducts et al.). El mock devuelve
// los datos sembrados para que el render sea determinístico.
// ──────────────────────────────────────────────

const mockDb = vi.hoisted(() => ({
  products: [] as Array<Record<string, unknown>>,
  categories: [] as Array<Record<string, unknown>>,
  brands: [] as Array<Record<string, unknown>>,
  nextId: 1,
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn((path: string) => {
      if (path.startsWith("/products/stock-consolidated")) return Promise.resolve([]);
      if (path.startsWith("/products/stock-movements")) return Promise.resolve([]);
      if (path.startsWith("/products")) return Promise.resolve(mockDb.products);
      if (path.startsWith("/categories")) return Promise.resolve(mockDb.categories);
      if (path.startsWith("/brands")) return Promise.resolve(mockDb.brands);
      return Promise.resolve([]);
    }),
    post: vi.fn((_path: string, data: unknown) =>
      Promise.resolve({
        ...(data as object),
        id: mockDb.nextId++,
        created_at: new Date().toISOString(),
      }),
    ),
    put: vi.fn(() => Promise.resolve(undefined)),
    del: vi.fn(() => Promise.resolve(undefined)),
  },
  setToken: vi.fn(),
  clearToken: vi.fn(),
}));

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function resetStores() {
  useAdminStore.setState({ theme: "light", preview: null });
  useAuthStore.setState({ users: [], currentUser: null });
  useBrandsStore.setState({ brands: [] });
  useProductsStore.setState({ products: [], categories: [], stockMovements: [] });
  useStockConsolidatedStore.setState({ consolidated: [], loadedStoreId: null });
  mockDb.products = [];
  mockDb.categories = [];
  mockDb.brands = [];
  mockDb.nextId = 1;
}

/** Simulate a logged-in admin user with all permissions. */
function loginAsAdmin() {
  useAuthStore.setState({
    currentUser: {
      id: 999,
      name: "admin",
      passwordHash: "hash",
      role: "admin",
      permissions: ["ventas", "caja", "productos", "clientes", "proveedores", "pedidos", "facturacion", "comprobantes", "gastos", "estadisticas", "admin", "usuarios"],
      active: true,
      createdAt: new Date().toISOString(),
    },
  });
}

beforeEach(() => {
  resetStores();
});

// ──────────────────────────────────────────────
// ProductForm
// ──────────────────────────────────────────────

describe("ProductForm — cost & brand fields", () => {
  function renderForm() {
    return render(
      <StoreProvider initialStoreId="store_1">
        <ProductForm
          editProduct={null}
          onSaved={() => {}}
          onCancel={() => {}}
        />
      </StoreProvider>,
    );
  }

  it("hides cost price and brand fields when admin is locked", () => {
    renderForm();

    expect(screen.queryByLabelText(/cost price/i)).toBeNull();
    expect(screen.queryByLabelText(/marca/i)).toBeNull();
    expect(screen.queryByTestId("product-cost-price")).toBeNull();
    expect(screen.queryByTestId("product-brand")).toBeNull();
  });

  it("shows cost price and brand fields when admin is unlocked", () => {
    loginAsAdmin();
    renderForm();

    expect(screen.getByLabelText(/cost price/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/marca/i)).toBeInTheDocument();
  });

  it("shows brand options from the brands store", () => {
    loginAsAdmin();
    useBrandsStore.setState({
      brands: [
        { id: 1, name: "Coca-Cola", store_id: "store_1" },
        { id: 2, name: "Pepsi", store_id: "store_1" },
      ],
    });
    renderForm();

    const select = screen.getByLabelText(/marca/i);
    expect(select).toBeInTheDocument();

    // Check both brand options exist
    expect(
      screen.getByRole("option", { name: "Coca-Cola" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Pepsi" }),
    ).toBeInTheDocument();
  });

  it("only shows brands for the active store (store_2 brands hidden)", () => {
    loginAsAdmin();
    useBrandsStore.setState({
      brands: [
        { id: 3, name: "Store2Brand", store_id: "store_2" },
      ],
    });
    renderForm();

    const select = screen.getByLabelText(/marca/i);
    expect(select).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Store2Brand" }),
    ).toBeNull();
  });

  it("saves costPrice and brandId when submitting", async () => {
    loginAsAdmin();
    useBrandsStore.setState({
      brands: [
        { id: 10, name: "TestBrand", store_id: "store_1" },
      ],
    });

    let saved: Record<string, unknown> | null = null;
    render(
      <StoreProvider initialStoreId="store_1">
        <ProductForm
          editProduct={null}
          onSaved={() => {
            // After save, read the last product
            const products = useProductsStore.getState().products;
            saved = products[products.length - 1] ?? null;
          }}
          onCancel={() => {}}
        />
      </StoreProvider>,
    );

    const user = userEvent.setup();

    // Fill required name
    await user.type(screen.getByLabelText(/nombre/i), "Test Product");

    // Fill price
    await user.clear(screen.getByLabelText(/precio/i));
    await user.type(screen.getByLabelText(/precio/i), "99.99");

    // Fill cost price (NumberInput formatea en es-AR con coma decimal)
    await user.clear(screen.getByLabelText(/cost price/i));
    await user.type(screen.getByLabelText(/cost price/i), "50,00");

    // Select brand
    const brandSelect = screen.getByLabelText(/marca/i);
    await user.selectOptions(brandSelect, "10");

    // Submit
    await user.click(screen.getByRole("button", { name: /crear producto/i }));

    await waitFor(() => {
      expect(saved).not.toBeNull();
    });
    expect(saved!.costPrice).toBe(50);
    expect(saved!.brandId).toBe(10);
  });

  it("pre-fills costPrice and brandId when editing a product", async () => {
    loginAsAdmin();
    useBrandsStore.setState({
      brands: [
        { id: 99, name: "ExistingBrand", store_id: "store_1" },
      ],
    });

    // Add a product to edit
    const product = await useProductsStore.getState().addProduct({
      name: "Edit Me",
      barcode: null,
      price: 100,
      costPrice: 45,
      brandId: 99,
      stock: 10,
      category_id: null,
      store_id: "store_1",
    });

    render(
      <StoreProvider initialStoreId="store_1">
        <ProductForm
          editProduct={product}
          onSaved={() => {}}
          onCancel={() => {}}
        />
      </StoreProvider>,
    );

    const costInput = screen.getByLabelText(/cost price/i) as HTMLInputElement;
    expect(costInput.value).toBe("45,00");

    const brandSelect = screen.getByLabelText(/marca/i) as HTMLSelectElement;
    expect(brandSelect.value).toBe("99");
  });
});

// ──────────────────────────────────────────────
// ProductsPage — cost & brand columns
// ──────────────────────────────────────────────

describe("ProductsPage — cost & brand columns", () => {
  function seedData() {
    mockDb.products = [
      {
        id: 100,
        name: "Cola 355ml",
        barcode: "779001",
        image: "",
        price: 150,
        cost_price: 90,
        stock: 20,
        min_stock: 0,
        category_id: null,
        brand_id: 1,
        sale_unit: "unit",
        store_id: "store_1",
      },
      {
        id: 101,
        name: "Snack Pack",
        barcode: "779002",
        image: "",
        price: 80,
        cost_price: 0,
        stock: 5,
        min_stock: 0,
        category_id: null,
        brand_id: null,
        sale_unit: "unit",
        store_id: "store_1",
      },
    ];
    mockDb.brands = [{ id: 1, name: "Coca-Cola", store_id: "store_1" }];
    mockDb.categories = [];
  }

  function renderPage() {
    return render(
      <StoreProvider initialStoreId="store_1">
        <ProductsPage />
      </StoreProvider>,
    );
  }

  it("hides cost column but shows brand column when admin is locked", async () => {
    seedData();
    renderPage();

    await screen.findByText("Marca");

    // Cost column hidden (admin-gated)
    expect(screen.queryByText("Costo")).toBeNull();
    expect(screen.queryByText("$90,00")).toBeNull();

    // Brand column always visible now (not admin-gated)
    expect(screen.getByText("Marca")).toBeInTheDocument();
    // Brand name appears in BrandFilter sidebar + table cell
    expect(screen.getAllByText("Coca-Cola").length).toBeGreaterThanOrEqual(1);
  });

  it("shows cost and brand columns when admin is unlocked", async () => {
    loginAsAdmin();
    seedData();
    renderPage();

    // Column headers visible
    await screen.findByText("Costo");
    expect(screen.getByText("Marca")).toBeInTheDocument();

    // Cost value visible (es-AR format)
    expect(screen.getByText("$90,00")).toBeInTheDocument();

    // Brand name visible in the table (y eventualmente en el filtro lateral)
    const brandInstances = screen.getAllByText("Coca-Cola");
    expect(brandInstances.length).toBeGreaterThanOrEqual(1);
  });

  it("shows $0,00 for products without costPrice", async () => {
    loginAsAdmin();
    seedData();
    renderPage();

    await screen.findByText("Snack Pack");
    // Snack Pack has costPrice = 0
    expect(screen.getByText("$0,00")).toBeInTheDocument();
  });
});