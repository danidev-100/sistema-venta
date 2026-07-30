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
import type { Product, Category } from "@/store/products";
import { formatCurrency } from "@/lib/format";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

type Props = {
  sales: CompletedSale[];
  products: Product[];
  categories: Category[];
};

type ChartDataPoint = {
  name: string;
  revenue: number;
  transactions: number;
};

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export default function CategoryBreakdown({
  sales,
  products,
  categories,
}: Props) {
  const data: ChartDataPoint[] = useMemo(() => {
    if (sales.length === 0 || products.length === 0) return [];

    // Build lookup maps
    const productMap = new Map<number, Product>();
    for (const p of products) {
      productMap.set(p.id, p);
    }

    const categoryMap = new Map<number, string>();
    for (const c of categories) {
      categoryMap.set(c.id, c.name);
    }

    // Aggregate by category name
    const buckets = new Map<string, { revenue: number; transactions: number }>();

    for (const sale of sales) {
      for (const item of sale.items) {
        const product = productMap.get(item.productId);
        const categoryName =
          product?.category_id != null
            ? categoryMap.get(product.category_id) ?? "Sin categoría"
            : "Sin categoría";

        const existing = buckets.get(categoryName);
        if (existing) {
          existing.revenue += item.subtotal;
          existing.transactions += item.quantity;
        } else {
          buckets.set(categoryName, {
            revenue: item.subtotal,
            transactions: item.quantity,
          });
        }
      }
    }

    // Sort by revenue desc, take top 10
    return Array.from(buckets.entries())
      .map(([name, v]) => ({
        name,
        revenue: Math.round(v.revenue * 100) / 100,
        transactions: v.transactions,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [sales, products, categories]);

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
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 8, left: 4, bottom: 4 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-chart-grid)"
            horizontal={false}
          />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: "var(--color-chart-axis)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--color-chart-grid)" }}
            tickFormatter={(v: number) => `$${v}`}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 11, fill: "var(--color-chart-axis)" }}
            tickLine={false}
            axisLine={false}
            width={120}
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
              return [value, "Unidades"];
            }}
          />
          <Bar
            dataKey="revenue"
            fill="var(--color-chart-bar)"
            radius={[0, 4, 4, 0]}
            maxBarSize={20}
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
          Categorías:{" "}
          <strong className="text-pos-text">{data.length}</strong>
        </span>
      </div>
    </div>
  );
}
