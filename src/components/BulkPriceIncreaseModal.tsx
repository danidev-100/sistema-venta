import { useState, useEffect, useMemo, useCallback } from "react";
import type { Product } from "@/store/products";
import { formatCurrency } from "@/lib/format";

// ──────────────────────────────────────────────
// Props
// ──────────────────────────────────────────────

type BulkPriceModalProps = {
  products: Product[];
  selectedIds: number[];
  onApply: (percentage: number) => void;
  onClose: () => void;
};

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export default function BulkPriceModal({
  products,
  selectedIds,
  onApply,
  onClose,
}: BulkPriceModalProps) {
  const [draft, setDraft] = useState("");
  const [animOut, setAnimOut] = useState(false);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeWithAnim();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function closeWithAnim() {
    setAnimOut(true);
    setTimeout(onClose, 150);
  }

  const selected = useMemo(
    () => products.filter((p) => selectedIds.includes(p.id)),
    [products, selectedIds],
  );

  // Parsear el draft a número (acepta coma y punto como decimal)
  const pct = (() => {
    const normalized = draft.replace(",", ".");
    const n = parseFloat(normalized);
    return isNaN(n) ? 0 : n;
  })();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={closeWithAnim}
    >
      <div
        className={`w-full max-w-md bg-pos-surface rounded-2xl shadow-2xl border border-pos-muted/10 mx-4 transition-all duration-150 ${
          animOut ? "opacity-0 scale-95" : "opacity-100 scale-100"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="p-5 pb-4 border-b border-pos-muted/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-pos-accent/10 flex items-center justify-center text-lg">
              📈
            </div>
            <div>
              <h3 className="text-base font-bold text-pos-text">
                Aumentar Precio
              </h3>
              <p className="text-xs text-pos-muted/60">
                {selectedIds.length} producto{selectedIds.length !== 1 ? "s" : ""}{" "}
                seleccionado{selectedIds.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <button
            onClick={closeWithAnim}
            className="w-8 h-8 flex items-center justify-center text-pos-muted/50 hover:text-pos-text rounded-lg hover:bg-pos-background/50 transition-colors touch-target"
          >
            ✕
          </button>
        </div>

        {/* ── Body ── */}
        <div className="p-5 space-y-4">
          {/* Percentage input */}
          <div>
            <label className="block text-xs font-semibold text-pos-muted uppercase tracking-wide mb-1.5">
              Porcentaje de ajuste
            </label>
            <p className="text-[10px] text-pos-muted/50 -mt-0.5 mb-2">
              Usá <strong className="text-pos-text">+10</strong> para aumentar o <strong className="text-pos-text">-10</strong> para descontar
            </p>
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                value={draft}
                autoFocus
                onChange={(e) => {
                  const val = e.target.value;
                  // Solo permitir dígitos, coma, punto, signo menos
                  if (/^-?[\d,.]*$/.test(val) || val === "") {
                    setDraft(val);
                  }
                }}
                onBlur={() => {
                  // Al perder foco, formatear con separador de miles
                  if (draft) {
                    const normalized = draft.replace(",", ".");
                    const n = parseFloat(normalized);
                    if (!isNaN(n)) {
                      setDraft(n.toLocaleString("es-AR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }));
                    }
                  }
                }}
                placeholder="10,00"
                className="w-full border border-pos-muted/30 rounded-xl px-4 py-3 text-2xl text-right font-mono focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target bg-pos-background"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg font-bold text-pos-muted/40">
                %
              </span>
            </div>
          </div>

          {/* Preview */}
          {pct !== 0 && selected.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-pos-muted uppercase tracking-wide mb-2">
                Vista previa — {pct > 0 ? "+" : ""}{pct}% ({selected.length > 5 ? "primeros 5" : "todos"})
              </p>
              <div className="bg-pos-background/50 rounded-xl divide-y divide-pos-muted/10 overflow-hidden">
                {selected.slice(0, 5).map((p) => {
                  const newPrice =
                    Math.round(p.price * (1 + pct / 100) * 100) / 100;
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between px-3 py-2 text-xs"
                    >
                      <span className="text-pos-text truncate flex-1 mr-2">
                        {p.name}
                      </span>
                      <span className="font-mono text-pos-muted line-through mr-2">
                        {formatCurrency(p.price)}
                      </span>
                      <span className="font-mono font-bold text-pos-accent">
                        {formatCurrency(newPrice)}
                      </span>
                    </div>
                  );
                })}
                {selected.length > 5 && (
                  <div className="px-3 py-2 text-xs text-pos-muted/50 italic text-center">
                    ... y {selected.length - 5} producto{selected.length - 5 !== 1 ? "s" : ""} más
                  </div>
                )}
              </div>
            </div>
          )}

          {pct === 0 && selected.length > 0 && (
            <div className="flex items-center gap-2.5 bg-pos-background/50 rounded-xl px-4 py-3 text-xs text-pos-muted">
              <span>💡</span>
              <span>Ingresá un porcentaje para ver la previsualización</span>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="p-5 pt-4 border-t border-pos-muted/10 flex gap-3">
          <button
            onClick={closeWithAnim}
            className="flex-1 px-4 py-2.5 border border-pos-muted/20 text-pos-muted rounded-xl text-sm font-medium touch-target hover:bg-pos-background/50 hover:text-pos-text transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              if (pct > 0) {
                onApply(pct);
                closeWithAnim();
              }
            }}
            disabled={pct <= 0}
            className="flex-1 px-4 py-2.5 bg-pos-accent text-white rounded-xl text-sm font-bold touch-target transition-all hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none"
          >
            Aumentar {pct > 0 ? `${pct}%` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
