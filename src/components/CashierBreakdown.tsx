import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { CompletedSale } from "@/store";
import { formatCurrency } from "@/lib/format";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

type Props = {
  sales: CompletedSale[];
};

type ChartDataPoint = {
  name: string;
  revenue: number;
  transactions: number;
};

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export default function CashierBreakdown({ sales }: Props) {
  const data: ChartDataPoint[] = useMemo(() => {
    if (sales.length === 0) return [];

    const buckets = new Map<string, { revenue: number; transactions: number }>();

    for (const sale of sales) {
      const cashier = sale.createdBy || "—";
      const existing = buckets.get(cashier);
      if (existing) {
        existing.revenue += sale.total;
        existing.transactions += 1;
      } else {
        buckets.set(cashier, { revenue: sale.total, transactions: 1 });
      }
    }

    return Array.from(buckets.entries())
      .map(([name, v]) => ({
        name,
        revenue: Math.round(v.revenue * 100) / 100,
        transactions: v.transactions,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [sales]);

  // ── Empty state ──
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-pos-background/50 rounded-xl border border-dashed border-pos-muted/20">
        <p className="text-pos-muted text-sm">Sin datos en este período</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-chart-grid)" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: "var(--color-chart-axis)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--color-chart-grid)" }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--color-chart-axis)" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `$${v}`}
          />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: "1px solid var(--color-chart-tooltip-border)",
              backgroundColor: "var(--color-chart-tooltip-bg)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            }}
            formatter={(value: number, name: string) => {
              if (name === "revenue")
                return [formatCurrency(value), "Ingresos"];
              return [value, "Transacciones"];
            }}
          />
          <Bar
            dataKey="revenue"
            fill="var(--color-chart-bar)"
            radius={[4, 4, 0, 0]}
            maxBarSize={48}
          />
        </BarChart>
      </ResponsiveContainer>

      {/* ── Summary stats below chart ── */}
      <div className="flex gap-6 mt-2 text-xs text-pos-muted">
        <span>
          Total:{" "}
          <strong className="text-pos-text">
            {formatCurrency(data.reduce((s, d) => s + d.revenue, 0))}
          </strong>
        </span>
        <span>
          Transacciones:{" "}
          <strong className="text-pos-text">
            {data.reduce((s, d) => s + d.transactions, 0)}
          </strong>
        </span>
        <span>
          Cajeros:{" "}
          <strong className="text-pos-text">{data.length}</strong>
        </span>
      </div>
    </div>
  );
}
