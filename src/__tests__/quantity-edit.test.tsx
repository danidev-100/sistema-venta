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

function renderPOS() {
  return userEvent.setup();
}

beforeEach(() => {
  resetStores();
  loginAndOpenShift();
});

// ──────────────────────────────────────────────
// 4.1 — + button increments, - decrements
// ──────────────────────────────────────────────

describe("Quantity quick-edit — +/- buttons", () => {
  it("4.1 + button increments item quantity", async () => {
    useAppStore.getState().addItem(1, "Coca-Cola 500ml", 150);

    const user = renderPOS();
    render(
      <StoreProvider initialStoreId="store_1">
        <POSPage />
      </StoreProvider>,
    );

    const increaseBtn = screen.getByLabelText("Aumentar cantidad de Coca-Cola 500ml");
    await user.click(increaseBtn);

    const item = useAppStore.getState().items[0];
    expect(item.quantity).toBe(2);
    expect(item.subtotal).toBe(300);
  });

  it("4.1 - button decrements item quantity", async () => {
    useAppStore.getState().addItem(1, "Coca-Cola 500ml", 150);
    useAppStore.getState().updateQuantity(1, 5);

    const user = renderPOS();
    render(
      <StoreProvider initialStoreId="store_1">
        <POSPage />
      </StoreProvider>,
    );

    expect(useAppStore.getState().items[0].quantity).toBe(5);

    const decreaseBtn = screen.getByLabelText("Disminuir cantidad de Coca-Cola 500ml");
    await user.click(decreaseBtn);

    const item = useAppStore.getState().items[0];
    expect(item.quantity).toBe(4);
  });
});

// ──────────────────────────────────────────────
// 4.2 — - at qty=1 removes item
// ──────────────────────────────────────────────

describe("Quantity quick-edit — remove at zero", () => {
  it("4.2 decrement from qty=1 removes the item from cart", async () => {
    useAppStore.getState().addItem(1, "Coca-Cola 500ml", 150);
    useAppStore.getState().addItem(2, "Leche Entera 1L", 200);

    const user = renderPOS();
    render(
      <StoreProvider initialStoreId="store_1">
        <POSPage />
      </StoreProvider>,
    );

    expect(useAppStore.getState().items).toHaveLength(2);

    const decreaseBtn = screen.getByLabelText("Disminuir cantidad de Coca-Cola 500ml");
    await user.click(decreaseBtn);

    const items = useAppStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].productId).toBe(2);
  });
});

// ──────────────────────────────────────────────
// 4.3 — Inline edit input appears and is editable
// ──────────────────────────────────────────────

describe("Quantity quick-edit — inline input", () => {
  it("4.3 quantity input is rendered and editable", async () => {
    useAppStore.getState().addItem(1, "Coca-Cola 500ml", 150);

    const user = renderPOS();
    render(
      <StoreProvider initialStoreId="store_1">
        <POSPage />
      </StoreProvider>,
    );

    const qtyInput = screen.getByRole("spinbutton", { name: /Cantidad de Coca-Cola/i });
    expect(qtyInput).toBeInTheDocument();
    expect(qtyInput).toHaveValue(1);

    // Type a new quantity
    await user.clear(qtyInput);
    await user.type(qtyInput, "3");

    expect(qtyInput).toHaveValue(3);
  });
});

// ──────────────────────────────────────────────
// 4.4 — Enter confirms, Escape cancels, 0 removes
// ──────────────────────────────────────────────

describe("Quantity quick-edit — keyboard actions", () => {
  it("4.4 Enter key confirms the inline edit", async () => {
    useAppStore.getState().addItem(1, "Coca-Cola 500ml", 150);
    useAppStore.getState().updateQuantity(1, 2);

    const user = renderPOS();
    render(
      <StoreProvider initialStoreId="store_1">
        <POSPage />
      </StoreProvider>,
    );

    const qtyInput = screen.getByRole("spinbutton", { name: /Cantidad de Coca-Cola/i });

    // Change to 5 and press Enter
    await user.clear(qtyInput);
    await user.type(qtyInput, "5");
    await user.keyboard("{Enter}");

    // Quantity should be confirmed as 5
    const item = useAppStore.getState().items[0];
    expect(item.quantity).toBe(5);
    expect(item.subtotal).toBe(750);
  });

  it("4.4 Escape key cancels inline edit (reverts to original)", async () => {
    const user = renderPOS();
    useAppStore.getState().addItem(1, "Coca-Cola 500ml", 150);
    expect(useAppStore.getState().items).toHaveLength(1);

    render(
      <StoreProvider initialStoreId="store_1">
        <POSPage />
      </StoreProvider>,
    );

    const qtyInput = screen.getByRole("spinbutton", { name: /Cantidad de Coca-Cola/i });

    // Type a new value but press Escape
    await user.clear(qtyInput);
    await user.type(qtyInput, "5");
    await user.keyboard("{Escape}");

    // The input should revert to showing the original quantity (1)
    const state = useAppStore.getState();
    expect(state.items[0].quantity).toBe(1);
  });

  it("4.4 typing 0 and pressing Enter removes the item", async () => {
    useAppStore.getState().addItem(1, "Coca-Cola 500ml", 150);
    useAppStore.getState().addItem(2, "Leche Entera 1L", 200);

    const user = renderPOS();
    render(
      <StoreProvider initialStoreId="store_1">
        <POSPage />
      </StoreProvider>,
    );

    expect(useAppStore.getState().items).toHaveLength(2);

    const qtyInput = screen.getByRole("spinbutton", { name: /Cantidad de Coca-Cola/i });

    // Type 0 and press Enter
    // First clear and type 0
    await user.clear(qtyInput);
    await user.type(qtyInput, "0");

    // Press Enter — onBlur with 0 calls safeUpdateQuantity → updateQuantity(1, 0) → removeItem
    await user.keyboard("{Enter}");

    const items = useAppStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].productId).toBe(2);
  });
});

// ──────────────────────────────────────────────
// 4.7 — ArrowUp/ArrowDown in quantity input
// ──────────────────────────────────────────────

describe("Quantity quick-edit — ArrowUp/ArrowDown", () => {
  it("ArrowUp increments quantity by 1", async () => {
    useAppStore.getState().addItem(1, "Coca-Cola 500ml", 150);

    const user = renderPOS();
    render(
      <StoreProvider initialStoreId="store_1">
        <POSPage />
      </StoreProvider>,
    );

    const qtyInput = screen.getByRole("spinbutton", { name: /Cantidad de Coca-Cola/i });
    await user.click(qtyInput);

    await user.keyboard("{ArrowUp}");

    const item = useAppStore.getState().items[0];
    expect(item.quantity).toBe(2);
  });

  it("ArrowDown decrements quantity by 1", async () => {
    useAppStore.getState().addItem(1, "Coca-Cola 500ml", 150);
    useAppStore.getState().updateQuantity(1, 5);

    const user = renderPOS();
    render(
      <StoreProvider initialStoreId="store_1">
        <POSPage />
      </StoreProvider>,
    );

    const qtyInput = screen.getByRole("spinbutton", { name: /Cantidad de Coca-Cola/i });
    await user.click(qtyInput);

    await user.keyboard("{ArrowDown}");

    const item = useAppStore.getState().items[0];
    expect(item.quantity).toBe(4);
  });

  it("ArrowDown at qty=1 removes item", async () => {
    useAppStore.getState().addItem(1, "Coca-Cola 500ml", 150);
    useAppStore.getState().addItem(2, "Leche Entera 1L", 200);

    const user = renderPOS();
    render(
      <StoreProvider initialStoreId="store_1">
        <POSPage />
      </StoreProvider>,
    );

    const qtyInput = screen.getByRole("spinbutton", { name: /Cantidad de Coca-Cola/i });
    await user.click(qtyInput);

    await user.keyboard("{ArrowDown}");

    expect(useAppStore.getState().items).toHaveLength(1);
    expect(useAppStore.getState().items[0].productId).toBe(2);
  });

  it("Shift+ArrowUp increments quantity by 10", async () => {
    useAppStore.getState().addItem(1, "Coca-Cola 500ml", 150);

    const user = renderPOS();
    render(
      <StoreProvider initialStoreId="store_1">
        <POSPage />
      </StoreProvider>,
    );

    const qtyInput = screen.getByRole("spinbutton", { name: /Cantidad de Coca-Cola/i });
    await user.click(qtyInput);

    await user.keyboard("{Shift>}{ArrowUp}{/Shift}");

    const item = useAppStore.getState().items[0];
    expect(item.quantity).toBe(11);
  });

  it("Shift+ArrowDown decrements quantity by 10", async () => {
    useAppStore.getState().addItem(1, "Coca-Cola 500ml", 150);
    useAppStore.getState().updateQuantity(1, 25);

    const user = renderPOS();
    render(
      <StoreProvider initialStoreId="store_1">
        <POSPage />
      </StoreProvider>,
    );

    const qtyInput = screen.getByRole("spinbutton", { name: /Cantidad de Coca-Cola/i });
    await user.click(qtyInput);

    await user.keyboard("{Shift>}{ArrowDown}{/Shift}");

    const item = useAppStore.getState().items[0];
    expect(item.quantity).toBe(15);
  });
});
