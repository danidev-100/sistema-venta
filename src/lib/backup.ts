// ── Backup now exports store state (data lives in Zustand + PostgreSQL) ──

import { useProductsStore } from "@/store/products";
import { useCustomersStore } from "@/store/customers";
import { useAppStore } from "@/store";

type BackupData = Record<string, Record<string, unknown>[]>;

export async function exportBackup(): Promise<BackupData> {
  const data: BackupData = {};

  try {
    const products = useProductsStore.getState();
    if (products) {
      data.products = products.products?.map((p) => ({ ...p })) ?? [];
      data.categories = products.categories?.map((c) => ({ ...c })) ?? [];
    }

    const customers = useCustomersStore.getState();
    if (customers) {
      data.customers = customers.customers?.map((c) => ({ ...c })) ?? [];
    }

    const app = useAppStore.getState();
    if (app) {
      data.sales = app.completedSales?.map((s) => ({ ...s })) ?? [];
    }
  } catch (err) {
    console.error("[backup] export failed:", err);
  }

  return data;
}

export function downloadBackup(data: BackupData): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `bazar-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importBackup(file: File): Promise<{ tables: number; rows: number }> {
  const text = await file.text();
  const data: BackupData = JSON.parse(text);

  let tables = 0;
  let rows = 0;

  for (const [table, records] of Object.entries(data)) {
    if (Array.isArray(records) && records.length > 0) {
      tables++;
      rows += records.length;
    }
  }

  console.log("[backup] Import preview:", { tables, rows });
  return { tables, rows };
}
