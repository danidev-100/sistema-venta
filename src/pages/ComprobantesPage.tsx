import { useState, useMemo, useCallback, useRef } from "react";
import { useActiveStore } from "@/store/context";
import { useCustomersStore } from "@/store/customers";
import { useProductsStore } from "@/store/products";
import { useComprobantesStore, type Comprobante, type ComprobanteTipo, getTipoLabel } from "@/store/comprobantes";
import { exportTableToPdf, exportToExcel, type ExportColumn } from "@/lib/export-utils";
import { formatCurrency } from "@/lib/format";
import { printComprobante } from "@/lib/pdf-export";
import { useAuthStore } from "@/store/auth";
import { useAppStore } from "@/store";
import { useKeyboardListNavigation } from "@/hooks/useKeyboardListNavigation";

const TIPOS: ComprobanteTipo[] = ["factura", "boleta", "nota_credito", "nota_debito", "ticket"];

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

type View =
  | { kind: "list" }
  | { kind: "create" }
  | { kind: "detail"; comprobante: Comprobante };

type ItemRow = {
  key: number;
  product_id: number | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
};

const TIPO_OPTIONS: { id: ComprobanteTipo; label: string; desc: string }[] = [
  { id: "factura", label: "Factura", desc: "Con IVA y CUIT del cliente" },
  { id: "boleta", label: "Boleta", desc: "Comprobante simple" },
  { id: "nota_credito", label: "Nota de Crédito", desc: "Anula parcial/total una factura" },
  { id: "nota_debito", label: "Nota de Débito", desc: "Incrementa el monto de una factura" },
  { id: "ticket", label: "Ticket", desc: "Comprobante térmico" },
];

const TIPO_COLORS: Record<ComprobanteTipo, string> = {
  factura: "text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30",
  boleta: "text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30",
  nota_credito: "text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/30",
  nota_debito: "text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30",
  ticket: "text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/30",
};

let nextItemKey = 1;

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export default function ComprobantesPage() {
  const { storeId } = useActiveStore();
  const comprobantes = useComprobantesStore((s) => s.comprobantes);
  const [view, setView] = useState<View>({ kind: "list" });
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState<ComprobanteTipo[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterCreatedBy, setFilterCreatedBy] = useState("");

  const storeComprobantes = useMemo(
    () => comprobantes.filter((c) => c.store_id === storeId).sort((a, b) => b.id - a.id),
    [comprobantes, storeId],
  );

  const createdByUsers = useMemo(() => {
    const set = new Set(storeComprobantes.map((c) => c.createdBy));
    return [...set].filter(Boolean).sort();
  }, [storeComprobantes]);

  const filtered = useMemo(() => {
    let result = storeComprobantes;

    // Filter by tipo
    if (filterTipo.length > 0) {
      result = result.filter((c) => filterTipo.includes(c.tipo));
    }

    // Filter by date range
    if (dateFrom) {
      const from = new Date(dateFrom);
      result = result.filter((c) => new Date(c.fecha) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter((c) => new Date(c.fecha) <= to);
    }

    // Filter by createdBy (cajero)
    if (filterCreatedBy) {
      result = result.filter((c) => c.createdBy === filterCreatedBy);
    }

    // Filter by search (número + cliente)
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.numero.toLowerCase().includes(q) ||
          c.cliente_nombre.toLowerCase().includes(q),
      );
    }

    return result;
  }, [storeComprobantes, search, filterTipo, dateFrom, dateTo, filterCreatedBy]);

  function toggleTipo(tipo: ComprobanteTipo) {
    setFilterTipo((prev) =>
      prev.includes(tipo) ? prev.filter((t) => t !== tipo) : [...prev, tipo],
    );
  }

  const columns: ExportColumn[] = [
    { header: "N°", key: "numero" },
    { header: "Tipo", key: "tipo" },
    { header: "Cliente", key: "cliente" },
    { header: "Fecha", key: "fecha" },
    { header: "Total", key: "total" },
  ];

  const exportPdf = useCallback(() => {
    const data = filtered.map((c) => ({
      numero: c.numero,
      tipo: getTipoLabel(c.tipo),
      cliente: c.cliente_nombre,
      fecha: new Date(c.fecha).toLocaleDateString("es-AR"),
      total: formatCurrency(c.total),
    }));
    exportTableToPdf(data, columns, "Comprobantes");
  }, [filtered]);

  const exportExcel = useCallback(() => {
    const data = filtered.map((c) => ({
      numero: c.numero,
      tipo: getTipoLabel(c.tipo),
      cliente: c.cliente_nombre,
      fecha: c.fecha,
      total: c.total,
    }));
    exportToExcel(data, columns, "Comprobantes");
  }, [filtered]);

  function handleCancel() { setView({ kind: "list" }); }
  function handleSaved() { setView({ kind: "list" }); }

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-bold text-pos-text">Comprobantes</h1>
        {view.kind === "list" && (
          <div className="flex items-center gap-2">
            {filtered.length > 0 && (
              <>
                <button onClick={exportExcel} className="text-xs px-3 py-1.5 border border-pos-muted/30 text-pos-text rounded-lg touch-target hover:bg-pos-background/50 whitespace-nowrap">Excel</button>
                <button onClick={exportPdf} className="text-xs px-3 py-1.5 border border-pos-muted/30 text-pos-text rounded-lg touch-target hover:bg-pos-background/50 whitespace-nowrap">PDF</button>
              </>
            )}
            <button onClick={() => setView({ kind: "create" })} className="text-xs px-3 py-1.5 bg-pos-secondary text-white rounded-lg touch-target hover:opacity-90 whitespace-nowrap">+ Nuevo Comprobante</button>
          </div>
        )}
      </div>

      {view.kind === "list" && (
        <>
          {/* Filters */}
          <div className="flex flex-col gap-2">
            {/* Search */}
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por número o cliente…" className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target" />

            {/* Cashier filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-pos-muted font-medium">Cajero:</span>
              <select value={filterCreatedBy} onChange={(e) => setFilterCreatedBy(e.target.value)}
                className="text-xs border border-pos-muted/30 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-pos-secondary bg-pos-background touch-target">
                <option value="">Todos</option>
                {createdByUsers.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
              {filterCreatedBy && (
                <button onClick={() => setFilterCreatedBy("")} className="text-xs text-pos-muted hover:text-pos-danger touch-target">✕</button>
              )}
            </div>

            {/* Tipo filter */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-pos-muted font-medium mr-1">Tipo:</span>
              {TIPOS.map((t) => {
                const active = filterTipo.includes(t);
                return (
                  <button
                    key={t}
                    onClick={() => toggleTipo(t)}
                    className={`text-xs px-2.5 py-1 rounded-full border touch-target transition-all ${
                      active
                        ? "bg-pos-secondary text-white border-pos-secondary"
                        : "border-pos-muted/20 text-pos-muted hover:border-pos-secondary/40 hover:text-pos-text"
                    }`}
                  >
                    {getTipoLabel(t)}
                  </button>
                );
              })}
              {filterTipo.length > 0 && (
                <button onClick={() => setFilterTipo([])} className="text-xs text-pos-muted hover:text-pos-danger ml-1 touch-target">✕</button>
              )}
            </div>

            {/* Date range */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-pos-muted font-medium">Fecha:</span>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="text-xs border border-pos-muted/30 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-pos-secondary bg-pos-background" />
              <span className="text-xs text-pos-muted">→</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="text-xs border border-pos-muted/30 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-pos-secondary bg-pos-background" />
              {(dateFrom || dateTo) && (
                <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="text-xs text-pos-muted hover:text-pos-danger touch-target">✕</button>
              )}
              {filterTipo.length > 0 && (
                <span className="text-xs text-pos-muted/50 ml-auto">{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</span>
              )}
            </div>
          </div>
          <div className="flex-1 bg-pos-surface rounded-xl border border-pos-muted/10 p-3 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="flex items-center justify-center h-48">
                <p className="text-sm text-pos-muted italic text-center">
                  {search || filterTipo.length > 0 || dateFrom || dateTo
                    ? "No se encontraron comprobantes con esos filtros"
                    : "Todavía no hay comprobantes. Creá uno desde '+ Nuevo Comprobante'."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-pos-muted border-b border-pos-muted/20">
                      <th className="text-left py-2 pr-2 font-medium">N°</th>
                      <th className="text-left py-2 px-2 font-medium">Tipo</th>
                      <th className="text-left py-2 px-2 font-medium">Cliente</th>
                      <th className="text-left py-2 px-2 font-medium">Cajero</th>
                      <th className="text-left py-2 px-2 font-medium">Fecha</th>
                      <th className="text-right py-2 px-2 font-medium">Total</th>
                      <th className="text-right py-2 pl-2 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c) => (
                      <tr key={c.id} className="border-b border-pos-muted/10 transition-colors hover:bg-pos-background/50 cursor-pointer" onClick={() => setView({ kind: "detail", comprobante: c })}>
                        <td className="py-2 pr-2 font-mono text-xs text-pos-muted">{c.numero}</td>
                        <td className="py-2 px-2">
                          <span className={`inline-block text-xs font-medium px-1.5 py-0.5 rounded-full ${TIPO_COLORS[c.tipo]}`}>
                            {getTipoLabel(c.tipo)}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-pos-text">{c.cliente_nombre}</td>
                        <td className="py-2 px-2 text-pos-muted text-xs">{c.createdBy}</td>
                        <td className="py-2 px-2 text-pos-muted">{new Date(c.fecha).toLocaleDateString("es-AR")}</td>
                        <td className="py-2 px-2 text-right font-mono text-pos-text">{formatCurrency(c.total)}</td>
                        <td className="py-2 pl-2 text-right">
                          <button onClick={(e) => { e.stopPropagation(); setView({ kind: "detail", comprobante: c }); }} className="text-xs px-2 py-1 text-pos-secondary hover:bg-pos-secondary/10 rounded touch-target">Ver</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {view.kind === "create" && (
        <div className="flex-1 bg-pos-surface rounded-xl border border-pos-muted/10 p-4 overflow-y-auto">
          <ComprobanteForm onSaved={handleSaved} onCancel={handleCancel} />
        </div>
      )}

      {view.kind === "detail" && (
        <div className="flex-1 bg-pos-surface rounded-xl border border-pos-muted/10 p-4 overflow-y-auto">
          <ComprobanteDetail comprobante={view.comprobante} onBack={() => setView({ kind: "list" })} />
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// ComprobanteForm
// ──────────────────────────────────────────────

function ComprobanteForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const { storeId } = useActiveStore();
  const customers = useCustomersStore((s) => s.customers);
  const products = useProductsStore((s) => s.products);
  const createComprobante = useComprobantesStore((s) => s.createComprobante);
  const currentUserName = useAuthStore((s) => s.currentUser?.name);
  const showNotification = useAppStore((s) => s.showNotification);

  const storeCustomers = useMemo(() => customers.filter((c) => c.store_id === storeId), [customers, storeId]);
  const storeProducts = useMemo(() => products.filter((p) => p.store_id === storeId), [products, storeId]);

  const [tipo, setTipo] = useState<ComprobanteTipo | null>(null);
  const [clienteSearch, setClienteSearch] = useState("");
  const [clienteId, setClienteId] = useState<number | null>(null);
  const [clienteNombre, setClienteNombre] = useState("");
  const [clienteCuit, setClienteCuit] = useState("");
  const [clienteDireccion, setClienteDireccion] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [ivaPercent, setIvaPercent] = useState(21);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ItemRow[]>([
    { key: nextItemKey++, product_id: null, product_name: "", quantity: 1, unit_price: 0, subtotal: 0 },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Hooks must be BEFORE the early return (React rule)
  const filteredCustomers = useMemo(
    () => storeCustomers.filter((c) => c.name.toLowerCase().includes(clienteSearch.toLowerCase())),
    [storeCustomers, clienteSearch],
  );

  const clientInputRef = useRef<HTMLInputElement>(null);
  const { selectedIndex: clientIndex, handleKeyDown: clientKeyDown, setSelectedIndex: setClientIndex } = useKeyboardListNavigation({
    itemCount: filteredCustomers.length,
    onSelect: (i) => selectCustomer(filteredCustomers[i]),
    enabled: showClientDropdown && !clienteId && filteredCustomers.length > 0,
  });

  const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
  const calculatedIva = tipo === "factura" ? Math.round(subtotal * ivaPercent / 100 * 100) / 100 : 0;
  const calculatedTotal = Math.round((subtotal + calculatedIva) * 100) / 100;

  function selectCustomer(cust: typeof storeCustomers[0]) {
    setClienteId(cust.id);
    setClienteNombre(cust.name);
    setClienteCuit(cust.cuit);
    setClienteDireccion(cust.address);
    setClienteSearch(cust.name);
    setShowClientDropdown(false);
  }

  function addRow() {
    setItems([...items, { key: nextItemKey++, product_id: null, product_name: "", quantity: 1, unit_price: 0, subtotal: 0 }]);
  }

  function updateItem(key: number, field: keyof ItemRow, value: string | number | null) {
    setItems(items.map((r) => {
      if (r.key !== key) return r;
      const updated = { ...r, [field]: value };
      if (field === "product_id" && typeof value === "number") {
        const prod = storeProducts.find((p) => p.id === value);
        if (prod) { updated.product_name = prod.name; updated.unit_price = prod.price; }
      }
      if (field === "quantity" || field === "unit_price") {
        updated.subtotal = Math.round(updated.quantity * updated.unit_price * 100) / 100;
      }
      return updated;
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!tipo) { setError("Seleccioná un tipo de comprobante"); return; }
    if (!clienteNombre.trim()) { setError("Seleccioná un cliente"); return; }
    if (tipo === "factura" && !clienteCuit.trim()) { setError("Para factura necesitás el CUIT del cliente"); return; }

    const validItems = items.filter((r) => r.product_name.trim() && r.quantity > 0);
    if (validItems.length === 0) { setError("Agregá al menos un producto"); return; }

    setSaving(true);
    try {
      createComprobante({
        tipo,
        cliente_nombre: clienteNombre.trim() || "Consumidor Final",
        cliente_cuit: clienteCuit.trim(),
        cliente_direccion: clienteDireccion.trim(),
        notes,
        created_by: currentUserName,
        store_id: storeId,
        items: validItems.map((r) => ({
          product_id: r.product_id ?? undefined,
          product_name: r.product_name,
          quantity: r.quantity,
          unit_price: r.unit_price,
          subtotal: r.subtotal,
        })),
        ivaPercent: tipo === "factura" ? ivaPercent : 0,
      });
      showNotification("Comprobante creado");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear el comprobante");
    } finally {
      setSaving(false);
    }
  }

  // ── Render ──

  if (!tipo) {
    return (
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-pos-text uppercase tracking-wide">Nuevo Comprobante</h3>
        <p className="text-sm text-pos-muted">Seleccioná el tipo de comprobante:</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TIPO_OPTIONS.map((opt) => (
            <button key={opt.id} onClick={() => setTipo(opt.id)}
              className="flex flex-col items-start p-4 border-2 border-pos-muted/20 rounded-xl touch-target hover:border-pos-secondary hover:bg-pos-secondary/5 transition-all text-left"
            >
              <span className="text-sm font-bold text-pos-text">{opt.label}</span>
              <span className="text-xs text-pos-muted mt-0.5">{opt.desc}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-pos-text uppercase tracking-wide">
          Nuevo {getTipoLabel(tipo)}
        </h3>
        <button type="button" onClick={() => setTipo(null)} className="text-xs text-pos-muted hover:text-pos-text">Cambiar tipo</button>
      </div>

      {error && <div className="bg-pos-danger/10 border border-pos-danger/30 text-pos-danger text-sm rounded-lg px-3 py-2">{error}</div>}

      {/* Cliente search — todos los comprobantes */}
      <div className="relative">
        <label className="block text-sm font-medium text-pos-text mb-1">
          Cliente {tipo === "factura" && <span className="text-pos-danger">*</span>}
        </label>
        <input ref={clientInputRef} type="text" value={clienteSearch} onChange={(e) => { setClienteSearch(e.target.value); setClienteId(null); setShowClientDropdown(true); }}
          onFocus={() => setShowClientDropdown(true)} onBlur={() => setTimeout(() => setShowClientDropdown(false), 200)}
          onKeyDown={clientKeyDown}
          placeholder="Buscá cliente por nombre…" className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target" />
        {showClientDropdown && !clienteId && filteredCustomers.length > 0 && (
          <div className="absolute z-10 top-full left-0 right-0 bg-pos-surface border border-pos-muted/20 rounded-lg shadow-xl max-h-40 overflow-y-auto">
            {filteredCustomers.map((c, i) => (
              <button key={c.id} type="button" onMouseDown={() => selectCustomer(c)} onMouseEnter={() => setClientIndex(i)}
                className={`w-full text-left px-3 py-2 text-sm touch-target transition-colors ${
                  i === clientIndex
                    ? "bg-pos-secondary/10 text-pos-secondary font-medium"
                    : "text-pos-text hover:bg-pos-background/50"
                }`}>
                {c.name} {c.cuit ? <span className="text-pos-muted">({c.cuit})</span> : ""}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Cliente datos (todos los comprobantes) */}
      {clienteId && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-pos-text mb-1">Nombre</label>
            <input type="text" value={clienteNombre} readOnly className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm bg-pos-background/50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-pos-text mb-1">CUIT {tipo === "factura" && <span className="text-pos-danger">*</span>}</label>
            <input type="text" value={clienteCuit} onChange={(e) => setClienteCuit(e.target.value)} placeholder="XX-XXXXXXXX-X" className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target" />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-pos-text mb-1">Dirección</label>
            <input type="text" value={clienteDireccion} readOnly className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm bg-pos-background/50" />
          </div>
        </div>
      )}

      {/* Manual client name when no search result selected */}
      {!clienteId && !clienteSearch.trim() && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-pos-text mb-1">Cliente</label>
            <input type="text" value={clienteNombre} onChange={(e) => { setClienteNombre(e.target.value); setClienteId(null); }} placeholder="Consumidor Final" className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target" />
          </div>
          <div>
            <label className="block text-sm font-medium text-pos-text mb-1">CUIT</label>
            <input type="text" value={clienteCuit} onChange={(e) => setClienteCuit(e.target.value)} placeholder="Opcional" className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target" />
          </div>
        </div>
      )}

      {/* IVA % for factura */}
      {tipo === "factura" && (
        <div>
          <label className="block text-sm font-medium text-pos-text mb-1">IVA %</label>
          <select value={ivaPercent} onChange={(e) => setIvaPercent(Number(e.target.value))} className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target">
            <option value={21}>21%</option>
            <option value={10.5}>10.5%</option>
            <option value={27}>27%</option>
            <option value={0}>0%</option>
          </select>
        </div>
      )}

      {/* Items */}
      <div className="bg-pos-background/30 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-pos-text">Productos</label>
          <button type="button" onClick={addRow} className="text-xs px-3 py-1.5 bg-pos-secondary text-white rounded-lg touch-target hover:opacity-90">+ Agregar</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-pos-muted border-b border-pos-muted/20">
                <th className="text-left py-1 pr-1 font-medium w-1/3">Producto</th>
                <th className="text-left py-1 px-1 font-medium w-16">Cant</th>
                <th className="text-left py-1 px-1 font-medium w-20">P. Unit</th>
                <th className="text-left py-1 px-1 font-medium w-20">Subtotal</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <ProductSearchRow
                  key={row.key}
                  row={row}
                  allProducts={storeProducts}
                  onSelect={(key, prodId) => updateItem(key, "product_id", prodId)}
                  onChange={updateItem}
                  onRemove={() => setItems(items.filter((r) => r.key !== row.key))}
                  canRemove={items.length > 1}
                />
              ))}
            </tbody>
          </table>
        </div>

        <div className="text-right mt-2 space-y-1">
          <div className="text-sm text-pos-muted">Subtotal: <span className="font-mono">{formatCurrency(subtotal)}</span></div>
          {tipo === "factura" && <div className="text-sm text-pos-muted">IVA ({ivaPercent}%): <span className="font-mono">{formatCurrency(calculatedIva)}</span></div>}
          <div className="text-base font-bold text-pos-text">Total: <span className="font-mono">{formatCurrency(calculatedTotal)}</span></div>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-pos-text mb-1">Notas</label>
        <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target" />
      </div>

      <div className="flex items-center gap-2">
        <button type="submit" disabled={saving} className="px-4 py-2 bg-pos-secondary text-white rounded-lg font-medium text-sm touch-target hover:opacity-90 disabled:opacity-50">
          {saving ? "Guardando…" : `Crear ${getTipoLabel(tipo)}`}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 border border-pos-muted/30 text-pos-text rounded-lg font-medium text-sm touch-target hover:bg-pos-background">Cancelar</button>
      </div>
    </form>
  );
}

// ──────────────────────────────────────────────
// ProductSearchRow (reusable)
// ──────────────────────────────────────────────

function ProductSearchRow({
  row, allProducts, onSelect, onChange, onRemove, canRemove,
}: {
  row: ItemRow;
  allProducts: { id: number; name: string; price: number }[];
  onSelect: (key: number, productId: number) => void;
  onChange: (key: number, field: keyof ItemRow, value: string | number | null) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const [search, setSearch] = useState(row.product_name);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const filtered = useMemo(() => allProducts.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())), [allProducts, search]);

  const { selectedIndex, handleKeyDown, setSelectedIndex } = useKeyboardListNavigation({
    itemCount: filtered.length,
    onSelect: (i) => handleSelect(filtered[i].id),
    enabled: showDropdown && !row.product_id && filtered.length > 0,
  });

  function handleSelect(productId: number) {
    onSelect(row.key, productId);
    const prod = allProducts.find((p) => p.id === productId);
    if (prod) setSearch(prod.name);
    setShowDropdown(false);
  }

  return (
    <tr className="border-b border-pos-muted/10">
      <td className="py-1 pr-1 relative">
        <input ref={inputRef} type="text" value={row.product_id ? search : search} onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); if (row.product_id) onChange(row.key, "product_id", null); }}
          onFocus={() => setShowDropdown(true)} onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          onKeyDown={handleKeyDown}
          placeholder="Buscá producto…"
          className="w-full border border-pos-muted/30 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-pos-secondary" />
        {showDropdown && !row.product_id && filtered.length > 0 && (
          <div className="absolute z-10 top-full left-0 right-0 bg-pos-surface border border-pos-muted/20 rounded-lg shadow-xl max-h-40 overflow-y-auto">
            {filtered.map((p, i) => (
              <button key={p.id} type="button" onMouseDown={() => handleSelect(p.id)} onMouseEnter={() => setSelectedIndex(i)}
                className={`w-full text-left px-3 py-1.5 text-sm touch-target transition-colors ${
                  i === selectedIndex
                    ? "bg-pos-secondary/10 text-pos-secondary font-medium"
                    : "text-pos-text hover:bg-pos-background/50"
                }`}>{p.name}</button>
            ))}
          </div>
        )}
      </td>
      <td className="py-1 px-1">
        <input type="number" inputMode="decimal" min="0" step="0.5" value={row.quantity}
          onChange={(e) => onChange(row.key, "quantity", Math.max(0, Number(e.target.value)))}
          className="w-full border border-pos-muted/30 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-pos-secondary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
      </td>
      <td className="py-1 px-1">
        <input type="number" inputMode="decimal" min="0" step="0.01" value={row.unit_price}
          onChange={(e) => onChange(row.key, "unit_price", Math.max(0, Number(e.target.value)))}
          className="w-full border border-pos-muted/30 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-pos-secondary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
      </td>
      <td className="py-1 px-1 text-right font-mono text-xs text-pos-text">{formatCurrency(row.subtotal)}</td>
      <td className="py-1 pl-1">
        <button type="button" onClick={onRemove} disabled={!canRemove}
          className="text-xs px-1.5 py-1 text-pos-danger hover:bg-pos-danger/10 rounded touch-target disabled:opacity-30">✕</button>
      </td>
    </tr>
  );
}

// ──────────────────────────────────────────────
// ComprobanteDetail
// ──────────────────────────────────────────────

function ComprobanteDetail({ comprobante, onBack }: { comprobante: Comprobante; onBack: () => void }) {
  const printableRef = useRef<HTMLDivElement>(null);

  const TIPO_BG: Record<ComprobanteTipo, string> = {
    factura: "bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800",
    boleta: "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800",
    nota_credito: "bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800",
    nota_debito: "bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800",
    ticket: "bg-gray-50 dark:bg-gray-900/10 border-gray-200 dark:border-gray-800",
  };

  async function handlePrint() {
    await printComprobante(comprobante);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-pos-text uppercase tracking-wide">Comprobante</h3>
        <div className="flex items-center gap-2">
          <button onClick={handlePrint} className="text-xs px-3 py-1.5 bg-pos-secondary text-white rounded-lg touch-target hover:opacity-90">🖨️ Imprimir</button>
          <button onClick={onBack} className="text-xs px-3 py-1.5 border border-pos-muted/30 text-pos-text rounded-lg touch-target hover:bg-pos-background">← Volver</button>
        </div>
      </div>

      <div ref={printableRef} className={`rounded-xl border-2 p-4 space-y-3 ${TIPO_BG[comprobante.tipo]}`}>
        <div className="text-center">
          <div className="text-lg font-bold text-pos-text uppercase tracking-wider">
            {comprobante.tipo === "factura" ? "FACTURA" : comprobante.tipo === "boleta" ? "BOLETA" : comprobante.tipo === "nota_credito" ? "NOTA DE CRÉDITO" : comprobante.tipo === "nota_debito" ? "NOTA DE DÉBITO" : "TICKET"}
          </div>
          <div className="text-sm font-mono text-pos-muted mt-0.5">{comprobante.numero}</div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div><span className="text-pos-muted">Fecha:</span> {new Date(comprobante.fecha).toLocaleDateString("es-AR")}</div>
          <div><span className="text-pos-muted">Cajero:</span> {comprobante.createdBy}</div>
          <div><span className="text-pos-muted">Cliente:</span> {comprobante.cliente_nombre}</div>
          {comprobante.cliente_cuit && <div><span className="text-pos-muted">CUIT:</span> {comprobante.cliente_cuit}</div>}
          {comprobante.cliente_direccion && <div className="col-span-2"><span className="text-pos-muted">Dirección:</span> {comprobante.cliente_direccion}</div>}
        </div>

        <table className="w-full text-sm">
          <thead><tr className="text-pos-muted border-b border-pos-muted/20">
            <th className="text-left py-1 pr-2 font-medium">Producto</th>
            <th className="text-right py-1 px-2 font-medium">Cant</th>
            <th className="text-right py-1 px-2 font-medium">P.Unit</th>
            <th className="text-right py-1 pl-2 font-medium">Subtotal</th>
          </tr></thead>
          <tbody>
            {comprobante.items.map((item) => (
              <tr key={item.id} className="border-b border-pos-muted/10">
                <td className="py-1 pr-2 text-pos-text">{item.product_name}</td>
                <td className="py-1 px-2 text-right font-mono">{item.quantity}</td>
                <td className="py-1 px-2 text-right font-mono">{formatCurrency(item.unit_price)}</td>
                <td className="py-1 pl-2 text-right font-mono">{formatCurrency(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="text-right space-y-0.5 pt-2 border-t border-pos-muted/20">
          <div className="text-sm text-pos-muted">Subtotal: <span className="font-mono">{formatCurrency(comprobante.subtotal)}</span></div>
          {comprobante.iva > 0 && <div className="text-sm text-pos-muted">IVA: <span className="font-mono">{formatCurrency(comprobante.iva)}</span></div>}
          <div className="text-base font-bold text-pos-text">Total: <span className="font-mono">{formatCurrency(comprobante.total)}</span></div>
        </div>

        {comprobante.notes && <p className="text-xs text-pos-muted">Notas: {comprobante.notes}</p>}
      </div>
    </div>
  );
}
