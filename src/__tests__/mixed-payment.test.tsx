import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAppStore } from "@/store";
import { useAuthStore } from "@/store/auth";
import { useCashClosingStore } from "@/store/cash-closing";
import POSPage from "@/pages/POSPage";
import { StoreProvider } from "@/store/context";

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function resetStores() {
  useAppStore.setState({
    items: [],
    lastCompletedSale: null,
    completedSales: [],
    busy: false,
    notification: null,
    selectedCustomer: null,
    selectedCartItemId: null,
  });
  useAuthStore.setState({
    users: [],
    currentUser: null,
    _hydrated: false,
  });
  useCashClosingStore.setState({ shifts: [] });
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
  const cashClosing = useCashClosingStore.getState();
  cashClosing.openShift("Test Cajero", "store_1");
}

function addItemToCart(productId: number, name: string, price: number, quantity = 1) {
  const store = useAppStore.getState();
  for (let i = 0; i < quantity; i++) {
    store.addItem(productId, name, price);
  }
}

beforeEach(() => {
  resetStores();
  loginAndOpenShift();
});

// ──────────────────────────────────────────────
// 3.1 — Store unit: checkout("mixed") saves cashAmount/cardAmount
// ──────────────────────────────────────────────

describe("Mixed payment — store unit", () => {
  it("3.1 saves correct cashAmount and cardAmount on mixed checkout", () => {
    addItemToCart(1, "Producto A", 100);
    addItemToCart(2, "Producto B", 50);

    const sale = useAppStore.getState().checkout("mixed", 150, "store_1", undefined, 80, 70);

    expect(sale.paymentMethod).toBe("mixed");
    expect(sale.cashAmount).toBe(80);
    expect(sale.cardAmount).toBe(70);
    expect(sale.total).toBe(150);
    expect(sale.change).toBe(0);
  });

  it("3.1 handles mixed with only cash (cardAmount=0)", () => {
    addItemToCart(1, "Producto A", 200);

    const sale = useAppStore.getState().checkout("mixed", 200, "store_1", undefined, 200, 0);

    expect(sale.cashAmount).toBe(200);
    expect(sale.cardAmount).toBe(0);
    expect(sale.change).toBe(0);
  });

  it("3.1 handles mixed with only card (cashAmount=0)", () => {
    addItemToCart(1, "Producto A", 200);

    const sale = useAppStore.getState().checkout("mixed", 200, "store_1", undefined, 0, 200);

    expect(sale.cashAmount).toBe(0);
    expect(sale.cardAmount).toBe(200);
    expect(sale.change).toBe(0);
  });

  it("3.2 throws validation error when split sum is less than total", () => {
    addItemToCart(1, "Producto A", 150);

    expect(() => {
      useAppStore.getState().checkout("mixed", 150, "store_1", undefined, 50, 50);
    }).toThrow(/total ingresado|faltan/i);
  });

  it("3.2 throws validation error when cash+card < total", () => {
    addItemToCart(1, "Producto A", 200);

    expect(() => {
      useAppStore.getState().checkout("mixed", 200, "store_1", undefined, 0, 100);
    }).toThrow(/total ingresado|faltan/i);
  });

  it("3.3 checkout('cash') regression — works as before", () => {
    addItemToCart(1, "Producto A", 100);

    const sale = useAppStore.getState().checkout("cash", 100, "store_1");

    expect(sale.paymentMethod).toBe("cash");
    expect(sale.amountPaid).toBe(100);
    expect(sale.change).toBe(0);
    expect(sale.cashAmount).toBe(100);
  });

  it("3.3 checkout('card') regression — works as before", () => {
    addItemToCart(1, "Producto A", 200);

    const sale = useAppStore.getState().checkout("card", undefined, "store_1");

    expect(sale.paymentMethod).toBe("card");
    expect(sale.amountPaid).toBeNull();
    expect(sale.change).toBeNull();
    expect(sale.cardAmount).toBe(200);
  });
});

// ──────────────────────────────────────────────
// 3.4 — Integration: modal renders mixed button, inputs, auto-calc
// ──────────────────────────────────────────────

describe("Mixed payment — integration", () => {
  async function openCheckoutModal() {
    const user = userEvent.setup();
    render(
      <StoreProvider initialStoreId="store_1">
        <POSPage />
      </StoreProvider>,
    );
    const store = useAppStore.getState();
    store.addItem(1, "Coca-Cola 500ml", 150);
    store.addItem(2, "Leche Entera 1L", 200);

    // Press F1 to open checkout
    await user.keyboard("{F1}");
    return user;
  }

  it("3.4 renders the Mixto payment button in checkout modal", async () => {
    await openCheckoutModal();

    // The modal should have the "Mixto" button
    expect(screen.getByText("Mixto")).toBeInTheDocument();

    // Other payment methods should also be present
    expect(screen.getByText("Efectivo")).toBeInTheDocument();
    expect(screen.getByText("Tarjeta")).toBeInTheDocument();
  });

  it("3.4 shows cash/card inputs when Mixto is selected", async () => {
    const user = await openCheckoutModal();

    // Click the Mixto button
    await user.click(screen.getByText("Mixto"));

    // Cash, card, and Mercado Pago inputs should appear
    expect(screen.getByLabelText("💵 Efectivo")).toBeInTheDocument();
    expect(screen.getByLabelText("💳 Tarjeta")).toBeInTheDocument();
    expect(screen.getByLabelText("🧾 M. Pago")).toBeInTheDocument();
  });

  it("3.4 shows entered total and calculates change for mixed payment", async () => {
    const user = await openCheckoutModal();

    // Total is 350 (150 + 200)
    await user.click(screen.getByText("Mixto"));

    const cashInput = screen.getByLabelText("💵 Efectivo");
    const cardInput = screen.getByLabelText("💳 Tarjeta");

    // Enter cash = 200, card = 150
    await user.clear(cashInput);
    await user.type(cashInput, "200");
    await user.clear(cardInput);
    await user.type(cardInput, "150");

    // Total ingresado should be shown as $350.00 (total + entered total)
    const totals = screen.getAllByText("$350.00");
    expect(totals.length).toBeGreaterThanOrEqual(2);
  });
});
