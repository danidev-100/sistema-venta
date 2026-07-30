import { useActiveStore } from "@/store/context";
import { eq } from "drizzle-orm";
import { useCallback, useMemo } from "react";
import type { AnyColumn, SQL, Table } from "drizzle-orm";

// ──────────────────────────────────────────────
// Type helpers for building filtered queries
// ──────────────────────────────────────────────

/**
 * Generic constraint builder that prepends a `store_id = ?` condition
 * to a Drizzle query's WHERE clause.
 *
 * Used internally by `useStoreFilter` to scope every query to the
 * currently active store.
 */
type FilterFn = <T extends { store_id: AnyColumn }>(
  table: T,
  ...conditions: SQL[]
) => SQL[];

// ──────────────────────────────────────────────
// Hook
// ──────────────────────────────────────────────

/**
 * Returns utility functions that automatically scope Drizzle queries
 * to the active `store_id` from React Context.
 *
 * Usage:
 * ```ts
 * const { storeId, where } = useStoreFilter();
 *
 * // SELECT * FROM products WHERE store_id = '...'
 * const rows = await localDb.select().from(products).where(where(products));
 *
 * // SELECT * FROM products WHERE store_id = '...' AND name LIKE '%Coca%'
 * const filtered = await localDb
 *   .select()
 *   .from(products)
 *   .where(where(products, like(products.name, '%Coca%')));
 * ```
 */
export function useStoreFilter() {
  const { storeId, setStoreId } = useActiveStore();

  /**
   * Builds a WHERE clause array that always includes the `store_id` filter
   * plus any additional conditions.
   *
   * This ensures NO query can accidentally leak data across stores.
   */
  const where = useCallback<FilterFn>(
    (table, ...conditions) => {
      const storeCondition = eq(
        (table as any).store_id as AnyColumn,
        storeId,
      );
      return conditions.length > 0
        ? [storeCondition, ...conditions]
        : [storeCondition];
    },
    [storeId],
  );

  /**
   * Convenience: returns the active store ID + the store setter.
   */
  return useMemo(
    () => ({
      storeId,
      setStoreId,
      where,
    }),
    [storeId, setStoreId, where],
  );
}
