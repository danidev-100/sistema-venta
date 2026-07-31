import { create } from "zustand";
import { api } from "@/lib/api";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type ExpenseCategory =
  | "Alquiler"
  | "Servicios"
  | "Insumos"
  | "Sueldos"
  | "Impuestos"
  | "Marketing"
  | "Mantenimiento"
  | "Varios";

export type PaymentMethod = "cash" | "card";

export type Expense = {
  id: number;
  description: string;
  amount: number;
  category: ExpenseCategory;
  date: string; // ISO date YYYY-MM-DD
  paymentMethod: PaymentMethod;
  storeId: string;
  createdAt: string;
  updatedAt: string;
};

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "Alquiler",
  "Servicios",
  "Insumos",
  "Sueldos",
  "Impuestos",
  "Marketing",
  "Mantenimiento",
  "Varios",
];

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  Alquiler: "Alquiler",
  Servicios: "Servicios",
  Insumos: "Insumos",
  Sueldos: "Sueldos",
  Impuestos: "Impuestos",
  Marketing: "Marketing",
  Mantenimiento: "Mantenimiento",
  Varios: "Varios",
};

export type MonthlySummary = {
  byCategory: Record<ExpenseCategory, { total: number; count: number }>;
  byPaymentMethod: Record<PaymentMethod, { total: number; count: number }>;
  total: number;
};

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

const VALID_CATEGORIES = new Set<ExpenseCategory>(EXPENSE_CATEGORIES);
const VALID_PAYMENT_METHODS = new Set<PaymentMethod>(["cash", "card"]);

function validateExpense(
  data: Omit<Expense, "id" | "createdAt" | "updatedAt">,
): void {
  if (!data.description || data.description.trim().length === 0) {
    throw new Error("La descripción es requerida");
  }
  if (typeof data.amount !== "number" || data.amount <= 0) {
    throw new Error("El importe debe ser mayor a 0");
  }
  if (!VALID_CATEGORIES.has(data.category)) {
    throw new Error("Categoría inválida");
  }
  if (!VALID_PAYMENT_METHODS.has(data.paymentMethod)) {
    throw new Error("Medio de pago inválido");
  }
  if (!data.date || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
    throw new Error("Fecha inválida (use YYYY-MM-DD)");
  }
}

function buildSummary(expenses: Expense[]): MonthlySummary {
  const byCategory = {} as Record<ExpenseCategory, { total: number; count: number }>;
  for (const cat of EXPENSE_CATEGORIES) {
    byCategory[cat] = { total: 0, count: 0 };
  }

  const byPaymentMethod: Record<PaymentMethod, { total: number; count: number }> = {
    cash: { total: 0, count: 0 },
    card: { total: 0, count: 0 },
  };

  let total = 0;

  for (const exp of expenses) {
    byCategory[exp.category].total += exp.amount;
    byCategory[exp.category].count += 1;
    byPaymentMethod[exp.paymentMethod].total += exp.amount;
    byPaymentMethod[exp.paymentMethod].count += 1;
    total += exp.amount;
  }

  // Round for precision
  for (const cat of EXPENSE_CATEGORIES) {
    byCategory[cat].total = Math.round(byCategory[cat].total * 100) / 100;
  }
  byPaymentMethod.cash.total = Math.round(byPaymentMethod.cash.total * 100) / 100;
  byPaymentMethod.card.total = Math.round(byPaymentMethod.card.total * 100) / 100;
  total = Math.round(total * 100) / 100;

  return { byCategory, byPaymentMethod, total };
}

// ──────────────────────────────────────────────
// Store shape
// ──────────────────────────────────────────────

export type ExpensesStore = {
  expenses: Expense[];
  loading: boolean;

  /** Normalize a raw API row (snake_case) to the store type (camelCase). */
  normalizeExpense: (raw: any) => Expense;

  /** Load expenses for a store from the API. */
  loadExpenses: (storeId: string) => Promise<void>;

  /** Add a new expense. Returns the created expense with generated id and timestamps. */
  addExpense: (
    data: Omit<Expense, "id" | "createdAt" | "updatedAt">,
  ) => Promise<Expense>;

  /** Update an existing expense. Throws if the id does not exist. */
  updateExpense: (
    id: number,
    data: Partial<Omit<Expense, "id" | "createdAt" | "updatedAt">>,
  ) => Promise<void>;

  /** Delete an expense by id. Throws if the id does not exist. */
  deleteExpense: (id: number) => Promise<void>;

  /** Get expenses for a given year and month, most recent first. */
  getExpensesByMonth: (year: number, month: number, storeId: string) => Expense[];

  /** Get expenses within a date range (inclusive), most recent first. */
  getExpensesByDateRange: (
    from: string,
    to: string,
    storeId: string,
  ) => Expense[];

  /** Get expenses filtered by category, most recent first. */
  getExpensesByCategory: (
    category: ExpenseCategory,
    storeId: string,
  ) => Expense[];

  /** Get monthly summary with totals by category and payment method. */
  getMonthlySummary: (year: number, month: number, storeId: string) => MonthlySummary;
};

// ──────────────────────────────────────────────
// Store implementation
// ──────────────────────────────────────────────

export const useExpensesStore = create<ExpensesStore>((set, get) => ({
  expenses: [],
  loading: false,

  /** Normalize a raw expense row from the API (snake_case) to the store type (camelCase). */
  normalizeExpense(raw: any): Expense {
    return {
      id: raw.id,
      description: raw.description,
      amount: raw.amount,
      category: raw.category,
      date: raw.date,
      paymentMethod: raw.payment_method ?? raw.paymentMethod,
      storeId: raw.store_id ?? raw.storeId,
      createdAt: raw.created_at ?? raw.createdAt,
      updatedAt: raw.updated_at ?? raw.updatedAt,
    };
  },

  loadExpenses: async (storeId) => {
    set({ loading: true });
    try {
      const rows = await api.get<any[]>(`/expenses?storeId=${encodeURIComponent(storeId)}`);
      set({ expenses: rows.map(get().normalizeExpense), loading: false });
    } catch (err) {
      console.error("[api] expenses.loadExpenses failed:", err);
      set({ loading: false });
    }
  },

  addExpense: async (data) => {
    validateExpense(data);

    try {
      // Send camelCase — backend maps to snake_case internally
      const raw = await api.post<any>("/expenses", data);
      const expense = get().normalizeExpense(raw);
      set({ expenses: [...get().expenses, expense] });
      return expense;
    } catch (err) {
      console.error("[api] expenses.addExpense failed:", err);
      throw err;
    }
  },

  updateExpense: async (id, data) => {
    const existing = get().expenses.find((e) => e.id === id);
    if (!existing) throw new Error("Gasto no encontrado");

    if (data.category && !VALID_CATEGORIES.has(data.category)) {
      throw new Error("Categoría inválida");
    }
    if (data.paymentMethod && !VALID_PAYMENT_METHODS.has(data.paymentMethod)) {
      throw new Error("Medio de pago inválido");
    }
    if (data.amount !== undefined && data.amount <= 0) {
      throw new Error("El importe debe ser mayor a 0");
    }

    try {
      const raw = await api.put<any>(`/expenses/${id}`, data);
      const updated = get().normalizeExpense(raw);
      set({
        expenses: get().expenses.map((e) =>
          e.id === id ? updated : e,
        ),
      });
    } catch (err) {
      console.error("[api] expenses.updateExpense failed:", err);
      throw err;
    }
  },

  deleteExpense: async (id) => {
    const existing = get().expenses.find((e) => e.id === id);
    if (!existing) throw new Error("Gasto no encontrado");

    try {
      await api.del(`/expenses/${id}`);
      set({
        expenses: get().expenses.filter((e) => e.id !== id),
      });
    } catch (err) {
      console.error("[api] expenses.deleteExpense failed:", err);
      throw err;
    }
  },

  getExpensesByMonth: (year, month, storeId) => {
    return get()
      .expenses.filter((e) => {
        const [y, m] = e.date.split("-").map(Number);
        return y === year && m === month && e.storeId === storeId;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  },

  getExpensesByDateRange: (from, to, storeId) => {
    return get()
      .expenses.filter((e) => {
        return e.storeId === storeId && e.date >= from && e.date <= to;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  },

  getExpensesByCategory: (category, storeId) => {
    return get()
      .expenses.filter((e) => {
        return e.storeId === storeId && e.category === category;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  },

  getMonthlySummary: (year, month, storeId) => {
    const monthExpenses = get().expenses.filter((e) => {
      const [y, m] = e.date.split("-").map(Number);
      return y === year && m === month && e.storeId === storeId;
    });
    return buildSummary(monthExpenses);
  },
}));
