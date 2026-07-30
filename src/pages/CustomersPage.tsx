import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useActiveStore } from "@/store/context";
import { useCustomersStore, type Customer, type CreditPayment } from "@/store/customers";
import CustomerForm from "@/components/CustomerForm";
import CollectPaymentModal from "@/components/CollectPaymentModal";
import { exportTableToPdf, exportToExcel, type ExportColumn } from "@/lib/export-utils";
import { formatCurrency } from "@/lib/format";
import { printCreditPayment, printCreditStatement } from "@/lib/pdf-export";

// ──────────────────────────────────────────────
// Views
// ──────────────────────────────────────────────

type View =
  | { kind: "list" }
  | { kind: "create" }
  | { kind: "edit"; customer: Customer }
  | { kind: "detail"; customer: Customer };

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export default function CustomersPage() {
  const { storeId } = useActiveStore();
  const customers = useCustomersStore((s) => s.customers);
  const deleteCustomer = useCustomersStore((s) => s.deleteCustomer);

  const [view, setView] = useState<View>({ kind: "list" });
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const tableRef = useRef<HTMLTableSectionElement>(null);
  const [collectCustomer, setCollectCustomer] = useState<Customer | null>(null);

  const storeCustomers = useMemo(
    () =>
      customers
        .filter((c) => c.store_id === storeId)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [customers, storeId],
  );

  const filteredCustomers = useMemo(() => {
    if (!search.trim()) return storeCustomers;
    const q = search.toLowerCase();
    return storeCustomers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.cuit.toLowerCase().includes(q),
    );
  }, [storeCustomers, search]);

  const customerColumns: ExportColumn[] = [
    { header: "Nombre", key: "nombre" },
    { header: "Teléfono", key: "telefono" },
    { header: "Email", key: "email" },
    { header: "CUIT", key: "cuit" },
    { header: "Dirección", key: "direccion" },
    { header: "Saldo", key: "saldo" },
  ];

  const exportCustomersPdf = useCallback(() => {
    const data = filteredCustomers.map((c) => ({
      nombre: c.name,
      telefono: c.phone || "—",
      email: c.email || "—",
      cuit: c.cuit || "—",
      direccion: c.address || "—",
      saldo: c.creditBalance > 0 ? formatCurrency(c.creditBalance) : "—",
    }));
    exportTableToPdf(data, customerColumns, "Clientes");
  }, [filteredCustomers]);

  const exportCustomersExcel = useCallback(() => {
    const data = filteredCustomers.map((c) => ({
      nombre: c.name,
      telefono: c.phone || "",
      email: c.email || "",
      cuit: c.cuit || "",
      direccion: c.address || "",
      saldo: c.creditBalance,
    }));
    exportToExcel(data, customerColumns, "Clientes");
  }, [filteredCustomers]);

  // Reset selectedIndex when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredCustomers.length]);

  // Scroll selected row into view
  useEffect(() => {
    if (!tableRef.current) return;
    const row = tableRef.current.children[selectedIndex] as HTMLElement | undefined;
    row?.scrollIntoView?.({ block: "nearest" });
  }, [selectedIndex]);

  function handleCancel() {
    setView({ kind: "list" });
  }

  function handleSaved() {
    setView({ kind: "list" });
  }

  function handleDelete(customer: Customer) {
    const confirmed = window.confirm(
      `¿Eliminar a "${customer.name}"? Esta acción no se puede deshacer.`,
    );
    if (!confirmed) return;
    deleteCustomer(customer.id);
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* ── Header + Search ── */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-bold text-pos-text">Clientes</h1>
        {view.kind === "list" && (
          <div className="flex items-center gap-2">
            {filteredCustomers.length > 0 && (
              <>
                <button
                  onClick={exportCustomersExcel}
                  className="text-xs px-3 py-1.5 border border-pos-muted/30 text-pos-text rounded-lg touch-target hover:bg-pos-background/50 whitespace-nowrap"
                >
                  Excel
                </button>
                <button
                  onClick={exportCustomersPdf}
                  className="text-xs px-3 py-1.5 border border-pos-muted/30 text-pos-text rounded-lg touch-target hover:bg-pos-background/50 whitespace-nowrap"
                >
                  PDF
                </button>
              </>
            )}
            <button
              onClick={() => setView({ kind: "create" })}
              className="text-xs px-3 py-1.5 bg-pos-secondary text-white rounded-lg touch-target hover:opacity-90 whitespace-nowrap"
            >
              + Nuevo Cliente
            </button>
          </div>
        )}
      </div>

      {view.kind === "list" && (
        <>
          {/* Search input */}
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSelectedIndex(0); }}
            onKeyDown={(e) => {
              if (filteredCustomers.length === 0) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedIndex((prev) => Math.min(prev + 1, filteredCustomers.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedIndex((prev) => Math.max(prev - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                const customer = filteredCustomers[selectedIndex];
                if (customer) setView({ kind: "detail", customer });
              }
            }}
            placeholder="Buscar por nombre, teléfono, email o CUIT…"
            className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target"
          />

          {/* Table or empty state */}
          <div className="flex-1 bg-pos-surface rounded-xl border border-pos-muted/10 p-3 overflow-y-auto">
            {filteredCustomers.length === 0 ? (
              <div className="flex items-center justify-center h-48">
                <p className="text-sm text-pos-muted italic text-center">
                  {search
                    ? "No se encontraron clientes con ese criterio de búsqueda"
                    : "Todavía no hay clientes. Hacé clic en '+ Nuevo Cliente' para crear uno."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-pos-muted border-b border-pos-muted/20">
                      <th className="text-left py-2 pr-2 font-medium">Nombre</th>
                      <th className="text-left py-2 px-2 font-medium">
                        Teléfono
                      </th>
                      <th className="text-left py-2 px-2 font-medium">
                        Email
                      </th>
                      <th className="text-left py-2 px-2 font-medium">
                        CUIT
                      </th>
                      <th className="text-right py-2 px-2 font-medium">
                        Saldo
                      </th>
                      <th className="text-right py-2 pl-2 font-medium">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody ref={tableRef}>
                    {filteredCustomers.map((c, idx) => {
                      const isSelected = idx === selectedIndex;
                      return (
                      <tr
                        key={c.id}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`border-b border-pos-muted/10 transition-colors ${
                          isSelected
                            ? "bg-pos-secondary/10 ring-1 ring-pos-secondary/30"
                            : "hover:bg-pos-background/50"
                        }`}
                      >
                        <td className="py-2 pr-2 font-medium text-pos-text">
                          {c.name}
                        </td>
                        <td className="py-2 px-2 text-pos-muted">
                          {c.phone || "—"}
                        </td>
                        <td className="py-2 px-2 text-pos-muted">
                          {c.email || "—"}
                        </td>
                        <td className="py-2 px-2 text-pos-muted font-mono text-xs">
                          {c.cuit || "—"}
                        </td>
                        <td className={`py-2 px-2 text-right font-mono text-sm font-bold ${
                          c.creditBalance > 0 ? "text-pos-danger" : "text-pos-muted"
                        }`}>
                          {c.creditBalance > 0 ? formatCurrency(c.creditBalance) : "—"}
                        </td>
                        <td className="py-2 pl-2 text-right whitespace-nowrap">
                          <button
                            onClick={() => setView({ kind: "detail", customer: c })}
                            className="text-xs px-2 py-1 text-pos-secondary hover:bg-pos-secondary/10 rounded touch-target mr-1"
                          >
                            Ver
                          </button>
                          {c.creditBalance > 0 && (
                            <button
                              onClick={() => setCollectCustomer(c)}
                              className="text-xs px-2 py-1 text-pos-success hover:bg-pos-success/10 rounded touch-target mr-1"
                            >
                              Cobrar
                            </button>
                          )}
                          <button
                            onClick={() => setView({ kind: "edit", customer: c })}
                            className="text-xs px-2 py-1 text-pos-secondary hover:bg-pos-secondary/10 rounded touch-target"
                            aria-label={`Editar ${c.name}`}
                          >
                            ✎ Editar
                          </button>
                          <button
                            onClick={() => handleDelete(c)}
                            className="text-xs px-2 py-1 text-pos-danger hover:bg-pos-danger/10 rounded touch-target ml-1"
                            aria-label={`Eliminar ${c.name}`}
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {view.kind === "create" && (
        <div className="flex-1 bg-pos-surface rounded-xl border border-pos-muted/10 p-4">
          <CustomerForm
            editCustomer={null}
            onSaved={handleSaved}
            onCancel={handleCancel}
          />
        </div>
      )}

      {view.kind === "edit" && (
        <div className="flex-1 bg-pos-surface rounded-xl border border-pos-muted/10 p-4">
          <CustomerForm
            editCustomer={view.customer}
            onSaved={handleSaved}
            onCancel={handleCancel}
          />
        </div>
      )}

      {view.kind === "detail" && <CustomerDetail customer={view.customer} onBack={() => setView({ kind: "list" })} />}

      {collectCustomer && (
        <CollectPaymentModal
          customer={collectCustomer}
          onClose={() => setCollectCustomer(null)}
          onCollected={() => {}}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Customer Detail — credit history
// ──────────────────────────────────────────────

function CustomerDetail({ customer, onBack }: { customer: Customer; onBack: () => void }) {
  const creditPayments = useCustomersStore((s) => s.getCreditPaymentsByCustomer(customer.id));
  const liveCustomer = useCustomersStore((s) => s.customers.find((c) => c.id === customer.id));
  const displayCustomer = liveCustomer ?? customer;
  const [collectOpen, setCollectOpen] = useState(false);

  // Chronological (oldest first), compute running balance
  const sorted = [...creditPayments].sort((a, b) => a.date.localeCompare(b.date));
  let runningBalance = 0;
  const rows = sorted.map((p) => {
    runningBalance = Math.round((runningBalance + p.amount) * 100) / 100;
    return { ...p, balanceAfter: runningBalance };
  });

  function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-pos-muted hover:text-pos-text transition-colors mb-1 touch-target">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Volver a clientes
      </button>

      {/* Customer info card */}
      <div className="bg-pos-surface rounded-xl border border-pos-muted/10 p-4 dark:border-gray-600/30 dark:bg-gray-800">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-pos-text">{customer.name}</h2>
            <div className="text-xs text-pos-muted mt-1 space-y-0.5">
              {customer.phone && <p>📞 {customer.phone}</p>}
              {customer.email && <p>✉️ {customer.email}</p>}
              {customer.cuit && <p className="font-mono">CUIT: {customer.cuit}</p>}
              {customer.address && <p>📍 {customer.address}</p>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-pos-muted">Saldo</div>
            <div className={`text-2xl font-bold font-mono ${displayCustomer.creditBalance > 0 ? "text-pos-danger" : "text-pos-success"}`}>
              {formatCurrency(displayCustomer.creditBalance)}
            </div>
            {displayCustomer.creditBalance > 0 && (
              <button
                onClick={() => setCollectOpen(true)}
                className="mt-2 px-4 py-1.5 bg-pos-success text-white text-sm font-medium rounded-lg touch-target hover:opacity-90"
              >
                Cobrar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* History */}
      <div className="flex-1 bg-pos-surface rounded-xl border border-pos-muted/10 p-3 overflow-y-auto dark:border-gray-600/30 dark:bg-gray-800">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-pos-muted uppercase tracking-wider">Movimientos</h3>
          {rows.length > 0 && (
            <button
              onClick={() => printCreditStatement(creditPayments, displayCustomer.name, displayCustomer.creditBalance)}
              className="text-xs px-2.5 py-1.5 border border-pos-muted/20 text-pos-muted rounded-lg touch-target hover:border-pos-secondary hover:text-pos-text transition-all"
            >
              Imprimir Todo
            </button>
          )}
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-pos-muted italic text-center py-8">No hay movimientos registrados</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-pos-muted border-b border-pos-muted/20">
                <th className="text-left py-2 pr-2 font-medium">Fecha</th>
                <th className="text-left py-2 px-2 font-medium">Concepto</th>
                <th className="text-right py-2 px-2 font-medium">Monto</th>
                <th className="text-right py-2 px-2 font-medium">Saldo</th>
                <th className="text-right py-2 pl-2 font-medium w-10"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-b border-pos-muted/10 transition-colors hover:bg-pos-background/50">
                  <td className="py-2 pr-2 text-xs text-pos-muted font-mono whitespace-nowrap">{formatDate(p.date)}</td>
                  <td className="py-2 px-2 text-pos-text">
                    {p.notes || (p.amount > 0 ? "Venta a cuenta" : "Cobro")}
                  </td>
                  <td className={`py-2 px-2 text-right font-mono font-bold ${p.amount > 0 ? "text-pos-danger" : "text-pos-success"}`}>
                    {p.amount > 0 ? `+${formatCurrency(p.amount)}` : formatCurrency(p.amount)}
                  </td>
                  <td className={`py-2 px-2 text-right font-mono ${p.balanceAfter > 0 ? "text-pos-danger" : "text-pos-muted"}`}>
                    {formatCurrency(p.balanceAfter)}
                  </td>
                  <td className="py-2 pl-2 text-right">
                    <button
                      onClick={() => printCreditPayment(p, displayCustomer.name)}
                      title="Imprimir"
                      className="text-xs px-1.5 py-1 text-pos-muted hover:text-pos-secondary touch-target"
                    >
                      🖨️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {collectOpen && (
        <CollectPaymentModal
          customer={displayCustomer}
          onClose={() => setCollectOpen(false)}
          onCollected={() => {}}
        />
      )}
    </div>
  );
}
