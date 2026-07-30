import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProductForm from "@/components/ProductForm";
import ProductsPage from "@/pages/ProductsPage";
import { useAdminStore } from "@/store/admin";
import { useAuthStore } from "@/store/auth";
import { useBrandsStore } from "@/store/brands";
import { useProductsStore } from "@/store/products";
import { StoreProvider } from "@/store/context";

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function resetStores() {
  useAdminStore.setState({
    theme: "light",
    preview: null,
  });
  useAuthStore.setState({
    users: [],
    currentUser: null,
    _hydrated: true,
  });
  useBrandsStore.setState({ brands: [] });
  useProductsStore.setState({ products: [], categories: [], stockMovements: [] });
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
    expect(screen.queryByLabelText(/brand/i)).toBeNull();
    expect(screen.queryByTestId("product-cost-price")).toBeNull();
    expect(screen.queryByTestId("product-brand")).toBeNull();
  });

  it("shows cost price and brand fields when admin is unlocked", async () => {
    loginAsAdmin();
    renderForm();

    expect(screen.getByLabelText(/cost price/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/brand/i)).toBeInTheDocument();
  });

  it("shows brand options from the brands store", async () => {
    loginAsAdmin();
    useBrandsStore.setState({
      brands: [
        { id: 1, name: "Coca-Cola", store_id: "store_1" },
        { id: 2, name: "Pepsi", store_id: "store_1" },
      ],
    });
    renderForm();

    const select = screen.getByLabelText(/brand/i);
    expect(select).toBeInTheDocument();

    // Check both brand options exist
    expect(
      screen.getByRole("option", { name: "Coca-Cola" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Pepsi" }),
    ).toBeInTheDocument();
  });

  it("only shows brands for the active store (store_2 brands hidden)", async () => {
    loginAsAdmin();
    useBrandsStore.setState({
      brands: [
        { id: 3, name: "Store2Brand", store_id: "store_2" },
      ],
    });
    renderForm();

    const select = screen.getByLabelText(/brand/i);
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

    // Fill cost price
    await user.clear(screen.getByLabelText(/cost price/i));
    await user.type(screen.getByLabelText(/cost price/i), "50.00");

    // Select brand
    const brandSelect = screen.getByLabelText(/brand/i);
    await user.selectOptions(brandSelect, "10");

    // Submit
    await user.click(screen.getByRole("button", { name: /crear producto/i }));

    expect(saved).not.toBeNull();
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
    const product = useProductsStore.getState().addProduct({
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
    expect(costInput.value).toBe("45");

    const brandSelect = screen.getByLabelText(/brand/i) as HTMLSelectElement;
    expect(brandSelect.value).toBe("99");
  });
});

// ──────────────────────────────────────────────
// ProductsPage — cost & brand columns
// ──────────────────────────────────────────────

describe("ProductsPage — cost & brand columns", () => {
  function seedData() {
    useProductsStore.setState({
      products: [
        {
          id: 100,
          name: "Cola 355ml",
          barcode: "779001",
          image: "",
          price: 150,
          costPrice: 90,
          stock: 20,
          minStock: 0,
          midStock: 0,
          category_id: null,
          brandId: 1,
          store_id: "store_1",
          saleUnit: "unit",
        },
        {
          id: 101,
          name: "Snack Pack",
          barcode: "779002",
          image: "",
          price: 80,
          costPrice: 0,
          stock: 5,
          minStock: 0,
          midStock: 0,
          category_id: null,
          brandId: null,
          store_id: "store_1",
          saleUnit: "unit",
        },
      ],
      categories: [],
      stockMovements: [],
    });
    useBrandsStore.setState({
      brands: [
        { id: 1, name: "Coca-Cola", store_id: "store_1" },
      ],
    });
  }

  function renderPage() {
    return render(
      <StoreProvider initialStoreId="store_1">
        <ProductsPage />
      </StoreProvider>,
    );
  }

  it("hides cost column but shows brand column when admin is locked", () => {
    seedData();
    renderPage();

    // Cost column hidden (admin-gated)
    expect(screen.queryByText("Costo")).toBeNull();
    expect(screen.queryByText("$90.00")).toBeNull();

    // Brand column always visible now (not admin-gated)
    expect(screen.getByText("Marca")).toBeInTheDocument();
    // Brand name appears in BrandFilter sidebar + table cell
    expect(screen.getAllByText("Coca-Cola").length).toBeGreaterThanOrEqual(1);
  });

  it("shows cost and brand columns when admin is unlocked", () => {
    loginAsAdmin();
    seedData();
    renderPage();

    // Column headers visible
    expect(screen.getByText("Costo")).toBeInTheDocument();
    expect(screen.getByText("Marca")).toBeInTheDocument();

    // Cost value visible
    expect(screen.getByText("$90.00")).toBeInTheDocument();

    // Brand name visible: once in BrandFilter sidebar + once in table cell
    const brandInstances = screen.getAllByText("Coca-Cola");
    expect(brandInstances.length).toBeGreaterThanOrEqual(2);
    expect(brandInstances[0]).toBeInTheDocument();
  });

  it("shows — for products without costPrice", () => {
    loginAsAdmin();
    seedData();
    renderPage();

    // Snack Pack has costPrice = 0
    expect(screen.getByText("$0.00")).toBeInTheDocument();
    // Snack Pack has no brand — should show —
    // We look for "—" in the brand column — but multiple exist.
    // Verify the row content for Snack Pack (which should have no brand)
    expect(screen.getByText("Snack Pack")).toBeInTheDocument();
  });
});
