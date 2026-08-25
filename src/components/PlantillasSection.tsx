import { useState, useEffect, useRef } from "react";
import { usePlantillasStore } from "@/store/plantillas";
import { renderTemplate, comprobanteToTemplateData, type TemplateData } from "@/lib/render-template";
import { getDefaultTemplate } from "@/lib/default-templates";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

type ViewState = "list" | "editor";

type PlantillaEntry = {
  tipo: string;
  label: string;
  isCustom: boolean;
};

const TIPOS: PlantillaEntry[] = [
  { tipo: "factura", label: "Factura", isCustom: false },
  { tipo: "boleta", label: "Boleta", isCustom: false },
  { tipo: "ticket", label: "Ticket", isCustom: false },
  { tipo: "nota_credito", label: "Nota de Crédito", isCustom: false },
  { tipo: "nota_debito", label: "Nota de Débito", isCustom: false },
];

// ──────────────────────────────────────────────
// Sample data for preview
// ──────────────────────────────────────────────

const SAMPLE_DATA: TemplateData = {
  cliente_nombre: "Juan Pérez",
  cliente_cuit: "20-12345678-9",
  cliente_direccion: "Av. Siempre Viva 742",
  numero: "FAC-0001",
  fecha: "25/06/2026",
  subtotal: "$1,000.00",
  iva: "$210.00",
  total: "$1,210.00",
  tipo_label: "Factura",
  notes: "Gracias por su compra",
  combo_savings: "$100.00",
  bulto_savings: "$50.00",
  items: [
    { product_name: "Producto A", quantity: "2", unit_price: "$250.00", subtotal: "$500.00", combo_name: "Combo A+B", bulto_name: "Bulto: Pack 6x" },
    { product_name: "Producto B", quantity: "1", unit_price: "$500.00", subtotal: "$500.00", combo_name: "Combo A+B", bulto_name: "Bulto: Pack 6x" },
  ],
  company_name: "Mi Empresa S.R.L.",
  company_phone: "(011) 4567-8901",
  company_address: "Av. Corrientes 1234, CABA",
  company_cuit: "30-12345678-9",
  company_email: "contacto@miempresa.com",
  company_web: "www.miempresa.com",
  company_logo_src: "",
};

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export default function PlantillasSection() {
  const [view, setView] = useState<ViewState>("list");
  const [editingTipo, setEditingTipo] = useState<string | null>(null);
  const [customMap, setCustomMap] = useState<Record<string, boolean>>({});

  const getAllPlantillas = usePlantillasStore((s) => s.getAllPlantillas);
  const getPlantilla = usePlantillasStore((s) => s.getPlantilla);

  // Load custom status for all tipos
  useEffect(() => {
    (async () => {
      const entries = await getAllPlantillas("store_1");
      const map: Record<string, boolean> = {};
      for (const e of entries) {
        map[e.tipo] = e.template_html !== null;
      }
      setCustomMap(map);
    })();
  }, [getAllPlantillas]);

  async function handleEdit(tipo: string) {
    setEditingTipo(tipo);
    setView("editor");
  }

  if (view === "list") {
    return (
      <div>
        <h3 className="text-base font-semibold text-pos-text mb-4">Plantillas de Impresión</h3>
        <p className="text-sm text-pos-muted mb-5 max-w-lg">
          Personalizá el formato de cada tipo de comprobante. Usan HTML simple con variables
          <code className="mx-1 px-1.5 py-0.5 rounded bg-pos-muted/10 text-xs font-mono">{`{{variable}}`}</code>
          para los datos del comprobante.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {TIPOS.map((entry) => {
            const isCustom = customMap[entry.tipo] ?? false;
            return (
              <button
                key={entry.tipo}
                onClick={() => handleEdit(entry.tipo)}
                className="card-enter relative flex items-start gap-4 rounded-xl border border-pos-muted/10 bg-pos-surface p-4 shadow-sm active:scale-[0.98] transition-all duration-200 text-left cursor-pointer group overflow-hidden"
              >
                {/* Accent bar */}
                <span className="absolute top-0 left-0 right-0 h-0.5 opacity-80 group-hover:opacity-100 transition-opacity"
                  style={{ backgroundColor: "rgb(var(--color-pos-secondary))" }}
                />

                {/* Icon */}
                <span className="shrink-0 flex items-center justify-center w-11 h-11 rounded-xl bg-pos-secondary/10 text-pos-secondary mt-0.5">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                </span>

                {/* Text */}
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-pos-text mb-0.5">
                    {entry.label}
                  </h3>
                  <p className="text-xs leading-snug">
                    {isCustom ? (
                      <span className="text-emerald-600 font-medium">✓ Customizado</span>
                    ) : (
                      <span className="text-pos-muted">Plantilla por defecto</span>
                    )}
                  </p>
                </div>

                {/* Arrow */}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-pos-muted/40 shrink-0 mt-1.5 group-hover:text-pos-muted/70 transition-colors">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Editor view ──
  return (
    <PlantillaEditor
      tipo={editingTipo!}
      onBack={() => {
        setView("list");
        setEditingTipo(null);
      }}
      onSaved={() => {
        // Refresh custom status
        getAllPlantillas("store_1").then((entries) => {
          const map: Record<string, boolean> = {};
          for (const e of entries) {
            map[e.tipo] = e.template_html !== null;
          }
          setCustomMap(map);
        });
      }}
    />
  );
}

// ──────────────────────────────────────────────
// Editor sub-component
// ──────────────────────────────────────────────

function PlantillaEditor({
  tipo,
  onBack,
  onSaved,
}: {
  tipo: string;
  onBack: () => void;
  onSaved: () => void;
}) {
  const entry = TIPOS.find((t) => t.tipo === tipo)!;
  const upsertPlantilla = usePlantillasStore((s) => s.upsertPlantilla);
  const getPlantilla = usePlantillasStore((s) => s.getPlantilla);

  const [html, setHtml] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showVars, setShowVars] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load saved (or default) on mount
  useEffect(() => {
    (async () => {
      const saved = await getPlantilla(tipo, "store_1");
      setHtml(saved ?? getDefaultTemplate(tipo));
      setDirty(false);
    })();
  }, [tipo, getPlantilla]);

  // Debounced preview
  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      try {
        const rendered = renderTemplate(html, SAMPLE_DATA);
        setPreviewHtml(rendered);
      } catch {
        setPreviewHtml("<p style='color:red'>Error al renderizar la plantilla</p>");
      }
    }, 150);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [html]);

  // Write to iframe when preview changes
  useEffect(() => {
    if (!iframeRef.current) return;
    iframeRef.current.srcdoc = previewHtml;
  }, [previewHtml]);

  async function handleSave() {
    setSaving(true);
    try {
      await upsertPlantilla(tipo, html, "store_1");
      setDirty(false);
      onSaved();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    const confirmed = confirm(`¿Restaurar plantilla por defecto para "${entry.label}"? Se va a perder tu personalización.`);
    if (!confirmed) return;
    setHtml(getDefaultTemplate(tipo));
    setDirty(true);
  }

  const label = entry.label;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-pos-muted hover:text-pos-text transition-colors touch-target"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Volver
          </button>
          <span className="w-px h-5 bg-pos-muted/20" />
          <h3 className="text-base font-semibold text-pos-text">{label}</h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-pos-muted/20 text-pos-muted hover:text-pos-danger hover:border-pos-danger/30 transition-colors touch-target"
          >
            Restaurar Default
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="px-4 py-1.5 text-xs font-medium rounded-lg bg-pos-secondary text-white hover:bg-pos-secondary/90 disabled:opacity-40 touch-target transition-colors"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>

      {/* Editor + Preview */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Left: editor */}
        <div className="flex-1 min-w-0">
          {/* Variable reference */}
          <button
            onClick={() => setShowVars(!showVars)}
            className="flex items-center gap-1.5 text-xs text-pos-secondary mb-2 hover:text-pos-secondary/80 transition-colors touch-target"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              {showVars ? <polyline points="18 15 12 9 6 15" /> : <polyline points="6 9 12 15 18 9" />}
            </svg>
            Variables disponibles
          </button>

          {showVars && (
            <div className="mb-3 p-3 rounded-lg bg-pos-secondary/5 border border-pos-secondary/10 text-xs space-y-1">
              <p className="text-pos-secondary font-semibold mb-1">Variables de comprobante:</p>
              {[
                "cliente_nombre", "cliente_cuit", "cliente_direccion",
                "numero", "fecha", "subtotal", "iva", "total", "tipo_label", "notes",
              ].map((v) => (
                <code key={v} className="inline-block mr-2 px-1.5 py-0.5 rounded bg-pos-secondary/10 text-pos-secondary font-mono text-[11px]">
                  {`{{${v}}}`}
                </code>
              ))}
              <p className="text-pos-secondary font-semibold mt-2 mb-1">Bloque de items:</p>
              <code className="inline-block px-1.5 py-0.5 rounded bg-pos-secondary/10 text-pos-secondary font-mono text-[11px]">
                {`{{#items}}...{{/items}}`}
              </code>
              <p className="text-pos-secondary/70 mt-1">Variables disponibles dentro del bloque:</p>
              {["product_name", "quantity", "unit_price", "subtotal", "combo_name", "bulto_name"].map((v) => (
                <code key={v} className="inline-block mr-2 px-1.5 py-0.5 rounded bg-pos-secondary/10 text-pos-secondary font-mono text-[11px]">
                  {`{{${v}}}`}
                </code>
              ))}
            </div>
          )}

          {/* Code editor */}
          <textarea
            value={html}
            onChange={(e) => {
              setHtml(e.target.value);
              setDirty(true);
            }}
            className="w-full h-[320px] lg:h-[420px] font-mono text-xs leading-relaxed p-3 rounded-xl border border-pos-muted/20 bg-pos-background text-pos-text resize-none focus:outline-none focus:ring-2 focus:ring-pos-secondary/30 focus:border-pos-secondary/50"
            spellCheck={false}
            placeholder="<html>..."
          />
        </div>

        {/* Right: preview */}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-pos-muted mb-2">Vista previa (con datos de muestra):</p>
          <div className="rounded-xl border border-pos-muted/10 bg-white overflow-hidden">
            <iframe
              ref={iframeRef}
              title="Vista previa de la plantilla"
              className="w-full h-[360px] lg:h-[460px]"
              sandbox="allow-same-origin"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
