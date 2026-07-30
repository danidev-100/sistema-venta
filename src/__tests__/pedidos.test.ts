import { describe, it, expect, beforeEach } from "vitest";
import { usePedidosStore, getStatusLabel } from "@/store/pedidos";

function resetStore() {
  usePedidosStore.setState({ pedidos: [] });
}

beforeEach(() => {
  resetStore();
});

const baseItem = {
  product_id: null,
  product_name: "Producto X",
  quantity: 2,
  unit_price: 100,
  subtotal: 200,
};

describe("Pedidos CRUD", () => {
  it("adds a pedido with items and computes total", () => {
    const pedido = usePedidosStore.getState().addPedido({
      proveedor_id: 1,
      proveedor_name: "Distribuidora SRL",
      date: "2026-06-21",
      notes: "Urgente",
      store_id: "store_1",
      items: [
        { product_name: "Item A", quantity: 3, unit_price: 50, subtotal: 150, product_id: null },
        { product_name: "Item B", quantity: 1, unit_price: 200, subtotal: 200, product_id: null },
      ],
    });

    expect(pedido.id).toBeGreaterThan(0);
    expect(pedido.proveedor_name).toBe("Distribuidora SRL");
    expect(pedido.date).toBe("2026-06-21");
    expect(pedido.status).toBe("pending");
    expect(pedido.total).toBe(350);
    expect(pedido.notes).toBe("Urgente");
    expect(pedido.items).toHaveLength(2);
    expect(pedido.items[0].product_name).toBe("Item A");
    expect(pedido.items[1].product_name).toBe("Item B");
  });

  it("increments id for each new pedido", () => {
    const p1 = usePedidosStore.getState().addPedido({
      proveedor_id: 1,
      proveedor_name: "A",
      date: "2026-06-21",
      notes: "",
      store_id: "store_1",
      items: [{ ...baseItem, product_name: "X" }],
    });
    const p2 = usePedidosStore.getState().addPedido({
      proveedor_id: 2,
      proveedor_name: "B",
      date: "2026-06-22",
      notes: "",
      store_id: "store_1",
      items: [{ ...baseItem, product_name: "Y" }],
    });

    expect(p2.id).toBe(p1.id + 1);
  });

  it("rounds total to 2 decimal places", () => {
    const pedido = usePedidosStore.getState().addPedido({
      proveedor_id: 1,
      proveedor_name: "A",
      date: "2026-06-21",
      notes: "",
      store_id: "store_1",
      items: [
        { product_name: "I1", quantity: 1, unit_price: 10.333, subtotal: 10.333, product_id: null },
        { product_name: "I2", quantity: 1, unit_price: 20.667, subtotal: 20.667, product_id: null },
      ],
    });

    expect(pedido.total).toBe(31.00);
  });

  it("updates pedido status", () => {
    const pedido = usePedidosStore.getState().addPedido({
      proveedor_id: 1,
      proveedor_name: "A",
      date: "2026-06-21",
      notes: "",
      store_id: "store_1",
      items: [{ ...baseItem }],
    });

    usePedidosStore.getState().updateStatus(pedido.id, "received");
    const updated = usePedidosStore.getState().pedidos.find((p) => p.id === pedido.id)!;
    expect(updated.status).toBe("received");
  });

  it("silently ignores updating status of non-existent pedido", () => {
    usePedidosStore.getState().updateStatus(999, "received");
    expect(usePedidosStore.getState().pedidos).toHaveLength(0);
  });

  it("deletes a pedido", () => {
    const pedido = usePedidosStore.getState().addPedido({
      proveedor_id: 1,
      proveedor_name: "A",
      date: "2026-06-21",
      notes: "",
      store_id: "store_1",
      items: [{ ...baseItem }],
    });

    usePedidosStore.getState().deletePedido(pedido.id);
    expect(
      usePedidosStore.getState().pedidos.find((p) => p.id === pedido.id),
    ).toBeUndefined();
  });

  it("silently ignores deleting non-existent pedido", () => {
    usePedidosStore.getState().addPedido({
      proveedor_id: 1,
      proveedor_name: "A",
      date: "2026-06-21",
      notes: "",
      store_id: "store_1",
      items: [{ ...baseItem }],
    });

    usePedidosStore.getState().deletePedido(999);
    expect(usePedidosStore.getState().pedidos).toHaveLength(1);
  });
});

describe("getPedidosByStore", () => {
  beforeEach(() => {
    usePedidosStore.getState().addPedido({
      proveedor_id: 1,
      proveedor_name: "Alpha",
      date: "2026-06-20",
      notes: "",
      store_id: "store_1",
      items: [{ ...baseItem }],
    });
    usePedidosStore.getState().addPedido({
      proveedor_id: 2,
      proveedor_name: "Beta",
      date: "2026-06-21",
      notes: "",
      store_id: "store_1",
      items: [{ ...baseItem }],
    });
    usePedidosStore.getState().addPedido({
      proveedor_id: 3,
      proveedor_name: "Other store",
      date: "2026-06-22",
      notes: "",
      store_id: "store_2",
      items: [{ ...baseItem }],
    });
  });

  it("returns only pedidos for the given store, newest first", () => {
    const result = usePedidosStore.getState().getPedidosByStore("store_1");
    expect(result).toHaveLength(2);
    expect(result[0].proveedor_name).toBe("Beta");
    expect(result[1].proveedor_name).toBe("Alpha");
  });

  it("returns empty array for store with no pedidos", () => {
    const result = usePedidosStore.getState().getPedidosByStore("store_3");
    expect(result).toHaveLength(0);
  });
});

describe("getStatusLabel", () => {
  it("returns Spanish labels for each status", () => {
    expect(getStatusLabel("pending")).toBe("Pendiente");
    expect(getStatusLabel("received")).toBe("Recibido");
    expect(getStatusLabel("cancelled")).toBe("Cancelado");
  });
});
