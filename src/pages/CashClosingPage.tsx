import { useState, useCallback, useMemo } from "react";
import { useAppStore, type CompletedSale } from "@/store";
import { useAuthStore } from "@/store/auth";
import { useActiveStore } from "@/store/context";
import { useCashClosingStore, type Shift } from "@/store/cash-closing";
import ShiftPanel from "@/components/ShiftPanel";
import ReconciliationForm from "@/components/ReconciliationForm";
import ClosureReport from "@/components/ClosureReport";
import { exportTableToPdf, exportToExcel, type ExportColumn } from "@/lib/export-utils";
import { formatCurrency } from "@/lib/format";

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export default function CashClosingPage() {
  const { storeId } = useActiveStore();
  const completedSales = useAppStore((s) => s.completedSales);
  const shifts = useCashClosingStore((s) => s.shifts);
  const getOpenShift = useCashClosingStore((s) => s.getOpenShift);
  const getShiftsByStore = useCashClosingStore((s) => s.getShiftsByStore);

  const [selectedShiftId, setSelectedShiftId] = useState<number | null>(null);

  const currentUser = useAuthStore((s) => s.currentUser);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const isAdmin = hasPermission("admin");

  const currentShift = getOpenShift(storeId);
  const storeShifts = getShiftsByStore(storeId);

  // Cuando se abre/cierra un turno, solo refrescamos sin pisar la selección
  const handleShiftChanged = useCallback(() => {
    // Force re-render via state toggle — shifts store changed
    setSelectedShiftId((prev) => prev);
  }, []);

  // Find the selected shift object
  const selectedShift: Shift | null =
    storeShifts.find((s) => s.id === selectedShiftId) ?? null;

  // ── Export handlers ──

  const shiftColumns: ExportColumn[] = [
    { header: "Cajero", key: "cajero" },
    { header: "Turno", key: "turno" },
    { header: "Apertura", key: "apertura" },
    { header: "Ventas", key: "ventas" },
    { header: "Efectivo", key: "efectivo" },
    { header: "Tarjeta", key: "tarjeta" },
    { header: "Mercado Pago", key: "mercadopago" },
    { header: "Total", key: "total" },
    { header: "Estado", key: "estado" },
  ];

  const shiftExportData = useMemo(() => {
    return storeShifts.map((shift) => {
      const shiftSales = completedSales.filter((s) => {
        const t = new Date(s.date).getTime();
        const open = new Date(shift.openTime).getTime();
        const close = shift.closeTime
          ? new Date(shift.closeTime).getTime()
          : Date.now();
        return t >= open && t <= close;
      });
      const cashTotal = shiftSales.reduce((sum, s) => {
        if (s.paymentMethod === "cash") return sum + s.total;
        if (s.paymentMethod === "mixed") return sum + (s.cashAmount ?? 0);
        return sum;
      }, 0);
      const cardTotal = shiftSales.reduce((sum, s) => {
        if (s.paymentMethod === "card") return sum + s.total;
        if (s.paymentMethod === "mixed") return sum + (s.cardAmount ?? 0);
        return sum;
      }, 0);
      const mercadopagoTotal = shiftSales.reduce((sum, s) => {
        if (s.paymentMethod === "mercadopago") return sum + s.total;
        if (s.paymentMethod === "mixed") return sum + (s.mercadopagoAmount ?? 0);
        return sum;
      }, 0);
      const total = Math.round((cashTotal + cardTotal + mercadopagoTotal) * 100) / 100;
      return {
        cajero: shift.employee,
        turno: new Date(shift.openTime).toLocaleDateString(),
        apertura: formatCurrency(shift.openingBalance),
        ventas: shiftSales.length,
        efectivo: formatCurrency(cashTotal),
        tarjeta: formatCurrency(cardTotal),
        mercadopago: formatCurrency(mercadopagoTotal),
        total: formatCurrency(total),
        estado: shift.status === "open" ? "Abierto" : "Cerrado",
      };
    });
  }, [storeShifts, completedSales]);

  const exportShiftsExcel = useCallback(() => {
    exportToExcel(shiftExportData, shiftColumns, "Cierre-de-Caja");
  }, [shiftExportData]);

  const exportShiftsPdf = useCallback(() => {
    exportTableToPdf(shiftExportData, shiftColumns, "Cierre de Caja");
  }, [shiftExportData]);

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full">
      {/* ── Left panel: Shift list ── */}
      <aside className="w-full lg:w-72 flex-shrink-0 bg-pos-surface rounded-xl border border-pos-muted/10 p-3 overflow-y-auto max-h-40 lg:max-h-full dark:bg-gray-800 dark:border-gray-600/30">
        <ShiftList
          shifts={storeShifts}
          currentShift={currentShift}
          selectedId={selectedShiftId}
          onSelect={setSelectedShiftId}
        />
      </aside>

      {/* ── Center panel: ShiftPanel or Reconciliation or Report ── */}
      <section className="flex-1 bg-pos-surface rounded-xl border border-pos-muted/10 p-4 overflow-y-auto dark:bg-gray-800 dark:border-gray-600/30">
        <h2 className="text-sm font-semibold text-pos-text uppercase tracking-wide mb-4">
          Cierre de Caja
        </h2>

        {/* ── Admin: Cashier Summary — oculto si hay selección ── */}
        {isAdmin && !selectedShift && storeShifts.length > 0 && (
          <div className="mb-6 bg-pos-background/30 rounded-xl border border-pos-muted/10 p-4 dark:bg-gray-800/50 dark:border-gray-600/30">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-pos-text uppercase tracking-wide">
                Resumen de Cajeros
              </h3>
              {storeShifts.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={exportShiftsExcel}
                    className="text-xs px-2 py-1 border border-pos-muted/30 text-pos-text rounded hover:bg-pos-background/50 transition-colors"
                  >
                    Excel
                  </button>
                  <button
                    onClick={exportShiftsPdf}
                    className="text-xs px-2 py-1 border border-pos-muted/30 text-pos-text rounded hover:bg-pos-background/50 transition-colors"
                  >
                    PDF
                  </button>
                </div>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-pos-muted border-b border-pos-muted/20 dark:text-gray-400 dark:border-gray-700">
                    <th className="text-left py-1.5 pr-2 font-medium">Cajero</th>
                    <th className="text-left py-1.5 px-2 font-medium">Turno</th>
                    <th className="text-right py-1.5 px-2 font-medium">Apertura</th>
                    <th className="text-right py-1.5 px-2 font-medium">Ventas</th>
                    <th className="text-right py-1.5 px-2 font-medium">Efectivo</th>
                    <th className="text-right py-1.5 px-2 font-medium">Tarjeta</th>
                    <th className="text-right py-1.5 px-2 font-medium">M. Pago</th>
                    <th className="text-right py-1.5 px-2 font-medium">Total</th>
                    <th className="text-center py-1.5 pl-2 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {storeShifts.map((shift) => {
                    const shiftSales = completedSales.filter((s) => {
                      const t = new Date(s.date).getTime();
                      const open = new Date(shift.openTime).getTime();
                      const close = shift.closeTime
                        ? new Date(shift.closeTime).getTime()
                        : Date.now();
                      return t >= open && t <= close;
                    });
                    const cashTotal = shiftSales.reduce((sum, s) => {
                      if (s.paymentMethod === "cash") return sum + s.total;
                      if (s.paymentMethod === "mixed") return sum + (s.cashAmount ?? 0);
                      return sum;
                    }, 0);
                    const cardTotal = shiftSales.reduce((sum, s) => {
                      if (s.paymentMethod === "card") return sum + s.total;
                      if (s.paymentMethod === "mixed") return sum + (s.cardAmount ?? 0);
                      return sum;
                    }, 0);
                    const mercadopagoTotal = shiftSales.reduce((sum, s) => {
                      if (s.paymentMethod === "mercadopago") return sum + s.total;
                      if (s.paymentMethod === "mixed") return sum + (s.mercadopagoAmount ?? 0);
                      return sum;
                    }, 0);
                    const total = Math.round((cashTotal + cardTotal + mercadopagoTotal) * 100) / 100;

                    return (
                      <tr key={shift.id} className="border-b border-pos-muted/10 hover:bg-pos-background/50 dark:border-gray-700 dark:hover:bg-gray-700/50">
                        <td className="py-2 pr-2 font-medium text-pos-text">{shift.employee}</td>
                        <td className="py-2 px-2 text-pos-muted">
                          {new Date(shift.openTime).toLocaleDateString()}
                        </td>
                        <td className="py-2 px-2 num text-pos-muted">
                          {formatCurrency(shift.openingBalance)}
                        </td>
                        <td className="py-2 px-2 num">{shiftSales.length}</td>
                        <td className="py-2 px-2 num">{formatCurrency(cashTotal)}</td>
                        <td className="py-2 px-2 num">{formatCurrency(cardTotal)}</td>
                        <td className="py-2 px-2 num">{formatCurrency(mercadopagoTotal)}</td>
                        <td className="py-2 px-2 num font-bold">{formatCurrency(total)}</td>
                        <td className="py-2 pl-2 text-center">
                          {shift.status === "open" ? (
                            <span className="text-pos-success font-medium">● Abierto</span>
                          ) : (
                            <span className="text-pos-muted">Cerrado</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Panel central: muestra solo un panel a la vez */}
        {selectedShift ? (
          /* ── Turno cerrado seleccionado del historial ── */
          selectedShift.status === "closed" && selectedShift.reconciliationStatus ? (
            <ClosureReport
              shiftId={selectedShift.id}
              completedSales={completedSales}
            />
          ) : selectedShift.status === "closed" ? (
            <ReconciliationForm
              shift={selectedShift}
              completedSales={completedSales}
              onReconciled={() => setSelectedShiftId((prev) => prev)}
            />
          ) : (
            /* Si seleccionaron el turno abierto, igual mostramos el panel del turno abierto */
            <ShiftPanel
              storeId={storeId}
              currentShift={selectedShift}
              onShiftChanged={handleShiftChanged}
            />
          )
        ) : currentShift ? (
          /* ── Turno abierto, nada seleccionado ── */
          <ShiftPanel
            storeId={storeId}
            currentShift={currentShift}
            onShiftChanged={handleShiftChanged}
          />
        ) : (
          /* ── Sin turnos ni selección ── */
          <ShiftPanel
            storeId={storeId}
            currentShift={null}
            onShiftChanged={handleShiftChanged}
          />
        )}

        {/* Empty state */}
        {!currentShift && !selectedShift && (
          <div className="flex items-center justify-center h-48">
            <p className="text-sm text-pos-muted italic">
              Todavía no hay turnos. Abrí un turno desde el panel izquierdo o usá el formulario.
            </p>
          </div>
        )}
      </section>

      {/* ── Right panel: Quick stats for selected shift ── */}
      {selectedShift && (
        <aside className="w-full lg:w-80 flex-shrink-0 bg-pos-surface rounded-xl border border-pos-muted/10 p-3 overflow-y-auto max-h-40 lg:max-h-full dark:bg-gray-800 dark:border-gray-600/30">
          <ShiftQuickStats
            shift={selectedShift}
            completedSales={completedSales}
          />
        </aside>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Sub-component: Shift List
// ──────────────────────────────────────────────

function ShiftList({
  shifts,
  currentShift,
  selectedId,
  onSelect,
}: {
  shifts: Shift[];
  currentShift: Shift | null;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}) {
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");

  // Unique employees, sorted
  const employees = [...new Set(shifts.map((s) => s.employee))].sort();

  const filtered =
    employeeFilter === "all"
      ? shifts
      : shifts.filter((s) => s.employee === employeeFilter);

  if (shifts.length === 0) {
    return (
      <div className="flex items-center justify-center h-32">
        <p className="text-xs text-pos-muted italic">No hay turnos registrados</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-pos-text uppercase tracking-wide">
          Historial de Turnos
        </h3>
        <select
          value={employeeFilter}
          onChange={(e) => {
            setEmployeeFilter(e.target.value);
            onSelect(null);
          }}
          className="text-xs border border-pos-muted/20 rounded-lg px-2 py-1 bg-pos-surface text-pos-text focus:outline-none focus:ring-2 focus:ring-pos-secondary dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
        >
          <option value="all">Todos</option>
          {employees.map((emp) => (
            <option key={emp} value={emp}>{emp}</option>
          ))}
        </select>
      </div>

      {filtered.map((s) => {
        const isOpen = s.status === "open";
        const isSelected = s.id === selectedId;

        return (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
              isSelected
                ? "border-pos-secondary bg-pos-secondary/10 dark:border-blue-500 dark:bg-blue-900/20"
                : "border-transparent hover:bg-pos-background/50 dark:hover:bg-gray-700/50"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-pos-text truncate">
                {s.employee}
              </span>
              {isOpen ? (
                <span className="text-xs bg-pos-success/10 text-pos-success font-medium px-1.5 py-0.5 rounded-full">
                  Abierto
                </span>
              ) : (
                <span className="text-xs bg-pos-muted/10 text-pos-muted font-medium px-1.5 py-0.5 rounded-full">
                  Cerrado
                </span>
              )}
            </div>
            <div className="text-xs text-pos-muted">
              {new Date(s.openTime).toLocaleDateString()}{" "}
              {new Date(s.openTime).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
            {s.reconciliationStatus && (
              <div
                className={`text-xs mt-1 ${
                  s.reconciliationStatus === "matched"
                    ? "text-pos-success"
                    : "text-pos-accent"
                }`}
              >
                {s.reconciliationStatus === "matched" ? "✓ Coincide" : "⚠ Diferencia"}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────
// Sub-component: Shift Quick Stats
// ──────────────────────────────────────────────

function ShiftQuickStats({
  shift,
  completedSales,
}: {
  shift: Shift;
  completedSales: CompletedSale[];
}) {
  const openTime = new Date(shift.openTime).getTime();
  const closeTime = shift.closeTime
    ? new Date(shift.closeTime).getTime()
    : Date.now();

  const shiftSales = completedSales.filter((s) => {
    const t = new Date(s.date).getTime();
    return t >= openTime && t <= closeTime;
  });

  const cashTotal = shiftSales.reduce((sum, s) => {
    if (s.paymentMethod === "cash") return sum + s.total;
    if (s.paymentMethod === "mixed") return sum + (s.cashAmount ?? 0);
    return sum;
  }, 0);
  const cardTotal = shiftSales.reduce((sum, s) => {
    if (s.paymentMethod === "card") return sum + s.total;
    if (s.paymentMethod === "mixed") return sum + (s.cardAmount ?? 0);
    return sum;
  }, 0);
  const mercadopagoTotal = shiftSales.reduce((sum, s) => {
    if (s.paymentMethod === "mercadopago") return sum + s.total;
    if (s.paymentMethod === "mixed") return sum + (s.mercadopagoAmount ?? 0);
    return sum;
  }, 0);
  const totalSales = Math.round((cashTotal + cardTotal + mercadopagoTotal) * 100) / 100;
  const itemCount = shiftSales.reduce(
    (sum, s) => sum + s.items.reduce((q, i) => q + i.quantity, 0),
    0,
  );

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-pos-text uppercase tracking-wide">
        Resumen
      </h3>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-pos-muted">Transacciones</span>
          <span className="text-sm font-mono font-bold">
            {shiftSales.length}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-pos-muted">Productos Vendidos</span>
          <span className="text-sm font-mono font-bold">{itemCount}</span>
        </div>
        <hr className="border-pos-muted/20" />
        <div className="flex items-center justify-between">
          <span className="text-xs text-pos-muted">Efectivo</span>
          <span className="text-sm font-mono">
            {formatCurrency(cashTotal)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-pos-muted">Tarjeta</span>
          <span className="text-sm font-mono">
            {formatCurrency(cardTotal)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-pos-muted">Mercado Pago</span>
          <span className="text-sm font-mono">
            {formatCurrency(mercadopagoTotal)}
          </span>
        </div>
        <hr className="border-pos-muted/20" />
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold">Total Ventas</span>
          <span className="text-sm font-mono font-bold text-pos-text">
            {formatCurrency(totalSales)}
          </span>
        </div>
      </div>
    </div>
  );
}
