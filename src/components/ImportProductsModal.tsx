import { useState, useRef, useEffect } from "react";
import { useActiveStore } from "@/store/context";
import {
  parseFile,
  executeImport,
  type ParsedFile,
  type ColumnMap,
  type ImportResult,
} from "@/lib/product-import";

// ──────────────────────────────────────────────
// Column labels
// ──────────────────────────────────────────────

const FIELD_LABELS: Record<keyof ColumnMap, string> = {
  barcode: "Código de barras",
  name: "Nombre *",
  price: "Precio *",
  costPrice: "Costo",
  stock: "Stock",
  minStock: "Stock mínimo",
  category: "Categoría",
  brand: "Marca",
};

const ALL_FIELDS: (keyof ColumnMap)[] = [
  "barcode",
  "name",
  "price",
  "costPrice",
  "stock",
  "minStock",
  "category",
  "brand",
];

// ──────────────────────────────────────────────
// Props
// ──────────────────────────────────────────────

type ImportProductsModalProps = {
  onClose: () => void;
  onImported: () => void;
};

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export default function ImportProductsModal({
  onClose,
  onImported,
}: ImportProductsModalProps) {
  const { storeId } = useActiveStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"pick" | "map" | "result">("pick");
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [columnMap, setColumnMap] = useState<Partial<ColumnMap>>({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [animOut, setAnimOut] = useState(false);

  // Close on Escape
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

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    setError(null);

    try {
      const p = await parseFile(file);
      setParsed(p);
      setColumnMap(p.suggestedMap);
      setStep("map");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al leer archivo");
    }
  }

  function setMapping(field: keyof ColumnMap, headerKey: string) {
    setColumnMap((prev) => ({ ...prev, [field]: headerKey }));
  }

  function canImport(): boolean {
    if (!columnMap.name || !columnMap.price) return false;
    if (!parsed) return false;
    const headerKeys = Object.keys(parsed.headers);
    return (
      headerKeys.includes(columnMap.name) &&
      headerKeys.includes(columnMap.price)
    );
  }

  async function handleImport() {
    if (!parsed || !canImport()) return;
    setImporting(true);
    setError(null);
    await new Promise((r) => setTimeout(r, 50));

    try {
      const res = await executeImport(
        parsed.rows,
        columnMap as ColumnMap,
        storeId,
      );
      setResult(res);
      setStep("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al importar");
    } finally {
      setImporting(false);
    }
  }

  function handleDone() {
    onImported();
  }

  const headerKeys = parsed ? Object.keys(parsed.headers) : [];
  const headerLabels = parsed
    ? headerKeys.map(
        (k) => parsed.headers[parseInt(k.replace("A", "0"))] ?? k,
      )
    : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={closeWithAnim}
    >
      <div
        className={`w-full max-w-2xl bg-pos-surface rounded-2xl shadow-2xl border border-pos-muted/10 mx-4 max-h-[90vh] flex flex-col transition-all duration-150 ${
          animOut ? "opacity-0 scale-95" : "opacity-100 scale-100"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="p-5 pb-4 border-b border-pos-muted/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-pos-secondary/10 flex items-center justify-center text-lg">
              📥
            </div>
            <div>
              <h3 className="text-base font-bold text-pos-text">
                Importar Productos
              </h3>
              <p className="text-xs text-pos-muted/60">
                Cargá productos desde un archivo
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
        <div className="p-5 overflow-y-auto flex-1">
          {error && (
            <div className="flex items-start gap-2.5 bg-pos-danger/8 border border-pos-danger/25 text-pos-danger text-sm rounded-xl px-4 py-3 mb-4">
              <span className="text-base shrink-0 mt-0.5">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* ── Step 1: Pick file ── */}
          {step === "pick" && (
            <div className="text-center py-6">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-pos-muted/25 rounded-2xl py-14 px-8 cursor-pointer hover:border-pos-secondary/50 hover:bg-pos-secondary/5 transition-all group"
              >
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-pos-background/50 flex items-center justify-center text-4xl group-hover:scale-110 transition-transform">
                  📂
                </div>
                <p className="text-sm font-semibold text-pos-muted group-hover:text-pos-text transition-colors">
                  Hacé clic para seleccionar un archivo
                </p>
                <p className="text-xs text-pos-muted/50 mt-1">
                  Formatos: .xlsx, .xls, .csv
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => handleFile(e.target.files?.[0])}
                className="hidden"
              />

              <div className="mt-6 text-left bg-pos-background/50 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-pos-muted uppercase tracking-wide mb-2">
                  <span>📋</span> Columnas recomendadas
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {["nombre", "precio", "código", "stock", "costo", "categoría", "marca"].map(
                    (col, i) => (
                      <span
                        key={col}
                        className={`text-[11px] font-mono px-2 py-0.5 rounded-full ${
                          i < 2
                            ? "bg-pos-secondary/10 text-pos-secondary"
                            : "bg-pos-background text-pos-muted border border-pos-muted/15"
                        }`}
                      >
                        {col}
                        {i < 2 && " *"}
                      </span>
                    ),
                  )}
                </div>
                <p className="text-xs text-pos-muted/60 italic leading-relaxed">
                  Los nombres de columna se detectan automáticamente. Solo{" "}
                  <span className="font-semibold text-pos-text not-italic">
                    nombre
                  </span>{" "}
                  y{" "}
                  <span className="font-semibold text-pos-text not-italic">
                    precio
                  </span>{" "}
                  son obligatorios.
                </p>
              </div>
            </div>
          )}

          {/* ── Step 2: Column mapping ── */}
          {step === "map" && parsed && (
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 bg-pos-background/50 rounded-xl px-4 py-3">
                <span className="text-lg">📄</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-pos-text truncate">
                    {fileName}
                  </p>
                  <p className="text-xs text-pos-muted/60">
                    {parsed.rows.length} fila
                    {parsed.rows.length !== 1 ? "s" : ""} detectada
                    {parsed.rows.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <button
                  onClick={() => setStep("pick")}
                  className="text-xs px-3 py-1.5 text-pos-secondary hover:bg-pos-secondary/10 rounded-lg touch-target transition-colors"
                >
                  Cambiar archivo
                </button>
              </div>

              {/* Field mapping */}
              <div>
                <p className="text-xs font-semibold text-pos-muted uppercase tracking-wide mb-2.5">
                  Mapeo de columnas
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {ALL_FIELDS.map((field) => (
                    <div key={field}>
                      <label className="block text-xs font-medium text-pos-muted mb-1">
                        {FIELD_LABELS[field]}
                      </label>
                      <select
                        value={columnMap[field] ?? ""}
                        onChange={(e) => setMapping(field, e.target.value)}
                        className="w-full border border-pos-muted/25 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-pos-secondary bg-pos-background"
                      >
                        <option value="">— Ignorar —</option>
                        {headerKeys.map((key, idx) => (
                          <option key={key} value={key}>
                            {headerLabels[idx]} ({key})
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview table */}
              <div>
                <p className="text-xs font-semibold text-pos-muted uppercase tracking-wide mb-2">
                  Vista previa
                </p>
                <div className="overflow-x-auto border border-pos-muted/10 rounded-xl">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-pos-background/50">
                        <th className="text-left px-2.5 py-2 font-medium text-pos-muted whitespace-nowrap w-8 text-pos-muted/40">
                          #
                        </th>
                        {headerKeys.map((key, idx) => (
                          <th
                            key={key}
                            className="text-left px-2.5 py-2 font-medium text-pos-muted whitespace-nowrap"
                          >
                            {headerLabels[idx]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.rows.slice(0, 5).map((row, ri) => (
                        <tr key={ri} className="border-t border-pos-muted/8">
                          <td className="px-2.5 py-1.5 text-pos-muted/40 font-mono text-[10px]">
                            {ri + 1}
                          </td>
                          {headerKeys.map((key) => (
                            <td
                              key={key}
                              className="px-2.5 py-1.5 text-pos-text truncate max-w-[130px]"
                            >
                              {row[key] || <span className="text-pos-muted/40">—</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                      {parsed.rows.length > 5 && (
                        <tr className="border-t border-pos-muted/8">
                          <td
                            colSpan={headerKeys.length + 1}
                            className="px-2.5 py-2 text-center text-xs text-pos-muted/50 italic"
                          >
                            ... y {parsed.rows.length - 5} fila
                            {parsed.rows.length - 5 !== 1 ? "s" : ""} más
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mapping warning */}
              {!canImport() && (
                <div className="flex items-start gap-2.5 bg-pos-accent/10 border border-pos-accent/25 text-pos-accent text-sm rounded-xl px-4 py-3">
                  <span className="text-base shrink-0 mt-0.5">💡</span>
                  <span>
                    Asigná las columnas <strong>Nombre</strong> y{" "}
                    <strong>Precio</strong> para poder importar.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ── Step 3: Result ── */}
          {step === "result" && result && (
            <div className="space-y-4">
              <div
                className={`rounded-xl p-6 text-center border ${
                  result.created > 0
                    ? "bg-pos-success/8 border-pos-success/25"
                    : "bg-pos-accent/10 border-pos-accent/25"
                }`}
              >
                <div className="text-5xl mb-3">
                  {result.created > 0 ? "🎉" : "🤔"}
                </div>
                <p className="text-lg font-bold text-pos-text">
                  {result.created} producto
                  {result.created !== 1 ? "s" : ""} importado
                  {result.created !== 1 ? "s" : ""}
                </p>
                <p className="text-sm text-pos-muted/70 mt-1">
                  {result.skipped > 0
                    ? `${result.skipped} omitido${result.skipped !== 1 ? "s" : ""} — `
                    : ""}
                  de {result.total} fila{result.total !== 1 ? "s" : ""}{" "}
                  procesada{result.total !== 1 ? "s" : ""}
                </p>
              </div>

              {/* Errors */}
              {result.errors.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-pos-danger mb-2">
                    <span>⚠️</span>
                    <span>
                      {result.errors.length} error
                      {result.errors.length !== 1 ? "es" : ""}
                    </span>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1.5">
                    {result.errors.map((err, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 text-xs text-pos-danger bg-pos-danger/5 rounded-lg px-3 py-2"
                      >
                        <span className="shrink-0 font-mono text-pos-muted/60 mt-0.5">
                          #{err.row}
                        </span>
                        <span>{err.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.errors.length === 0 && (
                <div className="flex items-center justify-center gap-2 text-xs text-pos-success/80">
                  <span>✅</span>
                  <span>Sin errores — todas las filas se importaron correctamente</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="p-5 pt-4 border-t border-pos-muted/10 flex items-center justify-between shrink-0">
          {step === "pick" && (
            <button
              onClick={closeWithAnim}
              className="w-full px-4 py-2.5 border border-pos-muted/20 text-pos-muted rounded-xl text-sm font-medium touch-target hover:bg-pos-background/50 hover:text-pos-text transition-colors"
            >
              Cancelar
            </button>
          )}

          {step === "map" && (
            <div className="flex gap-2 w-full">
              <button
                onClick={() => {
                  setStep("pick");
                  setError(null);
                }}
                className="px-4 py-2.5 border border-pos-muted/20 text-pos-muted rounded-xl text-sm font-medium touch-target hover:bg-pos-background/50 hover:text-pos-text transition-colors"
              >
                Volver
              </button>
              <button
                onClick={handleImport}
                disabled={!canImport() || importing}
                className="flex-1 px-4 py-2.5 bg-pos-secondary text-white rounded-xl text-sm font-bold touch-target transition-all hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none"
              >
                {importing
                  ? "Importando…"
                  : `Importar ${parsed ? parsed.rows.length : 0} producto${parsed && parsed.rows.length !== 1 ? "s" : ""}`}
              </button>
            </div>
          )}

          {step === "result" && (
            <button
              onClick={handleDone}
              className="w-full px-4 py-2.5 bg-pos-secondary text-white rounded-xl text-sm font-bold touch-target transition-all hover:shadow-lg"
            >
              Listo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
