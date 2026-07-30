import { useState, useRef, useEffect } from "react";
import { useCustomersStore, type Customer } from "@/store/customers";
import { useActiveStore } from "@/store/context";
import { useKeyboardListNavigation } from "@/hooks/useKeyboardListNavigation";

// ──────────────────────────────────────────────
// Props
// ──────────────────────────────────────────────

type CustomerSelectModalProps = {
  onSelect: (customer: Customer | null) => void;
  onClose: () => void;
};

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export default function CustomerSelectModal({
  onSelect,
  onClose,
}: CustomerSelectModalProps) {
  const { storeId } = useActiveStore();
  const searchCustomers = useCustomersStore((s) => s.searchCustomers);
  const getCustomersByStore = useCustomersStore((s) => s.getCustomersByStore);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const customers = query.trim()
    ? searchCustomers(storeId, query)
    : getCustomersByStore(storeId);

  const { selectedIndex, handleKeyDown, setSelectedIndex } = useKeyboardListNavigation({
    itemCount: customers.length,
    onSelect: (i) => {
      onSelect(customers[i]);
      onClose();
    },
    enabled: customers.length > 0,
  });

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-pos-surface rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-pos-text">
              Seleccionar Cliente
            </h2>
            <button
              onClick={onClose}
              className="text-pos-muted text-xl leading-none touch-target w-10 h-10 flex items-center justify-center rounded-lg hover:bg-pos-background transition-colors"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>

          {/* Search */}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar cliente…"
            className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target"
          />

          {/* "Consumidor Final" button */}
          <button
            onClick={() => {
              onSelect(null);
              onClose();
            }}
            className="w-full text-left px-4 py-3 rounded-xl border border-pos-muted/20 text-pos-text font-medium touch-target hover:bg-pos-background transition-colors"
          >
            Consumidor Final
          </button>

          {/* Divider */}
          {customers.length > 0 && (
            <div className="border-t border-pos-muted/10" />
          )}

          {/* Customer list */}
          <div className="max-h-60 overflow-y-auto space-y-1">
            {customers.length === 0 ? (
              <p className="text-sm text-pos-muted italic text-center py-8">
                {query
                  ? "No se encontraron clientes"
                  : "Todavía no hay clientes"}
              </p>
            ) : (
              customers.map((c, i) => (
                <button
                  key={c.id}
                  onClick={() => {
                    onSelect(c);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(i)}
                  className={`w-full text-left px-4 py-3 rounded-xl touch-target transition-colors border ${
                    i === selectedIndex
                      ? "bg-pos-secondary/10 border-pos-secondary/30 text-pos-text"
                      : "bg-pos-background/50 hover:bg-pos-background border-pos-muted/10"
                  }`}
                >
                  <div className="text-sm font-medium text-pos-text">
                    {c.name}
                  </div>
                  <div className="text-xs text-pos-muted mt-0.5">
                    {c.phone && <span>{c.phone}</span>}
                    {c.phone && (c.email || c.cuit) && <span> · </span>}
                    {c.email && <span>{c.email}</span>}
                    {c.email && c.cuit && <span> · </span>}
                    {c.cuit && <span>CUIT: {c.cuit}</span>}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
