import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

/**
 * Store context — provides the active `store_id` to the entire component tree.
 *
 * All data-access hooks (e.g. `useStoreFilter`) read from this context to
 * scope queries and mutations to the currently selected store.
 *
 * Changing the store clears the cart via the Zustand store and refreshes
 * all data-bound views.
 */

type StoreContextValue = {
  storeId: string;
  setStoreId: (id: string) => void;
};

const StoreContext = createContext<StoreContextValue | null>(null);

type StoreProviderProps = {
  /** The initial store ID to use at app startup. */
  initialStoreId: string;
  children: ReactNode;
};

export function StoreProvider({
  initialStoreId,
  children,
}: StoreProviderProps) {
  const [storeId, setStoreIdState] = useState<string>(initialStoreId);

  const setStoreId = useCallback(
    (id: string) => {
      setStoreIdState(id);
      // Cart is cleared on store switch via a Zustand subscription
      // in the useStoreFilter hook (see src/hooks/useStoreFilter.ts).
    },
    [],
  );

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
