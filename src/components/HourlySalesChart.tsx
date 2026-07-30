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

type HourData = {
  hour: string;
  hourIndex: number;
  revenue: number;
  transactions: number;
};

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export default function HourlySalesChart({ sales }: Props) {
  const data: HourData[] = useMemo(() => {
    if (sales.length === 0) return [];

    const buckets = new Map<number, { revenue: number; transactions: number }>();

    for (const sale of sales) {
      const hour = new Date(sale.date).getHours();
      const existing = buckets.get(hour);
      if (existing) {
        existing.revenue += sale.total;
        existing.transactions += 1;
      } else {
        buckets.set(hour, { revenue: sale.total, transactions: 1 });
      }
    }

    // Build all 24 hours, filling gaps with zeros
    const result: HourData[] = [];
    for (let h = 0; h < 24; h++) {
      const b = buckets.get(h);
      result.push({
        hour: `${String(h).padStart(2, "0")}:00`,
        hourIndex: h,
        revenue: b ? Math.round(b.revenue * 100) / 100 : 0,
        transactions: b?.transactions ?? 0,
      });
    }

    return result;
  }, [sales]);

  // ── Empty state ──
  if (data.every((d) => d.transactions === 0)) {
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
            dataKey="hour"
            tick={{ fontSize: 10, fill: "var(--color-chart-axis)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--color-chart-grid)" }}
            interval={2}
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
              return [value, "Ventas"];
            }}
            labelFormatter={(label: string) => label}
          />
          <Bar
            dataKey="revenue"
            fill="var(--color-chart-bar)"
            radius={[4, 4, 0, 0]}
            maxBarSize={24}
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
          Horas con actividad:{" "}
          <strong className="text-pos-text">
            {data.filter((d) => d.transactions > 0).length}
          </strong>
        </span>
      </div>
    </div>
  );
}
