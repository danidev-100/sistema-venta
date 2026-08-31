// ── Backup real contra la API del servidor (Express + Postgres) ──
//
// El export ya no lee el estado en memoria de Zustand: descarga un JSON
// completo de TODAS las tablas de la tienda desde el servidor.
// El import envía ese JSON al servidor, que reemplaza los datos dentro de
// una transacción (rollback total si algo falla).

import { api } from "@/lib/api";

export type BackupDocument = {
  version: number;
  exported_at: string;
  store_id: string;
  data: Record<string, Record<string, unknown>[]>;
};

export type ImportResult = {
  tables_restored: number;
  counts: Record<string, number>;
  deleted?: Record<string, number>;
};

function buildFilename(storeId: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `respaldo-${storeId}-${date}.json`;
}

export async function exportBackup(storeId: string): Promise<BackupDocument> {
  const doc = await api.get<BackupDocument>(
    "/backup/export?storeId=" + encodeURIComponent(storeId),
  );

  const blob = new Blob([JSON.stringify(doc, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = buildFilename(storeId);
  a.click();
  URL.revokeObjectURL(url);

  return doc;
}

export async function importBackup(storeId: string, file: File): Promise<ImportResult> {
  const text = await file.text();

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("El archivo no es un JSON válido");
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Formato de respaldo inválido");
  }

  const doc = parsed as Partial<BackupDocument>;
  if (typeof doc.version !== "number" || doc.version <= 0) {
    throw new Error("El respaldo no tiene una versión válida");
  }
  if (!doc.data || typeof doc.data !== "object") {
    throw new Error("El respaldo no contiene datos de tablas");
  }

  return api.post<ImportResult>("/backup/import", { storeId, data: parsed });
}