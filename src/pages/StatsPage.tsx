import { useState, useMemo, useCallback } from "react";
import { useAppStore } from "@/store";
import { useActiveStore } from "@/store/context";
import { useProductsStore } from "@/store/products";
import { useExpensesStore } from "@/store/expenses";
import DateRangeFilter, {
  type DateRange,
  type Preset,
} from "@/components/DateRangeFilter";
import SalesChart, { type Granularity } from "@/components/SalesChart";
import TopSellers from "@/components/TopSellers";
import PaymentMethodChart from "@/components/PaymentMethodChart";
import HourlySalesChart from "@/components/HourlySalesChart";
import CategoryBreakdown from "@/components/CategoryBreakdown";
import CashierBreakdown from "@/components/CashierBreakdown";
import { formatCurrency } from "@/lib/format";
import { exportTableToPdf, exportToExcel, type ExportColumn } from "@/lib/export-utils";

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function isSaleInRange(
  saleDate: string,
  from: Date | null,
  to: Date | null,
): boolean {
  const ts = new Date(saleDate).getTime();

  if (from && ts < from.getTime()) return false;
  if (to && ts > to.getTime()) return false;

  return true;
}

function deltaPercent(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100 * 10) / 10;
}

function computeMetrics(sales: { total: number; items: { quantity: number; subtotal: number; productId: number; unitPrice: number }[] }[], products: Map<number, number>) {
  const totalRevenue = sales.reduce((s, sale) => s + sale.total, 0);
  const totalTransactions = sales.length;
  const totalItems = sales.reduce((s, sale) => s + sale.items.reduce((si, i) => si + i.quantity, 0), 0);

  // Profit margin
  let totalCost = 0;
  for (const sale of sales) {
    for (const item of sale.items) {
      const costPrice = products.get(item.productId) ?? 0;
      totalCost += costPrice * item.quantity;
    }
  }
  const grossProfit = totalRevenue - totalCost;
  const marginPercent = totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 1000) / 10 : 0;

  return { totalRevenue, totalTransactions, totalItems, grossProfit, marginPercent };
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export default function StatsPage() {
  const { storeId } = useActiveStore();
  const completedSales = useAppStore((s) => s.completedSales);
  const products = useProductsStore((s) => s.products);
  const categories = useProductsStore((s) => s.categories);
  const expenses = useExpensesStore((s) => s.expenses);

  // Build product cost map once
  const productCostMap = useMemo(() => {
    const map = new Map<number, number>();
    for (const p of products) {
      map.set(p.id, p.costPrice);
    }
    return map;
  }, [products]);

  // ── Date filter state ──
  const [dateRange, setDateRange] = useState<DateRange>({
    from: null,
    to: null,
  });
  const [granularity, setGranularity] = useState<Granularity>("day");

  const handleDateRangeChange = useCallback(
    (range: DateRange, _preset: Preset | "custom") => {
      setDateRange(range);
    },
    [],
  );

  // ── Filtered sales (current period) ──
  const filteredSales = useMemo(() => {
    return completedSales.filter((sale) => {
      if (sale.storeId !== storeId) return false;
      return isSaleInRange(sale.date, dateRange.from, dateRange.to);
    });
  }, [completedSales, storeId, dateRange]);

  // ── Previous period sales (for comparison) ──
  const previousSales = useMemo(() => {
    if (!dateRange.from || !dateRange.to) return [];

    const periodMs = dateRange.to.getTime() - dateRange.from.getTime();
    const prevFrom = new Date(dateRange.from.getTime() - periodMs);
    const prevTo = new Date(dateRange.from.getTime());

    return completedSales.filter((sale) => {
      if (sale.storeId !== storeId) return false;
      return isSaleInRange(sale.date, prevFrom, prevTo);
    });
  }, [completedSales, storeId, dateRange]);

  // ── Metrics ──
  const metrics = useMemo(() => computeMetrics(filteredSales, productCostMap), [filteredSales, productCostMap]);
  const prevMetrics = useMemo(() => computeMetrics(previousSales, productCostMap), [previousSales, productCostMap]);

  // ── Expenses in current period ──
  const periodExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (e.storeId !== storeId) return false;
      return isSaleInRange(e.date, dateRange.from, dateRange.to);
    });
  }, [expenses, storeId, dateRange]);

  const totalExpenses = useMemo(
    () => periodExpenses.reduce((s, e) => s + e.amount, 0),
    [periodExpenses],
  );

  const netIncome = metrics.totalRevenue - totalExpenses;

  // ── Export handlers ──

  const topSellersColumns: ExportColumn[] = [
    { header: "Producto", key: "producto" },
    { header: "Cantidad", key: "cantidad" },
    { header: "Ingresos", key: "ingresos" },
  ];

  const topSellersData = useMemo(() => {
    const productMap = new Map<string, { qty: number; total: number }>();
    for (const sale of filteredSales) {
      for (const item of sale.items) {
        const existing = productMap.get(item.productName);
        if (existing) {
          existing.qty += item.quantity;
          existing.total += item.subtotal;
        } else {
          productMap.set(item.productName, {
            qty: item.quantity,
            total: item.subtotal,
          });
        }
      }
    }
    return [...productMap.entries()]
      .map(([name, data]) => ({
        producto: name,
        cantidad: data.qty,
        ingresos: data.total,
      }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 10);
  }, [filteredSales]);

  const salesSummaryColumns: ExportColumn[] = [
    { header: "Métrica", key: "metrica" },
    { header: "Valor", key: "valor" },
  ];

  const exportTopSellersPdf = useCallback(() => {
    const data = topSellersData.map((item) => ({
      producto: item.producto,
      cantidad: String(item.cantidad),
      ingresos: formatCurrency(item.ingresos),
    }));
    exportTableToPdf(data, topSellersColumns, "Más Vendidos");
  }, [topSellersData]);

  const exportTopSellersExcel = useCallback(() => {
    exportToExcel(topSellersData, topSellersColumns, "Mas-Vendidos");
  }, [topSellersData]);

  const exportSummaryPdf = useCallback(() => {
    const data = [
      { metrica: "Ingresos Totales", valor: formatCurrency(metrics.totalRevenue) },
      { metrica: "Transacciones", valor: String(metrics.totalTransactions) },
      { metrica: "Productos Vendidos", valor: String(metrics.totalItems) },
      { metrica: "Margen Bruto", valor: `${formatCurrency(metrics.grossProfit)} (${metrics.marginPercent}%)` },
      { metrica: "Gastos", valor: formatCurrency(totalExpenses) },
      { metrica: "Ingreso Neto", valor: formatCurrency(netIncome) },
    ];
    exportTableToPdf(data, salesSummaryColumns, "Resumen de Ventas");
  }, [metrics, totalExpenses, netIncome]);

  const exportSummaryExcel = useCallback(() => {
    const data = [
      { metrica: "Ingresos Totales", valor: metrics.totalRevenue },
      { metrica: "Transacciones", valor: metrics.totalTransactions },
      { metrica: "Productos Vendidos", valor: metrics.totalItems },

      { metrica: "Margen Bruto %", valor: metrics.marginPercent },
      { metrica: "Gastos", valor: totalExpenses },
      { metrica: "Ingreso Neto", valor: netIncome },
    ];
    exportToExcel(data, salesSummaryColumns, "Resumen-Ventas");
  }, [metrics, totalExpenses, netIncome]);

  // ── Render helpers ──

  function DeltaBadge({ current, previous }: { current: number; previous: number }) {
    const delta = deltaPercent(current, previous);
    if (delta == null) return null;

    const isUp = delta > 0;
    const isNeutral = delta === 0;

    return (
      <span
        className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ml-1.5 ${
          isNeutral
            ? "text-pos-muted"
            : isUp
              ? "text-green-600"
              : "text-red-500"
        }`}
      >
        {isNeutral ? "―" : isUp ? "↑" : "↓"}
        {!isNeutral && `${Math.abs(delta)}%`}
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-5 h-full">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-pos-text">Estadísticas de Ventas</h1>

        {/* Granularity toggle */}
        <div className="flex items-center gap-1.5 self-stretch sm:self-auto">
          <span className="text-xs text-pos-muted">Ver:</span>
          {(["day", "week", "month"] as Granularity[]).map((g) => {
            const GRANULARITY_LABELS: Record<Granularity, string> = { day: "Día", week: "Semana", month: "Mes" };
            return (
            <button
              key={g}
              onClick={() => setGranularity(g)}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors touch-target ${
                granularity === g
                  ? "bg-pos-secondary text-white"
                  : "bg-pos-background text-pos-muted hover:text-pos-secondary"
              }`}
            >
              {GRANULARITY_LABELS[g]}
            </button>
            );
          })}
        </div>
      </div>

      {/* ── Date Range Filter ── */}
      <DateRangeFilter value={dateRange} onChange={handleDateRangeChange} />

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <SummaryCard
          label="Ingreso Bruto"
          value={formatCurrency(metrics.totalRevenue)}
          delta={<DeltaBadge current={metrics.totalRevenue} previous={prevMetrics.totalRevenue} />}
        />
        <SummaryCard
          label="Transacciones"
          value={String(metrics.totalTransactions)}
          delta={<DeltaBadge current={metrics.totalTransactions} previous={prevMetrics.totalTransactions} />}
        />
        <SummaryCard
          label="Productos Vend."
          value={String(metrics.totalItems)}
          delta={<DeltaBadge current={metrics.totalItems} previous={prevMetrics.totalItems} />}
        />
        <SummaryCard
          label="Ingreso Neto"
          value={formatCurrency(metrics.grossProfit)}
          delta={<DeltaBadge current={metrics.grossProfit} previous={prevMetrics.grossProfit} />}
        />
        <SummaryCard
          label="Margen Bruto"
          value={`${metrics.marginPercent}%`}
          subtitle={formatCurrency(metrics.grossProfit)}
          delta={<DeltaBadge current={metrics.grossProfit} previous={prevMetrics.grossProfit} />}
        />
        <SummaryCard
          label="Resultado Neto"
          value={formatCurrency(netIncome)}
          subtitle={`Gastos: ${formatCurrency(totalExpenses)}`}
          negative={netIncome < 0}
        />
      </div>

      {/* ── Charts Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Ingresos en el Tiempo */}
        <section className="bg-pos-surface rounded-xl border border-pos-muted/10 p-4 dark:bg-gray-800 dark:border-gray-600/30">
          <h2 className="text-sm font-semibold text-pos-text uppercase tracking-wide mb-3">
            Ingresos en el Tiempo
          </h2>
          <SalesChart sales={filteredSales} granularity={granularity} />
        </section>

        {/* Desglose por Pago */}
        <section className="bg-pos-surface rounded-xl border border-pos-muted/10 p-4 dark:bg-gray-800 dark:border-gray-600/30">
          <h2 className="text-sm font-semibold text-pos-text uppercase tracking-wide mb-3">
            Desglose por Método de Pago
          </h2>
          <PaymentMethodChart sales={filteredSales} />
        </section>

        {/* Ventas por Hora */}
        <section className="bg-pos-surface rounded-xl border border-pos-muted/10 p-4 dark:bg-gray-800 dark:border-gray-600/30">
          <h2 className="text-sm font-semibold text-pos-text uppercase tracking-wide mb-3">
            Ventas por Hora
          </h2>
          <HourlySalesChart sales={filteredSales} />
        </section>

        {/* Más Vendidos */}
        <section className="bg-pos-surface rounded-xl border border-pos-muted/10 p-4 dark:bg-gray-800 dark:border-gray-600/30">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-pos-text uppercase tracking-wide">
              Más Vendidos
            </h2>
            {topSellersData.length > 0 && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={exportTopSellersExcel}
                  className="text-xs px-2 py-1 border border-pos-muted/30 text-pos-text rounded hover:bg-pos-background/50 transition-colors"
                >
                  Excel
                </button>
                <button
                  onClick={exportTopSellersPdf}
                  className="text-xs px-2 py-1 border border-pos-muted/30 text-pos-text rounded hover:bg-pos-background/50 transition-colors"
                >
                  PDF
                </button>
              </div>
            )}
          </div>
          <TopSellers sales={filteredSales} limit={10} />
        </section>

        {/* Por Categoría */}
        <section className="bg-pos-surface rounded-xl border border-pos-muted/10 p-4 dark:bg-gray-800 dark:border-gray-600/30">
          <h2 className="text-sm font-semibold text-pos-text uppercase tracking-wide mb-3">
            Ventas por Categoría
          </h2>
          <CategoryBreakdown sales={filteredSales} products={products} categories={categories} />
        </section>

        {/* Por Cajero */}
        <section className="bg-pos-surface rounded-xl border border-pos-muted/10 p-4 dark:bg-gray-800 dark:border-gray-600/30">
          <h2 className="text-sm font-semibold text-pos-text uppercase tracking-wide mb-3">
            Ventas por Cajero
          </h2>
          <CashierBreakdown sales={filteredSales} />
        </section>
      </div>

      {/* ── Export Summary ── */}
      {filteredSales.length > 0 && (
        <div className="flex justify-end gap-2">
          <button
            onClick={exportSummaryExcel}
            className="text-xs px-3 py-1.5 border border-pos-muted/30 text-pos-text rounded-lg hover:bg-pos-background/50 transition-colors"
          >
            Exportar Resumen Excel
          </button>
          <button
            onClick={exportSummaryPdf}
            className="text-xs px-3 py-1.5 border border-pos-muted/30 text-pos-text rounded-lg hover:bg-pos-background/50 transition-colors"
          >
            Exportar Resumen PDF
          </button>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Summary card sub-component
// ──────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  subtitle,
  delta,
  negative,
}: {
  label: string;
  value: string;
  subtitle?: string;
  delta?: React.ReactNode;
  negative?: boolean;
}) {
  return (
    <div className="bg-pos-surface rounded-xl border border-pos-muted/10 p-3 dark:bg-gray-800 dark:border-gray-600/30">
      <p className="text-xs text-pos-muted uppercase tracking-wide mb-1 flex items-center gap-1">
        {label}
        {delta}
      </p>
      <p className={`text-lg font-bold font-mono ${negative ? "text-red-500" : "text-pos-text"}`}>
        {value}
      </p>
      {subtitle && (
        <p className="text-[10px] text-pos-muted mt-0.5">{subtitle}</p>
      )}
    </div>
  );
}
