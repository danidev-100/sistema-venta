import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useAuthStore } from "@/store/auth";
import { useStoresStore } from "@/store/stores";
import { useAppStore } from "@/store";

/**
 * Store context — provides the active `store_id` to the entire component tree.
 *
 * All data-access hooks read from this context to scope queries and mutations
 * to the currently selected store.
 *
 * The initial store is resolved from localStorage (if it still exists in the
 * list of active stores) or falls back to the first active store. Changing the
 * store clears the cart via the Zustand store and refreshes all data-bound
 * views (pages reload on `storeId` change).
 */

const STORAGE_KEY = "active_store_id";

function readStoredStoreId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function persistStoreId(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // localStorage not available
  }
}

type StoreContextValue = {
  storeId: string;
  setStoreId: (id: string) => void;
};

const StoreContext = createContext<StoreContextValue | null>(null);

type StoreProviderProps = {
  /** Optional initial store ID override. Falls back to localStorage / first active store. */
  initialStoreId?: string;
  children: ReactNode;
};

export function StoreProvider({ initialStoreId, children }: StoreProviderProps) {
  const currentUser = useAuthStore((s) => s.currentUser);
  const activeStores = useStoresStore((s) => s.activeStores);
  const storesLoaded = useStoresStore((s) => s.loaded);

  const [storeId, setStoreIdState] = useState<string>(() => {
    if (initialStoreId) return initialStoreId;
    return readStoredStoreId() ?? "store_1";
  });

  // Load the list of active stores once the user is authenticated.
  useEffect(() => {
    if (currentUser && !storesLoaded) {
      useStoresStore.getState().loadActiveStores().catch(console.error);
    }
  }, [currentUser, storesLoaded]);

  // Reconcile: if the current store is no longer active (deactivated or a
  // persisted id that no longer exists), switch to the first active store.
  useEffect(() => {
    if (!storesLoaded || activeStores.length === 0) return;
    if (activeStores.some((s) => s.id === storeId)) return;
    const first = activeStores[0]?.id;
    if (first) {
      persistStoreId(first);
      setStoreIdState(first);
    }
  }, [storesLoaded, activeStores, storeId]);

  const setStoreId = useCallback((id: string) => {
    persistStoreId(id);
    useAppStore.getState().clearCart();
    setStoreIdState(id);
  }, []);

  return (
    <StoreContext.Provider value={{ storeId, setStoreId }}>
      {children}
    </StoreContext.Provider>
  );
}

/**
 * Hook to retrieve the active `store_id` from context.
 * Throws if used outside a `<StoreProvider>`.
 */
export function useActiveStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error(
      "useActiveStore must be used within a <StoreProvider>",
    );
  }
  return ctx;
}
