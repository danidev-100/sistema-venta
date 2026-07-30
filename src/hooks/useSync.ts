// ──────────────────────────────────────────────
// Sync — no-op for web version (single DB, no sync needed)
// ──────────────────────────────────────────────

export type SyncStatus = "idle" | "syncing" | "success" | "error" | "offline";

export type SyncState = {
  status: SyncStatus;
  lastSyncedAt: string | null;
  error: string | null;
  isOnline: boolean;
};

const idleState: SyncState = {
  status: "idle",
  lastSyncedAt: null,
  error: null,
  isOnline: navigator.onLine,
};

export function getSyncState(): SyncState {
  return idleState;
}

export async function triggerSync(): Promise<null> {
  return null;
}

export function useSync(): SyncState & { triggerSync: () => Promise<null> } {
  return { ...idleState, triggerSync };
}
