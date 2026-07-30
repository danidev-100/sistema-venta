import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { CompletedSale } from "@/store";
import { formatCurrency } from "@/lib/format";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

type Props = {
  sales: CompletedSale[];
};

type BucketKey = "cash" | "card" | "mercadopago" | "credit";

type ChartDataPoint = {
  name: string;
  value: number;
  color: string;
  total: number;
};

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

const BUCKET_KEYS: BucketKey[] = ["cash", "card", "mercadopago", "credit"];

const PAYMENT_LABELS: Record<BucketKey, string> = {
  cash: "Efectivo",
  card: "Tarjeta de Crédito/Débito",
  mercadopago: "Mercado Pago",
  credit: "Cuenta Corriente",
};

const PAYMENT_COLORS: Record<BucketKey, string> = {
  cash: "#eab308",     // amarillo
  card: "#ef4444",     // rojo
  mercadopago: "#3b82f6", // azul
  credit: "#8b5cf6",   // violeta (se mantiene)
};

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

const tooltipFormatter = (value: number, _name: string, entry: any) => {
  const total = entry?.payload?.total ?? 1;
  const pct = ((value / total) * 100).toFixed(1);
  return [`${formatCurrency(value)} (${pct}%)`, entry?.payload?.name ?? ""];
};

/**
 * Desglosa las ventas en los 3 métodos reales + cuenta corriente.
 * Los pagos mixtos se separan en sus componentes (cash, card, mp)
 * en vez de aparecer como una categoría "Mixto".
 */
function computeBuckets(sales: CompletedSale[]): Record<BucketKey, number> {
  const buckets: Record<BucketKey, number> = {
    cash: 0,
    card: 0,
    mercadopago: 0,
    credit: 0,
  };

  for (const sale of sales) {
    switch (sale.paymentMethod) {
      case "cash":
        buckets.cash += sale.total;
        break;
      case "card":
        buckets.card += sale.total;
        break;
      case "mercadopago":
        buckets.mercadopago += sale.total;
        break;
      case "credit":
        buckets.credit += sale.total;
        break;
      case "mixed":
        // Desglosar mixto en sus componentes reales
        buckets.cash += sale.cashAmount ?? 0;
        buckets.card += sale.cardAmount ?? 0;
        buckets.mercadopago += sale.mercadopagoAmount ?? 0;
        break;
    }
  }

  return buckets;
}

const renderCustomLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: any) => {
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  if (percent < 0.03) return null;

  return (
    <text
      x={x}
      y={y}
      fill="#fff"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={11}
      fontWeight={600}
    >
      {(percent * 100).toFixed(0)}%
    </text>
  );
};

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export default function PaymentMethodChart({ sales }: Props) {
  const data: ChartDataPoint[] = useMemo(() => {
    if (sales.length === 0) return [];

    const buckets = computeBuckets(sales);

    const total = BUCKET_KEYS.reduce((s, k) => s + buckets[k], 0);
    // Solo mostrar buckets con valor > 0
    const activeKeys = BUCKET_KEYS.filter((k) => buckets[k] > 0);

    return activeKeys.map((key) => ({
      name: PAYMENT_LABELS[key],
      value: Math.round(buckets[key] * 100) / 100,
      color: PAYMENT_COLORS[key],
      total,
    }));
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
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={110}
            paddingAngle={2}
            label={renderCustomLabel}
            labelLine={false}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={data[i].color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: "1px solid var(--color-chart-tooltip-border)",
              backgroundColor: "var(--color-chart-tooltip-bg)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              color: "rgb(var(--color-pos-text))",
            }}
            itemStyle={{ color: "rgb(var(--color-pos-text))" }}
            labelStyle={{ color: "rgb(var(--color-pos-text))" }}
            formatter={tooltipFormatter}
          />
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* ── Summary stats below chart ── */}
      <div className="flex gap-6 mt-2 text-xs text-pos-muted">
        <span>
          Total:{" "}
          <strong className="text-pos-text">
            {formatCurrency(data.reduce((s, d) => s + d.value, 0))}
          </strong>
        </span>
        <span>
          Métodos: <strong className="text-pos-text">{data.length}</strong>
        </span>
      </div>
    </div>
  );
}
