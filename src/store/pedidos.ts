import { create } from "zustand";
import { api } from "@/lib/api";
import { useProductsStore } from "./products";

export type PedidoItem = {
  id: number;
  pedido_id: number;
  product_id: number | null;
  product_name: string;
  quantity: number;
  received_qty: number;
  unit_price: number;
  subtotal: number;
};

export type PedidoStatus = "pending" | "received" | "cancelled" | "partial";

export type Pedido = {
  id: number;
  proveedor_id: number;
  proveedor_name: string;
  date: string;
  status: PedidoStatus;
  total: number;
  notes: string;
  items: PedidoItem[];
  store_id: string;
};

const STATUS_LABELS: Record<PedidoStatus, string> = {
  pending: "Pendiente",
  received: "Recibido",
  cancelled: "Cancelado",
  partial: "Parcial",
};

export function getStatusLabel(status: PedidoStatus): string {
  return STATUS_LABELS[status];
}

export type PedidosStore = {
  pedidos: Pedido[];
  loading: boolean;

  /** Load pedidos for a store from the API. */
  loadPedidos: (storeId: string) => Promise<void>;

  addPedido: (data: {
    proveedor_id: number;
    proveedor_name: string;
    date: string;
    notes: string;
    store_id: string;
    items: Array<{
      product_id: number | null;
      product_name: string;
      quantity: number;
      unit_price: number;
      subtotal: number;
    }>;
  }) => Promise<Pedido>;
  updatePedido: (id: number, data: {
    date: string;
    notes: string;
    items: Array<{
      id?: number;
      product_id: number | null;
      product_name: string;
      quantity: number;
      unit_price: number;
      subtotal: number;
    }>;
  }) => Promise<void>;
  updateStatus: (id: number, status: PedidoStatus) => Promise<void>;
  deletePedido: (id: number) => Promise<void>;
  getPedidosByStore: (storeId: string) => Pedido[];
  receiveItem: (pedidoId: number, itemId: number, quantity: number) => Promise<void>;
};

export const usePedidosStore = create<PedidosStore>((set, get) => ({
  pedidos: [],
  loading: false,

  loadPedidos: async (storeId) => {
    set({ loading: true });
    try {
      const pedidos = await api.get<Pedido[]>(`/pedidos?storeId=${encodeURIComponent(storeId)}`);
      set({ pedidos, loading: false });
    } catch (err) {
      console.error("[api] pedidos.loadPedidos failed:", err);
      set({ loading: false });
    }
  },

  addPedido: async (data) => {
    try {
      const pedido = await api.post<Pedido>("/pedidos", data);
      set({ pedidos: [...get().pedidos, pedido] });
      return pedido;
    } catch (err) {
      console.error("[api] pedidos.addPedido failed:", err);
      throw err;
    }
  },

  updatePedido: async (id, data) => {
    const existing = get().pedidos.find((p) => p.id === id);
    if (!existing) return;

    try {
      const updated = await api.put<Pedido>(`/pedidos/${id}`, data);
      set({ pedidos: get().pedidos.map((p) => (p.id === id ? updated : p)) });
    } catch (err) {
      console.error("[api] pedidos.updatePedido failed:", err);
      throw err;
    }
  },

  updateStatus: async (id, status) => {
    const existing = get().pedidos.find((p) => p.id === id);
    if (!existing) return;

    set({
      pedidos: get().pedidos.map((p) =>
        p.id === id ? { ...p, status } : p,
      ),
    });

    try {
      await api.put(`/pedidos/${id}/status`, { status });
    } catch (err) {
      console.error("[api] pedidos.updateStatus failed:", err);
    }
  },

  deletePedido: async (id) => {
    const existing = get().pedidos.find((p) => p.id === id);
    if (!existing) return;

    try {
      await api.del(`/pedidos/${id}`);
      set({
        pedidos: get().pedidos.filter((p) => p.id !== id),
      });
    } catch (err) {
      console.error("[api] pedidos.deletePedido failed:", err);
      throw err;
    }
  },

  receiveItem: async (pedidoId, itemId, quantity) => {
    const existing = get().pedidos.find((p) => p.id === pedidoId);
    if (!existing) return;

    const item = existing.items.find((i) => i.id === itemId);
    if (!item) return;

    const maxReceive = item.quantity - item.received_qty;
    if (maxReceive <= 0) return;

    const qtyToReceive = Math.min(quantity, maxReceive);
    if (qtyToReceive <= 0) return;

    const newReceived = item.received_qty + qtyToReceive;

    // Update the item
    const updatedItems = existing.items.map((i) =>
      i.id === itemId ? { ...i, received_qty: newReceived } : i,
    );

    // Update stock
    if (item.product_id != null) {
      const productsState = useProductsStore.getState();
      const product = productsState.products.find((p) => p.id === item.product_id);
      if (product) {
        productsState.adjustStock(item.product_id, product.stock + qtyToReceive);
      }
    }

    // Recalculate status
    const allReceived = updatedItems.every((i) => i.received_qty >= i.quantity);
    const someReceived = updatedItems.some((i) => i.received_qty > 0);

    let newStatus: PedidoStatus;
    if (allReceived) newStatus = "received";
    else if (someReceived) newStatus = "partial";
    else newStatus = existing.status;

    set({
      pedidos: get().pedidos.map((p) =>
        p.id === pedidoId
          ? { ...p, items: updatedItems, status: newStatus }
          : p,
      ),
    });

    try {
      await api.put(`/pedidos/${pedidoId}/items/${itemId}/receive`, {
        quantity: qtyToReceive,
      });
    } catch (err) {
      console.error("[api] pedidos.receiveItem failed:", err);
    }
  },

  getPedidosByStore: (storeId) =>
    get()
      .pedidos.filter((p) => p.store_id === storeId)
      .sort((a, b) => b.date.localeCompare(a.date)),
}));
