import { useMemo } from "react";
import type { CompletedSale } from "@/store";
import { formatCurrency } from "@/lib/format";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type SellerRank = {
  rank: number;
  productId: number;
  productName: string;
  quantity: number;
  revenue: number;
};

type TopSellersProps = {
  sales: CompletedSale[];
  /** How many top entries to show (default 10). */
  limit?: number;
};

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function aggregate(sales: CompletedSale[]): SellerRank[] {
  const map = new Map<number, { name: string; qty: number; rev: number }>();

  for (const sale of sales) {
    for (const item of sale.items) {
      const existing = map.get(item.productId);
      if (existing) {
        existing.qty += item.quantity;
        existing.rev += item.subtotal;
      } else {
        map.set(item.productId, {
          name: item.productName,
          qty: item.quantity,
          rev: item.subtotal,
        });
      }
    }
  }

  const sorted = Array.from(map.entries())
    .map(
      ([productId, v]): SellerRank => ({
        rank: 0, // assigned below
        productId,
        productName: v.name,
        quantity: v.qty,
        revenue: Math.round(v.rev * 100) / 100,
      }),
    )
    .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
    .map((entry, i) => ({ ...entry, rank: i + 1 }));

  return sorted;
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export default function TopSellers({ sales, limit = 10 }: TopSellersProps) {
  const ranking = useMemo(() => aggregate(sales).slice(0, limit), [sales, limit]);

  // ── Empty state ──
  if (ranking.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 bg-pos-background/50 rounded-xl border border-dashed border-pos-muted/20">
        <p className="text-pos-muted text-sm">No hay ventas en este período</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-pos-muted uppercase tracking-wide border-b border-pos-muted/10">
            <th className="text-left py-2 pr-2 w-8">#</th>
            <th className="text-left py-2 px-2">Producto</th>
            <th className="text-right py-2 px-2">Cant Vendida</th>
            <th className="text-right py-2 pl-2">Ingresos</th>
          </tr>
        </thead>
        <tbody>
          {ranking.map((entry) => (
            <tr
              key={entry.productId}
              className="border-b border-pos-muted/5 hover:bg-pos-background/40 transition-colors"
            >
              <td className="py-2 pr-2 text-pos-muted text-xs font-mono">
                {entry.rank}
              </td>
              <td className="py-2 px-2 font-medium text-pos-text">
                {entry.productName}
              </td>
              <td className="py-2 px-2 text-right font-mono text-pos-text">
                {entry.quantity}
              </td>
              <td className="py-2 pl-2 text-right font-mono text-pos-text">
                {formatCurrency(entry.revenue)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
