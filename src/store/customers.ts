import { create } from "zustand";
import { api } from "@/lib/api";

export type Customer = {
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  cuit: string;
  store_id: string;
  creditBalance: number;
  priceListId: number | null;
};

export type CreditPayment = {
  id: number;
  customer_id: number;
  amount: number;
  date: string;
  notes: string;
  sale_id: number | null;
  comprobante_id: number | null;
  store_id: string;
};

export type CustomersStore = {
  customers: Customer[];
  creditPayments: CreditPayment[];

  loadCustomers: (storeId: string) => Promise<void>;
  loadCreditPayments: (storeId: string) => Promise<void>;

  addCustomer: (data: Omit<Customer, "id">) => Promise<Customer>;
  updateCustomer: (id: number, updates: Partial<Omit<Customer, "id">>) => Promise<void>;
  deleteCustomer: (id: number) => Promise<void>;
  getCustomersByStore: (storeId: string) => Customer[];
  searchCustomers: (storeId: string, query: string) => Customer[];
  getCustomerById: (id: number) => Customer | null;
  /** Update a customer's credit balance (positive = debe, negative = haber). */
  updateCreditBalance: (customerId: number, delta: number, storeId: string, notes?: string, saleId?: number, comprobanteId?: number) => Promise<void>;
  /** Get all credit payments for a customer, newest first. */
  getCreditPaymentsByCustomer: (customerId: number) => CreditPayment[];
  /** Get customers with non-zero balance. */
  getCustomersWithDebt: (storeId: string) => Customer[];
};

export const useCustomersStore = create<CustomersStore>((set, get) => ({
  customers: [],
  creditPayments: [],

  loadCustomers: async (storeId) => {
    const customers = await api.get<Customer[]>(`/customers?storeId=${storeId}`);
    set({ customers });
  },

  loadCreditPayments: async (storeId) => {
    const creditPayments = await api.get<CreditPayment[]>(`/customers/credit-payments?storeId=${storeId}`);
    set({ creditPayments });
  },

  addCustomer: async (data) => {
    const dup = get().customers.find(
      (c) => c.name === data.name && c.store_id === data.store_id,
    );
    if (dup) {
      throw new Error(`Ya existe un cliente "${data.name}" en esta tienda`);
    }

    const customer = await api.post<Customer>("/customers", { ...data, priceListId: data.priceListId ?? null });
    set({ customers: [...get().customers, customer] });
    return customer;
  },

  updateCustomer: async (id, updates) => {
    if (updates.name) {
      const current = get().customers.find((c) => c.id === id);
      if (current) {
        const dup = get().customers.find(
          (c) =>
            c.name === updates.name &&
            c.store_id === (updates.store_id ?? current.store_id) &&
            c.id !== id,
        );
        if (dup) {
          throw new Error(`Ya existe un cliente "${updates.name}" en esta tienda`);
        }
      }
    }

    await api.put(`/customers/${id}`, updates);

    set({
      customers: get().customers.map((c) =>
        c.id === id ? { ...c, ...updates } : c,
      ),
    });
  },

  deleteCustomer: async (id) => {
    await api.del(`/customers/${id}`);

    set({
      customers: get().customers.filter((c) => c.id !== id),
    });
  },

  getCustomersByStore: (storeId) =>
    get()
      .customers.filter((c) => c.store_id === storeId)
      .sort((a, b) => a.name.localeCompare(b.name)),

  searchCustomers: (storeId, query) => {
    const q = query.toLowerCase();
    return get()
      .customers.filter(
        (c) =>
          c.store_id === storeId &&
          (c.name.toLowerCase().includes(q) ||
            c.phone.toLowerCase().includes(q) ||
            c.email.toLowerCase().includes(q) ||
            c.cuit.toLowerCase().includes(q)),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  getCustomerById: (id) =>
    get().customers.find((c) => c.id === id) ?? null,

  updateCreditBalance: async (customerId, delta, storeId, notes, saleId, comprobanteId) => {
    const customer = get().customers.find((c) => c.id === customerId);
    if (!customer) return;

    const newBalance = Math.round((customer.creditBalance + delta) * 100) / 100;

    set({
      customers: get().customers.map((c) =>
        c.id === customerId ? { ...c, creditBalance: newBalance } : c,
      ),
    });

    const payment = await api.post<CreditPayment>("/customers/credit-payment", {
      customer_id: customerId,
      amount: delta,
      notes: notes ?? "",
      sale_id: saleId ?? null,
      comprobante_id: comprobanteId ?? null,
      store_id: storeId,
    });

    set({ creditPayments: [...get().creditPayments, payment] });
  },

  getCreditPaymentsByCustomer: (customerId) =>
    get()
      .creditPayments.filter((p) => p.customer_id === customerId)
      .sort((a, b) => b.date.localeCompare(a.date)),

  getCustomersWithDebt: (storeId) =>
    get()
      .customers.filter((c) => c.store_id === storeId && c.creditBalance > 0)
      .sort((a, b) => b.creditBalance - a.creditBalance),
}));
