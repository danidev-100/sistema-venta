import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAppStore } from "@/store";
import { useAuthStore } from "@/store/auth";
import { useCashClosingStore } from "@/store/cash-closing";
import { useProductsStore, type Product } from "@/store/products";
import { useCustomersStore } from "@/store/customers";
import POSPage from "@/pages/POSPage";
import { StoreProvider } from "@/store/context";

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 501,
    barcode: null,
    name: "Yerba Mate 500g",
    image: "",
    price: 1500,
    stock: 10,
    minStock: 0,
    midStock: 0,
    category_id: null,
    costPrice: 0,
    brandId: null,
    saleUnit: "unit",
    store_id: "store_1",
    ...overrides,
  };
}

function resetStores() {
  useAppStore.setState({
    items: [],
    lastCompletedSale: null,
    completedSales: [],
    busy: false,
    notification: null,
    selectedCustomer: null,
    selectedCartItemId: null,
    selectedPriceListId: null,
  });
  useAuthStore.setState({ users: [], currentUser: null, _hydrated: false });
  useCashClosingStore.setState({ shifts: [] });
  useProductsStore.setState({ products: [], categories: [] });
}

// POSPage loads shifts, products, categories and customers on mount. Stub those
// loaders so the fixtures below survive the mount instead of being replaced by
// a failed fetch, which jsdom cannot serve.
function stubMountLoaders() {
  useCashClosingStore.setState({ loadShifts: async () => {} });
  useProductsStore.setState({
    loadProducts: async () => {},
    loadCategories: async () => {},
  });
  useCustomersStore.setState({ loadCustomers: async () => {} });
}

function loginAndOpenShift() {
  useAuthStore.setState({
    currentUser: {
      id: 999,
      name: "Test Cajero",
      passwordHash: "hash",
      role: "admin",
      permissions: [
        "ventas", "caja", "productos", "clientes", "proveedores",
        "pedidos", "facturacion", "comprobantes", "gastos",
        "estadisticas", "admin", "usuarios",
      ],
      active: true,
      createdAt: new Date().toISOString(),
    },
    _hydrated: true,
  });
  useCashClosingStore.getState().openShift("Test Cajero", "store_1");
}

function catalogCard(name: string): HTMLElement {
  // The catalog card exposes the full product name through its title.
  return screen.getByTitle(name);
}

function cartQuantity(productId: number): number {
  const item = useAppStore.getState().items.find((i) => i.productId === productId);
  return item?.quantity ?? 0;
}

beforeEach(() => {
  resetStores();
  stubMountLoaders();
  loginAndOpenShift();
});

// ──────────────────────────────────────────────
// Catalog stock feedback
// ──────────────────────────────────────────────

describe("POS catalog — stock follows the cart", () => {
  it("decrements the stock shown on the card when the product is added", async () => {
    useProductsStore.setState({ products: [makeProduct({ stock: 10 })] });
    const user = userEvent.setup();
    render(
      <StoreProvider initialStoreId="store_1">
        <POSPage />
      </StoreProvider>,
    );

    expect(screen.getByText("Stock 10")).toBeInTheDocument();

    await user.click(catalogCard("Yerba Mate 500g"));

    expect(screen.getByText("Stock 9")).toBeInTheDocument();
    expect(screen.queryByText("Stock 10")).not.toBeInTheDocument();
    expect(cartQuantity(501)).toBe(1);
  });

  it("switches the stock label and colour at the low-stock threshold", async () => {
    useProductsStore.setState({ products: [makeProduct({ stock: 6 })] });
    const user = userEvent.setup();
    render(
      <StoreProvider initialStoreId="store_1">
        <POSPage />
      </StoreProvider>,
    );

    expect(screen.getByText("Stock 6")).toBeInTheDocument();

    await user.click(catalogCard("Yerba Mate 500g"));

    const lowStock = screen.getByText("Últimas 5");
    expect(lowStock).toBeInTheDocument();
    expect(lowStock.className).toContain("text-pos-warn");
  });

  it("stops adding once the stock on hand is in the cart and reports no stock", async () => {
    useProductsStore.setState({ products: [makeProduct({ stock: 2 })] });
    const user = userEvent.setup();
    render(
      <StoreProvider initialStoreId="store_1">
        <POSPage />
      </StoreProvider>,
    );

    await user.click(catalogCard("Yerba Mate 500g"));
    await user.click(catalogCard("Yerba Mate 500g"));

    expect(cartQuantity(501)).toBe(2);
    const exhausted = screen.getByText("Sin stock");
    expect(exhausted.className).toContain("text-pos-danger");
    expect(catalogCard("Yerba Mate 500g")).toBeDisabled();

    // A third click must not push the cart past the stock on hand.
    await user.click(catalogCard("Yerba Mate 500g"));
    expect(cartQuantity(501)).toBe(2);
    expect(screen.getByText("Sin stock")).toBeInTheDocument();
  });

  it("keeps showing the price-list stock for products sold by weight", async () => {
    useProductsStore.setState({
      products: [makeProduct({ saleUnit: "kilogram", stock: 3 })],
    });
    const user = userEvent.setup();
    render(
      <StoreProvider initialStoreId="store_1">
        <POSPage />
      </StoreProvider>,
    );

    expect(screen.getByText("Últimas 3")).toBeInTheDocument();

    // Weight products open the weight modal instead of adding a unit.
    await user.click(catalogCard("Yerba Mate 500g"));
    expect(useAppStore.getState().items).toHaveLength(0);
    expect(screen.getByText("Últimas 3")).toBeInTheDocument();
  });
});
