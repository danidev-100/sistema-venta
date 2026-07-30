import { useState, useMemo } from "react";
import { useInvoicesStore, type Invoice } from "@/store/invoices";
import { formatCurrency } from "@/lib/format";

// ──────────────────────────────────────────────
// Props
// ──────────────────────────────────────────────

type InvoiceListProps = {
  storeId: string;
  selectedInvoiceId: number | null;
  onSelectInvoice: (id: number | null) => void;
};

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export default function InvoiceList({
  storeId,
  selectedInvoiceId,
  onSelectInvoice,
}: InvoiceListProps) {
  const invoices = useInvoicesStore((s) => s.invoices);
  const searchInvoices = useInvoicesStore((s) => s.searchInvoices);

  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterUser, setFilterUser] = useState<string | null>(null);

  // Unique users from store invoices
  const users = useMemo(() => {
    const set = new Set(invoices.map((inv) => inv.createdBy));
    return [...set].filter(Boolean).sort();
  }, [invoices]);

  const filtered: Invoice[] = useMemo(() => {
    return searchInvoices(
      storeId,
      searchQuery || undefined,
      dateFrom || undefined,
      dateTo || undefined,
      filterUser ?? undefined,
    );
  }, [storeId, searchQuery, dateFrom, dateTo, filterUser, searchInvoices]);

  return (
    <div className="flex flex-col h-full">
      {/* ── Search / Filter Controls ── */}
      <div className="space-y-2 mb-4">
        {/* User filter dropdown */}
        <div className="relative">
          <select
            value={filterUser ?? ""}
            onChange={(e) => setFilterUser(e.target.value || null)}
            className="w-full px-3 py-1.5 text-xs rounded-lg bg-pos-background border border-pos-muted/20 text-pos-text focus:outline-none focus:ring-2 focus:ring-pos-secondary/50 appearance-none"
          >
            <option value="">Todos los usuarios</option>
            {users.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-pos-muted pointer-events-none"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>

        <input
          type="text"
          placeholder="Buscá por factura o cliente..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-1.5 text-sm rounded-lg bg-pos-background border border-pos-muted/20 text-pos-text placeholder-pos-muted/50 focus:outline-none focus:ring-2 focus:ring-pos-secondary/50"
        />
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-xs text-pos-muted mb-0.5">Desde</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-2 py-1 text-xs rounded-lg bg-pos-background border border-pos-muted/20 text-pos-text focus:outline-none focus:ring-2 focus:ring-pos-secondary/50"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-pos-muted mb-0.5">Hasta</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-2 py-1 text-xs rounded-lg bg-pos-background border border-pos-muted/20 text-pos-text focus:outline-none focus:ring-2 focus:ring-pos-secondary/50"
            />
          </div>
        </div>
      </div>

      {/* ── Invoice List ── */}
      <div className="flex-1 overflow-y-auto space-y-1">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-xs text-pos-muted italic">
              {searchQuery || dateFrom || dateTo || filterUser
                ? "No hay facturas que coincidan con tu búsqueda"
                : "Todavía no hay facturas. Generá una desde una venta completada."}
            </p>
          </div>
        ) : (
          filtered.map((inv) => {
            const isSelected = inv.id === selectedInvoiceId;
            return (
              <button
                key={inv.id}
                onClick={() => onSelectInvoice(inv.id)}
                className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                  isSelected
                    ? "border-pos-secondary bg-pos-secondary/10"
                    : "border-transparent hover:bg-pos-background/50"
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-sm font-medium text-pos-text">
                    {inv.invoiceNumber}
                  </span>
                  <span className="text-xs font-mono font-bold">
                    {formatCurrency(inv.total)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-pos-muted">
                  <span className="truncate max-w-[140px]">{inv.customer}</span>
                  <span>
                    {new Date(inv.date).toLocaleDateString()}
                  </span>
                </div>
                <div className="text-[10px] text-pos-muted/50 mt-0.5">
                  por {inv.createdBy}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
