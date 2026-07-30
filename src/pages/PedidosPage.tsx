import { useState, useMemo, useCallback } from "react";
import { useActiveStore } from "@/store/context";
import { usePedidosStore, type Pedido, type PedidoStatus, getStatusLabel } from "@/store/pedidos";
import { useProductsStore } from "@/store/products";
import { exportTableToPdf, exportToExcel, type ExportColumn } from "@/lib/export-utils";
import { formatCurrency } from "@/lib/format";
import PedidoForm from "@/components/PedidoForm";

type View =
  | { kind: "list" }
  | { kind: "create" }
  | { kind: "edit"; pedido: Pedido }
  | { kind: "detail"; pedido: Pedido };

const STATUS_COLORS: Record<string, string> = {
  pending: "text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30",
  received: "text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30",
  cancelled: "text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30",
  partial: "text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30",
};

export default function PedidosPage() {
  const { storeId } = useActiveStore();
  const pedidos = usePedidosStore((s) => s.pedidos);
  const updateStatus = usePedidosStore((s) => s.updateStatus);
  const deletePedido = usePedidosStore((s) => s.deletePedido);
  const adjustStock = useProductsStore((s) => s.adjustStock);
  const products = useProductsStore((s) => s.products);

  const [view, setView] = useState<View>({ kind: "list" });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PedidoStatus | "all">("all");

  const storePedidos = useMemo(
    () =>
      pedidos
        .filter((p) => p.store_id === storeId)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [pedidos, storeId],
  );

  const filteredPedidos = useMemo(() => {
    let result = storePedidos;

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.proveedor_name.toLowerCase().includes(q) ||
          p.id.toString().includes(q) ||
          getStatusLabel(p.status).toLowerCase().includes(q),
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((p) => p.status === statusFilter);
    }

    return result;
  }, [storePedidos, search, statusFilter]);

  const columns: ExportColumn[] = [
    { header: "N°", key: "numero" },
    { header: "Proveedor", key: "proveedor" },
    { header: "Fecha", key: "fecha" },
    { header: "Estado", key: "estado" },
    { header: "Total", key: "total" },
  ];

  const exportPdf = useCallback(() => {
    const data = filteredPedidos.map((p) => ({
      numero: `#${p.id}`,
      proveedor: p.proveedor_name,
      fecha: new Date(p.date).toLocaleDateString("es-AR"),
      estado: getStatusLabel(p.status),
      total: formatCurrency(p.total),
    }));
    exportTableToPdf(data, columns, "Pedidos");
  }, [filteredPedidos]);

  const exportExcel = useCallback(() => {
    const data = filteredPedidos.map((p) => ({
      numero: p.id,
      proveedor: p.proveedor_name,
      fecha: p.date,
      estado: getStatusLabel(p.status),
      total: p.total,
    }));
    exportToExcel(data, columns, "Pedidos");
  }, [filteredPedidos]);

  function handleCancel() { setView({ kind: "list" }); }
  function handleSaved() { setView({ kind: "list" }); }

  function handleUpdateStatus(pedido: Pedido, status: PedidoStatus) {
    if (pedido.status === "received" && status !== "received") {
      if (!window.confirm(`Este pedido ya fue recibido. ¿Cambiar el estado a "${getStatusLabel(status)}"?`)) return;
    }
    updateStatus(pedido.id, status);

    // Auto-update stock when receiving a pedido (only for remaining quantities)
    if (status === "received" && pedido.status !== "received") {
      for (const item of pedido.items) {
        if (item.product_id == null) continue;
        const prod = products.find((p) => p.id === item.product_id);
        if (prod) {
          const remaining = item.quantity - (item.received_qty ?? 0);
          if (remaining > 0) {
            adjustStock(item.product_id, prod.stock + remaining);
          }
        }
      }
    }
    // Revert stock if un-receiving
    if (pedido.status === "received" && status !== "received") {
      for (const item of pedido.items) {
        if (item.product_id == null) continue;
        const prod = products.find((p) => p.id === item.product_id);
        if (prod) {
          const newStock = Math.max(0, prod.stock - (item.quantity - (item.received_qty ?? 0)));
          adjustStock(item.product_id, newStock);
        }
      }
    }
  }

  function handleDelete(pedido: Pedido) {
    if (!window.confirm(`¿Eliminar pedido #${pedido.id} de ${pedido.proveedor_name}?`)) return;
    deletePedido(pedido.id);
  }

  function handleViewDetail(pedido: Pedido) {
    setView({ kind: "detail", pedido });
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-bold text-pos-text">Pedidos</h1>
        {view.kind === "list" && (
          <div className="flex items-center gap-2">
            {filteredPedidos.length > 0 && (
              <>
                <button
                  onClick={exportExcel}
                  className="text-xs px-3 py-1.5 border border-pos-muted/30 text-pos-text rounded-lg touch-target hover:bg-pos-background/50 whitespace-nowrap"
                >
                  Excel
                </button>
                <button
                  onClick={exportPdf}
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
              + Nuevo Pedido
            </button>
          </div>
        )}
      </div>

      {view.kind === "list" && (
        <>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por proveedor, N° de pedido o estado…"
            className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target"
          />

          {/* Status filter chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {(["all", "pending", "partial", "received", "cancelled"] as const).map((s) => {
              const FILTER_LABELS: Record<string, string> = {
                all: "Todas",
                pending: "Pendientes",
                partial: "Parciales",
                received: "Recibidas",
                cancelled: "Canceladas",
              };
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors touch-target ${
                    statusFilter === s
                      ? "bg-pos-secondary text-white"
                      : "bg-pos-background text-pos-muted hover:text-pos-secondary"
                  }`}
                >
                  {FILTER_LABELS[s]}
                </button>
              );
            })}
          </div>

          <div className="flex-1 bg-pos-surface rounded-xl border border-pos-muted/10 p-3 overflow-y-auto">
            {filteredPedidos.length === 0 ? (
              <div className="flex items-center justify-center h-48">
                <p className="text-sm text-pos-muted italic text-center">
                  {search
                    ? "No se encontraron pedidos"
                    : "Todavía no hay pedidos. Hacé clic en '+ Nuevo Pedido' para crear uno."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-pos-muted border-b border-pos-muted/20">
                      <th className="text-left py-2 pr-1 font-medium w-14">N°</th>
                      <th className="text-left py-2 px-1 font-medium">Proveedor</th>
                      <th className="text-left py-2 px-1 font-medium">Fecha</th>
                      <th className="text-left py-2 px-1 font-medium">Estado</th>
                      <th className="text-right py-2 px-1 font-medium">Total</th>
                      <th className="text-right py-2 pl-1 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPedidos.map((p) => (
                      <tr
                        key={p.id}
                        className="border-b border-pos-muted/10 transition-colors hover:bg-pos-background/50 cursor-pointer"
                        onClick={() => handleViewDetail(p)}
                      >
                        <td className="py-2 pr-1 font-mono text-xs text-pos-muted">#{p.id}</td>
                        <td className="py-2 px-1 font-medium text-pos-text">{p.proveedor_name}</td>
                        <td className="py-2 px-1 text-pos-muted">
                          {new Date(p.date).toLocaleDateString("es-AR")}
                        </td>
                        <td className="py-2 px-1">
                          <span className="flex items-center gap-1">
                            <span
                              className={`inline-block text-xs font-medium px-1.5 py-0.5 rounded-full ${STATUS_COLORS[p.status]}`}
                            >
                              {getStatusLabel(p.status)}
                            </span>
                            {p.items.some((i) => i.received_qty > 0) && (
                              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                {p.items.reduce((s, i) => s + i.received_qty, 0)}/{p.items.reduce((s, i) => s + i.quantity, 0)}
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="py-2 px-1 text-right font-mono text-pos-text">
                          {formatCurrency(p.total)}
                        </td>
                        <td className="py-2 pl-1 text-right whitespace-nowrap">
                          <select
                            value={p.status}
                            onChange={(e) => handleUpdateStatus(p, e.target.value as PedidoStatus)}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs border border-pos-muted/30 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-pos-secondary"
                          >
                            <option value="pending">Pendiente</option>
                            <option value="partial">Parcial</option>
                            <option value="received">Recibido</option>
                            <option value="cancelled">Cancelado</option>
                          </select>
                          <button
                            onClick={(e) => { e.stopPropagation(); setView({ kind: "edit", pedido: p }); }}
                            className="text-xs px-2 py-1 text-pos-secondary hover:bg-pos-secondary/10 rounded touch-target ml-1"
                          >
                            Editar
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(p); }}
                            className="text-xs px-2 py-1 text-pos-danger hover:bg-pos-danger/10 rounded touch-target ml-1"
                          >
                            Eliminar
                          </button>
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

      {(view.kind === "create" || view.kind === "edit") && (
        <div className="flex-1 bg-pos-surface rounded-xl border border-pos-muted/10 p-4 overflow-y-auto">
          <PedidoForm
            key={view.kind === "edit" ? view.pedido.id : "create"}
            editPedido={view.kind === "edit" ? view.pedido : undefined}
            onSaved={handleSaved}
            onCancel={handleCancel}
          />
        </div>
      )}

      {view.kind === "detail" && (
        <div className="flex-1 bg-pos-surface rounded-xl border border-pos-muted/10 p-4 overflow-y-auto">
          <DetailView pedido={view.pedido} onBack={() => setView({ kind: "list" })} onEdit={(p) => setView({ kind: "edit", pedido: p })} />
        </div>
      )}
    </div>
  );
}

function DetailView({ pedido: initialPedido, onBack, onEdit }: { pedido: Pedido; onBack: () => void; onEdit: (p: Pedido) => void }) {
  const pedidos = usePedidosStore((s) => s.pedidos);
  const receiveItem = usePedidosStore((s) => s.receiveItem);

  const pedido = pedidos.find((p) => p.id === initialPedido.id) ?? initialPedido;

  const [receiveQtys, setReceiveQtys] = useState<Record<number, number>>({});

  const STATUS_COLORS_DETAIL: Record<string, string> = {
    pending: "text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30",
    received: "text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30",
    cancelled: "text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30",
    partial: "text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30",
  };

  function handlePrint() {
    const companyStr = localStorage.getItem("bazar-company");
    const company = companyStr ? JSON.parse(companyStr) : null;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const rows = pedido.items
      .map(
        (item) => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #d1d5db;">${item.product_name}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #d1d5db;text-align:center;">${item.quantity}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #d1d5db;text-align:right;">${formatCurrency(item.unit_price)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #d1d5db;text-align:right;">${formatCurrency(item.subtotal)}</td>
      </tr>`,
      )
      .join("");

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
      <head>
        <title>Pedido #${pedido.id}</title>
        <style>
          @page { margin: 15mm; }
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; margin:0; padding:0; font-size:13px; }
          .header { text-align:center; margin-bottom:24px; padding-bottom:16px; border-bottom:2px solid #e5e7eb; }
          .header h1 { margin:0 0 4px; font-size:20px; color:#111827; }
          .header p { margin:2px 0; color:#6b7280; font-size:12px; }
          h2 { font-size:16px; margin:0 0 16px; color:#374151; }
          .meta { display:flex; justify-content:space-between; margin-bottom:20px; font-size:12px; color:#6b7280; }
          .meta strong { color:#374151; }
          table { width:100%; border-collapse:collapse; margin-bottom:16px; }
          th { background:#f3f4f6; padding:6px 10px; text-align:left; font-size:11px; text-transform:uppercase; color:#6b7280; border-bottom:2px solid #d1d5db; }
          th:not(:first-child) { text-align:right; }
          .total-row td { padding:8px 10px; font-weight:bold; font-size:14px; border-top:2px solid #d1d5db; }
          .total-row td:last-child { text-align:right; }
          .status-badge { display:inline-block; padding:3px 10px; border-radius:999px; font-size:11px; font-weight:600; }
          .footer { margin-top:24px; padding-top:12px; border-top:1px solid #e5e7eb; font-size:11px; color:#9ca3af; text-align:center; }
        </style>
      </head>
      <body>
        <div class="header">
          ${company ? `<h1>${company.name}</h1>` : ""}
          ${company?.address ? `<p>${company.address}</p>` : ""}
          ${company?.phone ? `<p>Tel: ${company.phone}</p>` : ""}
        </div>
        <h2>Pedido #${pedido.id}</h2>
        <div class="meta">
          <div><strong>Proveedor:</strong> ${pedido.proveedor_name}</div>
          <div><strong>Fecha:</strong> ${new Date(pedido.date).toLocaleDateString("es-AR")}</div>
          <div><strong>Estado:</strong> ${getStatusLabel(pedido.status)}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th style="text-align:center;">Cant</th>
              <th style="text-align:right;">P. Unit</th>
              <th style="text-align:right;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
          <tfoot>
            <tr class="total-row">
              <td colspan="3" style="text-align:right;">Total</td>
              <td>${formatCurrency(pedido.total)}</td>
            </tr>
          </tfoot>
        </table>
        <div class="footer">Generado el ${new Date().toLocaleDateString("es-AR", { dateStyle: "long" })}</div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  }

  function handleReceive(itemId: number) {
    const qty = receiveQtys[itemId] || 0;
    if (qty <= 0) return;
    receiveItem(pedido.id, itemId, qty);
    setReceiveQtys((prev) => ({ ...prev, [itemId]: 0 }));
  }

  const isLocked = pedido.status === "received" || pedido.status === "cancelled";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-pos-text uppercase tracking-wide">
          Pedido #{pedido.id}
        </h3>
        <div className="flex items-center gap-2">
          {!isLocked && (
            <button
              onClick={() => onEdit(pedido)}
              className="text-xs px-3 py-1.5 bg-pos-secondary text-white rounded-lg touch-target hover:opacity-90"
            >
              Editar
            </button>
          )}
          <button
            onClick={handlePrint}
            className="text-xs px-3 py-1.5 border border-pos-muted/30 text-pos-text rounded-lg touch-target hover:bg-pos-background"
          >
            Imprimir
          </button>
          <button
            onClick={onBack}
            className="text-xs px-3 py-1.5 border border-pos-muted/30 text-pos-text rounded-lg touch-target hover:bg-pos-background"
          >
            ← Volver
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-pos-muted">Proveedor:</span>{" "}
          <span className="text-pos-text font-medium">{pedido.proveedor_name}</span>
        </div>
        <div>
          <span className="text-pos-muted">Fecha:</span>{" "}
          <span className="text-pos-text">{new Date(pedido.date).toLocaleDateString("es-AR")}</span>
        </div>
        <div>
          <span className="text-pos-muted">Estado:</span>{" "}
          <span
            className={`inline-block text-xs font-medium px-1.5 py-0.5 rounded-full ${STATUS_COLORS_DETAIL[pedido.status]}`}
          >
            {getStatusLabel(pedido.status)}
          </span>
        </div>
        {pedido.notes && (
          <div className="col-span-2">
            <span className="text-pos-muted">Notas:</span>{" "}
            <span className="text-pos-text">{pedido.notes}</span>
          </div>
        )}
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-pos-muted border-b border-pos-muted/20">
            <th className="text-left py-2 pr-2 font-medium">Producto</th>
            <th className="text-right py-2 px-2 font-medium">Cant</th>
            <th className="text-right py-2 px-2 font-medium">Recibido</th>
            <th className="text-right py-2 px-2 font-medium">P. Unit</th>
            <th className="text-right py-2 pl-2 font-medium">Subtotal</th>
            {!isLocked && <th className="text-right py-2 pl-2 font-medium">Recibir</th>}
          </tr>
        </thead>
        <tbody>
          {pedido.items.map((item) => {
            const fullyReceived = item.received_qty >= item.quantity;
            return (
              <tr key={item.id} className="border-b border-pos-muted/10">
                <td className="py-2 pr-2 text-pos-text">{item.product_name}</td>
                <td className="py-2 px-2 text-right text-pos-muted">{item.quantity}</td>
                <td className="py-2 px-2 text-right">
                  <span className={fullyReceived ? "text-green-600 font-medium" : "text-pos-muted"}>
                    {item.received_qty}
                  </span>
                </td>
                <td className="py-2 px-2 text-right font-mono text-pos-text">{formatCurrency(item.unit_price)}</td>
                <td className="py-2 pl-2 text-right font-mono text-pos-text">{formatCurrency(item.subtotal)}</td>
                {!isLocked && (
                  <td className="py-2 pl-2 text-right">
                    {fullyReceived ? (
                      <span className="text-xs text-green-600 font-medium">Completo</span>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="number"
                          min="0"
                          max={item.quantity - item.received_qty}
                          value={receiveQtys[item.id] ?? ""}
                          onChange={(e) =>
                            setReceiveQtys((prev) => ({
                              ...prev,
                              [item.id]: Math.max(0, Number(e.target.value)),
                            }))
                          }
                          placeholder="0"
                          className="w-14 text-xs border border-pos-muted/30 rounded px-1.5 py-1 text-right focus:outline-none focus:ring-1 focus:ring-pos-secondary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                          onClick={() => handleReceive(item.id)}
                          disabled={!receiveQtys[item.id] || receiveQtys[item.id] <= 0}
                          className="text-xs px-2 py-1 bg-pos-secondary text-white rounded touch-target hover:opacity-90 disabled:opacity-40"
                        >
                          OK
                        </button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="font-bold text-pos-text">
            <td colSpan={4} className="py-2 pr-2 text-right">Total</td>
            <td className="py-2 pl-2 text-right font-mono">{formatCurrency(pedido.total)}</td>
            {!isLocked && <td />}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
