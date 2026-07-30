import { useState, useEffect, useMemo, useRef } from "react";
import { useActiveStore } from "@/store/context";
import { useProveedoresStore } from "@/store/proveedores";
import { useProductsStore } from "@/store/products";
import { usePedidosStore, type Pedido } from "@/store/pedidos";
import { useKeyboardListNavigation } from "@/hooks/useKeyboardListNavigation";
import { formatCurrency } from "@/lib/format";

interface ItemRow {
  key: number;
  product_id: number | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

interface PedidoFormProps {
  onSaved: () => void;
  onCancel: () => void;
  editPedido?: Pedido;
}

let nextItemKey = 1;

export default function PedidoForm({ onSaved, onCancel, editPedido }: PedidoFormProps) {
  const { storeId } = useActiveStore();
  const proveedores = useProveedoresStore((s) => s.proveedores);
  const products = useProductsStore((s) => s.products);
  const addPedido = usePedidosStore((s) => s.addPedido);
  const updatePedido = usePedidosStore((s) => s.updatePedido);

  const [proveedorId, setProveedorId] = useState<number | null>(null);
  const [proveedorSearch, setProveedorSearch] = useState("");
  const [showProvDropdown, setShowProvDropdown] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ItemRow[]>([
    { key: nextItemKey++, product_id: null, product_name: "", quantity: 1, unit_price: 0, subtotal: 0 },
  ]);

  // Populate form when editing
  useEffect(() => {
    if (!editPedido) return;
    setProveedorId(editPedido.proveedor_id);
    setProveedorSearch(editPedido.proveedor_name);
    setDate(editPedido.date);
    setNotes(editPedido.notes);
    setItems(
      editPedido.items.map((item) => ({
        key: nextItemKey++,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
      })),
    );
  }, [editPedido]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const storeProveedores = useMemo(
    () => proveedores.filter((p) => p.store_id === storeId).sort((a, b) => a.name.localeCompare(b.name)),
    [proveedores, storeId],
  );

  const storeProducts = useMemo(
    () => products.filter((p) => p.store_id === storeId),
    [products, storeId],
  );

  const filteredProveedores = useMemo(
    () => storeProveedores.filter((p) => p.name.toLowerCase().includes(proveedorSearch.toLowerCase())),
    [storeProveedores, proveedorSearch],
  );

  const provInputRef = useRef<HTMLInputElement>(null);
  const { selectedIndex: provIndex, handleKeyDown: provKeyDown, setSelectedIndex: setProvIndex } = useKeyboardListNavigation({
    itemCount: filteredProveedores.length,
    onSelect: (i) => {
      const p = filteredProveedores[i];
      setProveedorId(p.id);
      setProveedorSearch(p.name);
      setShowProvDropdown(false);
    },
    enabled: showProvDropdown && !proveedorId && filteredProveedores.length > 0,
  });

  const total = useMemo(
    () => Math.round(items.reduce((s, i) => s + i.subtotal, 0) * 100) / 100,
    [items],
  );

  function addRow() {
    setItems([
      ...items,
      { key: nextItemKey++, product_id: null, product_name: "", quantity: 1, unit_price: 0, subtotal: 0 },
    ]);
  }

  function removeRow(key: number) {
    if (items.length <= 1) return;
    setItems(items.filter((r) => r.key !== key));
  }

  function updateRow(key: number, field: keyof ItemRow, value: string | number | null) {
    setItems(
      items.map((r) => {
        if (r.key !== key) return r;

        const updated = { ...r, [field]: value };

        if (field === "product_id" && typeof value === "number") {
          const prod = storeProducts.find((p) => p.id === value);
          if (prod) {
            updated.product_name = prod.name;
            updated.unit_price = prod.price;
          }
        }

        if (field === "quantity" || field === "unit_price") {
          updated.subtotal = Math.round(updated.quantity * updated.unit_price * 100) / 100;
        }

        return updated;
      }),
    );
  }

  function selectProduct(rowKey: number, productId: number) {
    setItems(
      items.map((r) => {
        if (r.key !== rowKey) return r;
        const prod = storeProducts.find((p) => p.id === productId);
        if (!prod) return r;
        return {
          ...r,
          product_id: productId,
          product_name: prod.name,
          unit_price: prod.price,
          subtotal: Math.round(r.quantity * prod.price * 100) / 100,
        };
      }),
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (proveedorId == null) {
      setError("Seleccioná un proveedor");
      return;
    }

    const validItems = items.filter((r) => r.product_name.trim() && r.quantity > 0);
    if (validItems.length === 0) {
      setError("Agregá al menos un producto con cantidad mayor a 0");
      return;
    }

    const proveedor = storeProveedores.find((p) => p.id === proveedorId);
    if (!proveedor) {
      setError("Proveedor no encontrado");
      return;
    }

    setSaving(true);
    try {
      if (editPedido) {
        updatePedido(editPedido.id, {
          date,
          notes,
          items: validItems.map((r) => ({
            product_id: r.product_id,
            product_name: r.product_name,
            quantity: r.quantity,
            unit_price: r.unit_price,
            subtotal: r.subtotal,
          })),
        });
      } else {
        addPedido({
          proveedor_id: proveedor.id,
          proveedor_name: proveedor.name,
          date,
          notes,
          store_id: storeId,
          items: validItems.map((r) => ({
            product_id: r.product_id,
            product_name: r.product_name,
            quantity: r.quantity,
            unit_price: r.unit_price,
            subtotal: r.subtotal,
          })),
        });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear el pedido");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-sm font-semibold text-pos-text uppercase tracking-wide">
        Nuevo Pedido
      </h3>

      {error && (
        <div className="bg-pos-danger/10 border border-pos-danger/30 text-pos-danger text-sm rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="relative">
          <label htmlFor="ped-proveedor" className="block text-sm font-medium text-pos-text mb-1">
            Proveedor <span className="text-pos-danger">*</span>
          </label>
          <input
            ref={provInputRef}
            id="ped-proveedor"
            type="text"
            value={proveedorId ? storeProveedores.find((p) => p.id === proveedorId)?.name ?? "" : proveedorSearch}
            onChange={(e) => {
              setProveedorId(null);
              setProveedorSearch(e.target.value);
              setShowProvDropdown(true);
            }}
            onFocus={() => setShowProvDropdown(true)}
            onBlur={() => setTimeout(() => setShowProvDropdown(false), 200)}
            onKeyDown={provKeyDown}
            placeholder="Buscá proveedor por nombre…"
            className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target"
          />
          {showProvDropdown && !proveedorId && filteredProveedores.length > 0 && (
            <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-pos-surface border border-pos-muted/20 rounded-lg shadow-xl max-h-48 overflow-y-auto">
              {filteredProveedores.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onMouseDown={() => {
                    setProveedorId(p.id);
                    setProveedorSearch(p.name);
                    setShowProvDropdown(false);
                  }}
                  onMouseEnter={() => setProvIndex(i)}
                  className={`w-full text-left px-3 py-2 text-sm touch-target transition-colors ${
                    i === provIndex
                      ? "bg-pos-secondary/10 text-pos-secondary font-medium"
                      : "text-pos-text hover:bg-pos-background/50"
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
          {proveedorId && (
            <button
              type="button"
              onClick={() => {
                setProveedorId(null);
                setProveedorSearch("");
              }}
              className="absolute right-2 top-8 text-xs text-pos-muted hover:text-pos-danger touch-target"
            >
              ✕
            </button>
          )}
        </div>

        <div>
          <label htmlFor="ped-date" className="block text-sm font-medium text-pos-text mb-1">
            Fecha
          </label>
          <input
            id="ped-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target"
          />
        </div>

        <div>
          <label htmlFor="ped-notes" className="block text-sm font-medium text-pos-text mb-1">
            Notas
          </label>
          <input
            id="ped-notes"
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas del pedido"
            className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target"
          />
        </div>
      </div>

      {/* Items table */}
      <div className="bg-pos-background/30 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-pos-text">Productos</label>
          <button
            type="button"
            onClick={addRow}
            className="text-xs px-3 py-1.5 bg-pos-secondary text-white rounded-lg touch-target hover:opacity-90"
          >
            + Agregar producto
          </button>
        </div>

        <div className="min-w-0">
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
                <ProductRow
                  key={row.key}
                  row={row}
                  allProducts={storeProducts}
                  onSelect={selectProduct}
                  onChange={updateRow}
                  onRemove={removeRow}
                  canRemove={items.length > 1}
                />
              ))}
            </tbody>
          </table>
        </div>

        <div className="text-right mt-2 font-semibold text-pos-text">
          Total: {formatCurrency(total)}
        </div>
      </div>

      {/* Hidden input to make form work with Enter */}
      <input type="submit" className="hidden" />

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-pos-muted/30 text-pos-text rounded-lg font-medium text-sm touch-target hover:bg-pos-background"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-pos-secondary text-white rounded-lg font-medium text-sm touch-target hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Guardando…" : editPedido ? "Actualizar Pedido" : "Crear Pedido"}
        </button>
      </div>
    </form>
  );
}

// ──────────────────────────────────────────────
// Product row with search input
// ──────────────────────────────────────────────

type ProductRowProps = {
  row: ItemRow;
  allProducts: { id: number; name: string; barcode: string | null; price: number }[];
  onSelect: (rowKey: number, productId: number) => void;
  onChange: (key: number, field: keyof ItemRow, value: string | number | null) => void;
  onRemove: (key: number) => void;
  canRemove: boolean;
};

function ProductRow({ row, allProducts, onSelect, onChange, onRemove, canRemove }: ProductRowProps) {
  const [search, setSearch] = useState(row.product_name);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const filtered = useMemo(
    () => allProducts.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())),
    [allProducts, search],
  );

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

  // Position dropdown relative to input so it's always visible
  useEffect(() => {
    if (!showDropdown || !inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    setDropdownStyle({
      position: "fixed",
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 420),
      zIndex: 9999,
    });
  }, [showDropdown, search]);

  return (
    <tr className="border-b border-pos-muted/10">
      <td className="py-1 pr-1 relative">
        <input
          ref={inputRef}
          type="text"
          value={row.product_id ? search : search}
          onChange={(e) => {
            setSearch(e.target.value);
            setShowDropdown(true);
            if (row.product_id) {
              onChange(row.key, "product_id", null);
              onChange(row.key, "product_name", "");
            }
          }}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          onKeyDown={handleKeyDown}
          placeholder="Buscá producto…"
          className="w-full border border-pos-muted/30 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-pos-secondary"
        />
        {showDropdown && !row.product_id && filtered.length > 0 && (
          <div
            ref={dropdownRef}
            style={dropdownStyle}
            className="bg-pos-surface border border-pos-muted/20 rounded-lg shadow-xl overflow-y-auto max-h-56"
          >
            <table className="w-full text-xs">
              <thead>
                <tr className="text-pos-muted border-b border-pos-muted/20">
                  <th className="text-left px-3 py-1.5 font-medium w-24">Código</th>
                  <th className="text-left px-2 py-1.5 font-medium">Producto</th>
                  <th className="text-right px-3 py-1.5 font-medium w-20">Precio</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr
                    key={p.id}
                    onMouseDown={() => handleSelect(p.id)}
                    onMouseEnter={() => setSelectedIndex(i)}
                    className={`cursor-pointer transition-colors ${
                      i === selectedIndex
                        ? "bg-pos-secondary/10 text-pos-secondary"
                        : "hover:bg-pos-background/50 text-pos-text"
                    }`}
                  >
                    <td className="px-3 py-1.5 font-mono text-pos-muted">{p.barcode ?? "—"}</td>
                    <td className="px-2 py-1.5 font-medium">{p.name}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{formatCurrency(p.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </td>
      <td className="py-1 px-1">
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.5"
          value={row.quantity}
          onChange={(e) => onChange(row.key, "quantity", Math.max(0, Number(e.target.value)))}
          className="w-full border border-pos-muted/30 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-pos-secondary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      </td>
      <td className="py-1 px-1">
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={row.unit_price}
          onChange={(e) => onChange(row.key, "unit_price", Math.max(0, Number(e.target.value)))}
          className="w-full border border-pos-muted/30 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-pos-secondary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      </td>
      <td className="py-1 px-1 text-right font-mono text-xs text-pos-text">
        {formatCurrency(row.subtotal)}
      </td>
      <td className="py-1 pl-1">
        <button
          type="button"
          onClick={() => onRemove(row.key)}
          disabled={!canRemove}
          className="text-xs px-1.5 py-1 text-pos-danger hover:bg-pos-danger/10 rounded touch-target disabled:opacity-30"
        >
          ✕
        </button>
      </td>
    </tr>
  );
}
