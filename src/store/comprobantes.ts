import { create } from "zustand";
import { api } from "@/lib/api";

export type ComprobanteTipo =
  | "factura"
  | "boleta"
  | "nota_credito"
  | "nota_debito"
  | "ticket";

export type ComprobanteItem = {
  id: number;
  comprobante_id: number;
  product_id: number | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  combo_name: string;
  bulto_name: string;
};

export type Comprobante = {
  id: number;
  tipo: ComprobanteTipo;
  numero: string;
  sequentialNumber: number;
  cliente_nombre: string;
  cliente_cuit: string;
  cliente_direccion: string;
  fecha: string;
  payment_method: "cash" | "card" | "mixed" | "credit" | "mercadopago" | null;
  subtotal: number;
  iva: number;
  total: number;
  sale_id: number | null;
  notes: string;
  createdBy: string;
  items: ComprobanteItem[];
  store_id: string;
};

const TIPO_LABELS: Record<ComprobanteTipo, string> = {
  factura: "Factura",
  boleta: "Boleta",
  nota_credito: "Nota de Crédito",
  nota_debito: "Nota de Débito",
  ticket: "Ticket",
};

/** Normalize a raw comprobante row from the API (snake_case) to the store type (camelCase). */
function normalizeComprobante(data: any): Comprobante {
  return {
    id: data.id,
    tipo: data.tipo,
    numero: data.numero,
    sequentialNumber: data.sequentialNumber ?? 0,
    cliente_nombre: data.cliente_nombre,
    cliente_cuit: data.cliente_cuit,
    cliente_direccion: data.cliente_direccion,
    fecha: data.fecha,
    payment_method: data.payment_method ?? null,
    subtotal: data.subtotal ?? 0,
    iva: data.iva ?? 0,
    total: data.total ?? 0,
    sale_id: data.sale_id ?? null,
    notes: data.notes ?? "",
    createdBy: data.created_by ?? "",
    items: Array.isArray(data.items) ? data.items : [],
    store_id: data.store_id,
  };
}

export function getTipoLabel(tipo: ComprobanteTipo): string {
  return TIPO_LABELS[tipo];
}

export type ComprobantesStore = {
  comprobantes: Comprobante[];

  loadComprobantes: (storeId: string) => Promise<void>;
  createComprobante: (data: {
    tipo: ComprobanteTipo;
    cliente_nombre: string;
    cliente_cuit?: string;
    cliente_direccion?: string;
    payment_method?: "cash" | "card" | "mixed" | "credit" | "mercadopago";
    notes?: string;
    created_by?: string;
    sale_id?: number;
    store_id: string;
    subtotal?: number;
    iva?: number;
    total?: number;
    items: Array<{
      product_id?: number;
      product_name: string;
      quantity: number;
      unit_price: number;
      subtotal: number;
      combo_name?: string | null;
      bulto_name?: string | null;
    }>;
    ivaPercent?: number;
  }) => Promise<Comprobante>;

  getComprobantesByStore: (storeId: string) => Comprobante[];
  getComprobanteById: (id: number) => Comprobante | null;
};

export const useComprobantesStore = create<ComprobantesStore>((set, get) => ({
  comprobantes: [],

  loadComprobantes: async (storeId) => {
    try {
      const rows = await api.get<Comprobante[]>(`/comprobantes?storeId=${encodeURIComponent(storeId)}`);
      set({ comprobantes: rows.map(normalizeComprobante) });
    } catch (err) {
      console.error("[comprobantes] loadComprobantes failed:", err);
    }
  },

  createComprobante: async (data) => {
    const comprobante = normalizeComprobante(await api.post<Comprobante>("/comprobantes", data));
    set({ comprobantes: [...get().comprobantes, comprobante] });
    return comprobante;
  },

  getComprobantesByStore: (storeId) =>
    get()
      .comprobantes.filter((c) => c.store_id === storeId)
      .sort((a, b) => b.id - a.id),

  getComprobanteById: (id) =>
    get().comprobantes.find((c) => c.id === id) ?? null,
}));
