import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useAppStore, useAuthStore, useAdminStore } from "@/store";
import { useCombosStore, useProductsStore } from "@/store";
import { usePriceListsStore, type PriceListItem } from "@/store/price-lists";
import { useBultosStore } from "@/store/bultos";
import BrandList from "@/components/BrandList";
import CategoryList from "@/components/CategoryList";
import BulkPriceModal from "@/components/BulkPriceModal";
import PlantillasSection from "@/components/PlantillasSection";
import PurchaseInvoicesSection from "@/components/PurchaseInvoicesSection";
import CompanySettings from "@/components/CompanySettings";
import AfipSection from "@/components/AfipSection";
import ThemeToggle from "@/components/ThemeToggle";
import { exportBackup, importBackup } from "@/lib/backup";
import { runSeeder } from "@/lib/seeder";
import { useActiveStore } from "@/store/context";

// ──────────────────────────────────────────────
// Admin section definitions
// ──────────────────────────────────────────────

type SectionId = "categories" | "brands" | "bulk-price" | "backup" | "settings" | "plantillas" | "empresa" | "combos" | "bultos" | "price-lists" | "purchase-invoices" | "afip";

type SectionDef = {
  id: SectionId;
  label: string;
  description: string;
  icon: React.ReactNode;
};

function CategoriesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
      <path d="M4 4h6v6H4z" />
      <path d="M14 4h6v6h-6z" />
      <path d="M4 14h6v6H4z" />
      <path d="M14 14h6v6h-6z" />
    </svg>
  );
}

function BrandsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
      <path d="M9 5H2v7l6.29 6.29a1 1 0 0 0 1.42 0l5.58-5.58a1 1 0 0 0 0-1.42L9 5z" />
      <circle cx="5.5" cy="6.5" r="1.5" fill="currentColor" opacity="0.3" />
      <path d="M16 5h6v6" />
      <path d="M19 2l-5 5" />
    </svg>
  );
}

function BulkPriceIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
      <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      <circle cx="17" cy="17" r="4" fill="currentColor" opacity="0.15" />
    </svg>
  );
}

function BackupIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
      <circle cx="12" cy="16" r="1.5" fill="currentColor" opacity="0.3" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function PlantillasIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function CompanyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <line x1="6.5" y1="6.5" x2="6.5" y2="6.5" strokeWidth={3} />
      <line x1="17.5" y1="6.5" x2="17.5" y2="6.5" strokeWidth={3} />
    </svg>
  );
}

function CombosIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}

function BultosIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

function PriceListsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
      <path d="M9 5H2v7l6.29 6.29a1 1 0 0 0 1.42 0l5.58-5.58a1 1 0 0 0 0-1.42L9 5z" />
      <circle cx="5.5" cy="6.5" r="1.5" fill="currentColor" opacity="0.3" />
      <path d="M20 4h-3V2" />
      <path d="M20 4v3" />
      <path d="M20 4l-5 5" />
    </svg>
  );
}

function PurchaseInvoicesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
      <path d="M9 13l6 0" />
      <path d="M9 17l4 0" />
    </svg>
  );
}

function AfipIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
      <path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5l8-3z" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  );
}

const SECTIONS: SectionDef[] = [
  {
    id: "categories",
    label: "Categorías",
    description: "gestioná tus categorías de productos",
    icon: <CategoriesIcon />,
  },
  {
    id: "brands",
    label: "Marcas",
    description: "gestioná tus marcas de productos",
    icon: <BrandsIcon />,
  },
  {
    id: "bulk-price",
    label: "Precio Masivo",
    description: "aplicá aumentos a múltiples productos",
    icon: <BulkPriceIcon />,
  },
  {
    id: "backup",
    label: "Respaldos",
    description: "exportá o restaurá tus datos",
    icon: <BackupIcon />,
  },
  {
    id: "settings",
    label: "Configuración",
    description: "tema, usuarios y preferencias",
    icon: <SettingsIcon />,
  },
  {
    id: "plantillas",
    label: "Plantillas",
    description: "personalizá el formato de impresión",
    icon: <PlantillasIcon />,
  },
  {
    id: "empresa",
    label: "Empresa",
    description: "datos de tu empresa para comprobantes",
    icon: <CompanyIcon />,
  },
  {
    id: "combos",
    label: "Combos",
    description: "creá combos con precio especial",
    icon: <CombosIcon />,
  },
  {
    id: "bultos",
    label: "Bultos",
    description: "creá bultos de productos con precio especial",
    icon: <BultosIcon />,
  },
  {
    id: "price-lists",
    label: "Listas de Precio",
    description: "gestioná hasta 10 listas con porcentaje de ajuste",
    icon: <PriceListsIcon />,
  },
  {
    id: "purchase-invoices",
    label: "Facturas de Compra",
    description: "cargá compras a proveedores y sumá stock",
    icon: <PurchaseInvoicesIcon />,
  },
  {
    id: "afip",
    label: "AFIP",
    description: "facturá con CAE ante AFIP",
    icon: <AfipIcon />,
  },
];

// ──────────────────────────────────────────────
// Color accents per section
// ──────────────────────────────────────────────

// Single accent for every section: neutral surface + pos-secondary.
const NEUTRAL_ACCENT = {
  bg: "bg-pos-secondary/10 dark:bg-pos-secondary/15",
  text: "text-pos-secondary",
  bar: "rgb(var(--color-pos-secondary))",
};

const ACCENTS: Record<string, { bg: string; text: string; bar: string }> = {
  categories:          NEUTRAL_ACCENT,
  brands:              NEUTRAL_ACCENT,
  "bulk-price":        NEUTRAL_ACCENT,
  backup:              NEUTRAL_ACCENT,
  settings:            NEUTRAL_ACCENT,
  plantillas:          NEUTRAL_ACCENT,
  empresa:             NEUTRAL_ACCENT,
  combos:              NEUTRAL_ACCENT,
  bultos:              NEUTRAL_ACCENT,
  "price-lists":       NEUTRAL_ACCENT,
  "purchase-invoices": NEUTRAL_ACCENT,
  afip:                NEUTRAL_ACCENT,
};

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export default function AdminPage() {
  const [activeSection, setActiveSection] = useState<SectionId | null>(null);

  // Escape goes back to root admin
  useEffect(() => {
    if (!activeSection) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setActiveSection(null);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [activeSection]);

  // Show card grid
  if (!activeSection) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-pos-text mb-1">
          Administración
        </h2>
        <p className="text-sm text-pos-muted mb-5">
          seleccioná una sección para configurar
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
          {SECTIONS.map((sec, i) => {
            const accent = ACCENTS[sec.id];
            return (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id)}
                className="card-enter relative flex items-start gap-4 rounded-xl border border-pos-muted/10 bg-pos-surface p-4 md:p-5 shadow-sm active:scale-[0.98] transition-all duration-200 text-left cursor-pointer group overflow-hidden dark:border-gray-600/30 dark:bg-gray-800"
                style={{ animationDelay: `${i * 0.06}s` }}
              >
                {/* Accent bar */}
                <span
                  className="absolute top-0 left-0 right-0 h-0.5 opacity-80 group-hover:opacity-100 transition-opacity"
                  style={{ backgroundColor: accent.bar }}
                />

                {/* Icon */}
                <span className={`shrink-0 flex items-center justify-center w-11 h-11 md:w-12 md:h-12 rounded-xl ${accent.bg} ${accent.text} mt-0.5`}>
                  {sec.icon}
                </span>

                {/* Text */}
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-pos-text mb-0.5">
                    {sec.label}
                  </h3>
                  <p className="text-xs text-pos-muted/80 leading-snug">
                    {sec.description}
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

  // Show section detail with back button
  return (
    <div>
      {/* Breadcrumb */}
      <button
        onClick={() => setActiveSection(null)}
        className="flex items-center gap-1.5 text-sm text-pos-muted hover:text-pos-text transition-colors mb-4 touch-target"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Volver
      </button>

      {/* Section title */}
      {activeSection === "categories" && <CategoriesSection />}
      {activeSection === "brands" && <BrandsSection />}
      {activeSection === "bulk-price" && <BulkPriceSection />}
      {activeSection === "backup" && <BackupSection />}
      {activeSection === "settings" && <SettingsSection />}
      {activeSection === "plantillas" && <PlantillasSection />}
      {activeSection === "empresa" && <CompanySection />}
      {activeSection === "combos" && <CombosSection />}
      {activeSection === "bultos" && <BultosSection />}
      {activeSection === "price-lists" && <PriceListsSection />}
      {activeSection === "purchase-invoices" && <PurchaseInvoicesSection />}
      {activeSection === "afip" && <AfipSection />}
    </div>
  );
}

// ──────────────────────────────────────────────
// Section detail components
// ──────────────────────────────────────────────

function CategoriesSection() {
  return (
    <div>
      <h3 className="text-base font-semibold text-pos-text mb-4">Categorías</h3>
      <div className="max-w-2xl">
        <CategoryList />
      </div>
    </div>
  );
}

function BultosSection() {
  const { storeId } = useActiveStore();
  const bultos = useBultosStore((s) => s.bultos);
  const products = useProductsStore((s) => s.products);
  const addBulto = useBultosStore((s) => s.addBulto);
  const updateBulto = useBultosStore((s) => s.updateBulto);
  const deleteBulto = useBultosStore((s) => s.deleteBulto);
  const loadBultos = useBultosStore((s) => s.loadBultos);
  const showNotification = useAppStore((s) => s.showNotification);

  const bultosLoadedRef = useRef(false);
  useEffect(() => {
    if (bultosLoadedRef.current) return;
    bultosLoadedRef.current = true;
    loadBultos(storeId).catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [bultoPrice, setBultoPrice] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [productSearch, setProductSearch] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  function resetForm() {
    setEditingId(null);
    setName("");
    setBultoPrice("");
    setSelectedProductId(null);
    setQuantity("1");
    setProductSearch("");
  }

  function startEdit(bulto: typeof bultos[0]) {
    setEditingId(bulto.id);
    setName(bulto.name);
    setBultoPrice(String(bulto.bultoPrice));
    setSelectedProductId(bulto.productId);
    setQuantity(String(bulto.quantity));
    setProductSearch("");
  }

  function handleSave() {
    if (!name.trim()) { showNotification("El bulto debe tener un nombre"); return; }
    if (selectedProductId == null) { showNotification("Debés seleccionar un producto"); return; }
    const qty = parseInt(quantity) || 0;
    if (qty < 1) { showNotification("La cantidad debe ser mayor a 0"); return; }
    const price = parseFloat(bultoPrice) || 0;
    if (price <= 0) { showNotification("El precio del bulto debe ser mayor a 0"); return; }

    if (editingId != null) {
      updateBulto(editingId, { name: name.trim(), productId: selectedProductId, quantity: qty, bultoPrice: price });
      showNotification("Bulto actualizado");
    } else {
      addBulto({ name: name.trim(), productId: selectedProductId, quantity: qty, bultoPrice: price, storeId });
      showNotification("Bulto creado");
    }
    resetForm();
  }

  function handleDelete(id: number) {
    if (!confirm("¿Eliminar este bulto?")) return;
    deleteBulto(id);
    if (editingId === id) resetForm();
    showNotification("Bulto eliminado");
  }

  const storeProducts = products.filter((p) => p.store_id === storeId);
  const storeBultos = bultos.filter((b) => b.storeId === storeId);
  const q = productSearch.toLowerCase();
  const filteredProducts = storeProducts.filter((p) => !q || p.name.toLowerCase().includes(q));

  useEffect(() => {
    setHighlightIndex(0);
  }, [productSearch]);

  useEffect(() => {
    const el = listRef.current?.children[highlightIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [highlightIndex]);

  const selectedProduct = selectedProductId != null ? products.find((p) => p.id === selectedProductId) : null;

  return (
    <div>
      <h3 className="text-base font-semibold text-pos-text mb-4">Bultos</h3>
      <div className="max-w-2xl space-y-6">
        {/* Bulto list */}
        <div className="space-y-2">
          {storeBultos.length === 0 && (
            <p className="text-sm text-pos-muted">No hay bultos creados todavía.</p>
          )}
          {storeBultos.map((bulto) => (
            <div
              key={bulto.id}
              className="rounded-xl border border-pos-muted/10 bg-pos-surface p-4 dark:border-gray-600/30 dark:bg-gray-800"
            >
              {(() => {
                const prod = products.find((p) => p.id === bulto.productId);
                const regularTotal = (prod?.price ?? 0) * bulto.quantity;
                const savings = regularTotal - bulto.bultoPrice;
                return (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-pos-text">{bulto.name}</h4>
                        <div className="flex items-baseline gap-2 mt-0.5">
                          <span className="text-sm font-bold text-pos-text">${bulto.bultoPrice.toFixed(2)}</span>
                          {regularTotal > 0 && (
                            <>
                              <span className="text-xs text-pos-muted line-through">${regularTotal.toFixed(2)}</span>
                              <span className="text-xs font-medium text-green-600 dark:text-green-400">-${savings.toFixed(2)}</span>
                            </>
                          )}
                        </div>
                        <p className="text-xs text-pos-muted mt-1">
                          {bulto.quantity}× {prod?.name ?? `#${bulto.productId}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => startEdit(bulto)}
                          className="text-xs px-3 py-1.5 rounded-lg border border-pos-muted/20 text-pos-text touch-target hover:bg-pos-background"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(bulto.id)}
                          className="text-xs px-3 py-1.5 rounded-lg text-pos-danger touch-target hover:bg-pos-danger/10"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          ))}
        </div>

        {/* Create/Edit form */}
        <div className="rounded-xl border border-pos-muted/10 bg-pos-surface p-4 dark:border-gray-600/30 dark:bg-gray-800">
          <h4 className="text-sm font-semibold text-pos-text mb-3">
            {editingId != null ? "Editar Bulto" : "Nuevo Bulto"}
          </h4>
          <div className="space-y-3">
            {/* Selected product chip */}
            {selectedProduct && (
              <div className="flex flex-wrap gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-md bg-pos-secondary/10 px-2 py-0.5 text-xs font-medium text-pos-secondary dark:bg-pos-secondary/20">
                  {selectedProduct.name}
                  <button
                    onClick={() => setSelectedProductId(null)}
                    className="ml-0.5 hover:text-pos-danger transition-colors"
                  >
                    ✕
                  </button>
                </span>
              </div>
            )}

            {/* Product selector (radio style — single select) */}
            <div>
              <p className="text-xs font-medium text-pos-muted mb-2">Producto</p>
              <input
                type="text"
                value={productSearch}
                onChange={(e) => { setProductSearch(e.target.value); }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setHighlightIndex((i) => Math.min(i + 1, filteredProducts.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setHighlightIndex((i) => Math.max(i - 1, 0));
                  } else if (e.key === "Enter" && filteredProducts[highlightIndex]) {
                    e.preventDefault();
                    setSelectedProductId(filteredProducts[highlightIndex].id);
                  }
                }}
                placeholder="Buscá un producto…"
                className="w-full mb-2 border border-pos-muted/30 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary bg-pos-surface"
                autoFocus
              />
              <div ref={listRef} className="max-h-48 overflow-y-auto space-y-1">
                {filteredProducts.length === 0 && storeProducts.length > 0 && (
                  <p className="text-xs text-pos-muted text-center py-4">Sin resultados</p>
                )}
                {filteredProducts.map((p, idx) => {
                  const checked = selectedProductId === p.id;
                  const highlighted = idx === highlightIndex;
                  return (
                    <label
                      key={p.id}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                        highlighted
                          ? "bg-pos-secondary/10 ring-1 ring-pos-secondary/30"
                          : "hover:bg-pos-background"
                      }`}
                      onMouseEnter={() => setHighlightIndex(idx)}
                    >
                      <input
                        type="radio"
                        name="bulto-product"
                        checked={checked}
                        onChange={() => setSelectedProductId(p.id)}
                        className="accent-pos-secondary"
                      />
                      <span className="text-sm text-pos-text flex-1">{p.name}</span>
                      <span className="text-xs text-pos-muted font-mono w-16 text-right">
                        ${p.price.toFixed(2)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Quantity input */}
            <input
              type="text"
              inputMode="numeric"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Cantidad de unidades en el bulto"
              className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary bg-pos-surface"
            />

            {/* Name & price */}
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre del bulto (ej: Pack Coca-Cola 6x500ml)"
              className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary bg-pos-surface"
            />
            <input
              type="text"
              inputMode="decimal"
              value={bultoPrice}
              onChange={(e) => setBultoPrice(e.target.value)}
              placeholder="Precio del bulto"
              className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary bg-pos-surface"
            />

            <div className="flex items-center gap-2">
              <button
                onClick={handleSave}
                disabled={selectedProductId == null}
                className="px-4 py-2 bg-pos-secondary text-white rounded-lg text-sm font-medium touch-target hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                {editingId != null ? "Guardar Cambios" : "Crear Bulto"}
              </button>
              {editingId != null && (
                <button
                  onClick={resetForm}
                  className="px-4 py-2 border border-pos-muted/30 text-pos-text rounded-lg text-sm touch-target hover:bg-pos-background"
                >
                  Cancelar
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BrandsSection() {
  return (
    <div>
      <h3 className="text-base font-semibold text-pos-text mb-4">Marcas</h3>
      <div className="max-w-2xl">
        <BrandList />
      </div>
    </div>
  );
}

function BulkPriceSection() {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center dark:text-gray-100">
      <svg
        className="w-16 h-16 text-pos-muted/40 mb-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
        />
      </svg>
      <h3 className="text-lg font-medium text-pos-text mb-1">
        Aumento de Precio Masivo
      </h3>
      <p className="text-sm text-pos-muted/70 max-w-sm mb-6">
        Aplicá aumentos porcentuales a múltiples productos de una sola vez.
        Filtralos por categoría, marca o aplicá a todos.
      </p>
      <button
        onClick={() => setShowModal(true)}
        className="px-6 py-2.5 bg-pos-secondary text-white rounded-lg font-medium text-sm touch-target hover:opacity-90 transition-opacity"
      >
        Iniciar Aumento Masivo
      </button>

      {showModal && <BulkPriceModal onClose={() => setShowModal(false)} />}
    </div>
  );
}

function BackupSection() {
  const showNotification = useAppStore((s) => s.showNotification);
  const { storeId } = useActiveStore();
  const [restoring, setRestoring] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleExport() {
    setExporting(true);
    try {
      await exportBackup(storeId);
      showNotification("Respaldo descargado correctamente");
    } catch (err) {
      showNotification(err instanceof Error ? err.message : "Error al generar el respaldo");
    } finally {
      setExporting(false);
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm("Se van a reemplazar TODOS los datos de la tienda actual con los del respaldo. Esto no se puede deshacer.")) {
      e.target.value = "";
      return;
    }

    setRestoring(true);
    try {
      const result = await importBackup(storeId, file);
      const detalle = Object.entries(result.counts)
        .map(([tabla, n]) => `${tabla}: ${n}`)
        .join(", ");
      showNotification(`Respaldo restaurado — ${result.tables_restored} tablas (${detalle}) — recargando...`);
      // Force full reload so all stores re-read from the fresh DB data
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      showNotification(err instanceof Error ? err.message : "Error al restaurar el respaldo");
      setRestoring(false);
      e.target.value = "";
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <h3 className="text-base font-semibold text-pos-text mb-4">Respaldos</h3>
      <p className="text-sm text-pos-muted">
        Exportá una copia de seguridad o restaurá datos desde un archivo .json.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-pos-muted/10 bg-pos-surface p-5 dark:border-gray-600/30 dark:bg-gray-800">
          <h4 className="text-sm font-semibold text-pos-text mb-1">Exportar</h4>
          <p className="text-xs text-pos-muted mb-4">
            Descargá un .json con todos los datos.
          </p>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="w-full px-4 py-2 bg-pos-secondary text-white rounded-lg text-sm font-medium touch-target hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {exporting ? "Exportando…" : "Descargar Respaldo"}
          </button>
        </div>

        <div className="rounded-xl border border-pos-muted/10 bg-pos-surface p-5 dark:border-gray-600/30 dark:bg-gray-800">
          <h4 className="text-sm font-semibold text-pos-text mb-1">Restaurar</h4>
          <p className="text-xs text-pos-muted mb-4">
            Reemplazá todos los datos actuales.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={restoring}
            className="w-full px-4 py-2 bg-pos-danger text-white rounded-lg text-sm font-medium touch-target hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {restoring ? "Restaurando…" : "Restaurar Respaldo"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsSection() {
  const setPage = useAppStore((s) => s.setPage);
  const showNotification = useAppStore((s) => s.showNotification);
  const currentUser = useAuthStore((s) => s.currentUser);
  const [seeding, setSeeding] = useState(false);

  async function handleSeeder() {
    const confirmed = confirm(
      "Datos de prueba\n\nSe van a crear:\n" +
      "• 20 categorías\n• 10 marcas\n• 500 productos genéricos\n\n" +
      "No se elimina ningún dato existente. ¿Querés continuar?",
    );
    if (!confirmed) return;

    setSeeding(true);
    try {
      await runSeeder();
      showNotification("Seeder completado. Recargando…");
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      showNotification(err instanceof Error ? err.message : "Error en seeder");
      setSeeding(false);
    }
  }

  return (
    <div>
      <h3 className="text-base font-semibold text-pos-text mb-4">Configuración</h3>
      <div className="max-w-md space-y-4">
        {/* User info */}
        <div className="rounded-xl border border-pos-muted/10 bg-pos-surface p-4 dark:border-gray-600/30 dark:bg-gray-800">
          <h4 className="text-xs font-semibold text-pos-muted uppercase tracking-wider mb-3">
            Usuario
          </h4>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-pos-secondary/15 flex items-center justify-center text-pos-secondary text-sm font-semibold">
                {currentUser?.name?.charAt(0).toUpperCase() ?? "?"}
              </div>
              <div>
                <span className="text-sm font-medium text-pos-text block">
                  {currentUser?.name ?? "—"}
                </span>
                <span className="text-xs text-pos-muted">
                  {currentUser?.role === "admin" ? "Administrador" : "Personalizado"}
                </span>
              </div>
            </div>
            <button
              onClick={() => setPage("user-management")}
              className="text-xs px-3 py-1.5 bg-pos-secondary text-white rounded-lg font-medium touch-target hover:opacity-90 transition-opacity"
            >
              Gestionar
            </button>
          </div>
        </div>

        {/* Theme */}
        <div className="rounded-xl border border-pos-muted/10 bg-pos-surface p-4 dark:border-gray-600/30 dark:bg-gray-800">
          <h4 className="text-xs font-semibold text-pos-muted uppercase tracking-wider mb-3">
            Tema
          </h4>
          <ThemeToggle />
        </div>

        {/* Test data seeder */}
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
          <h4 className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-1 dark:text-amber-400">
            Datos de prueba
          </h4>
          <p className="text-xs text-pos-muted mb-3">
            Crea 20 categorías, 10 marcas y 500 productos de prueba vía la API. No elimina datos existentes.
          </p>
          <button
            onClick={handleSeeder}
            disabled={seeding}
            className="w-full px-4 py-2 text-sm font-medium rounded-lg border border-amber-500/30 text-amber-700 bg-amber-500/10 touch-target hover:bg-amber-500/20 disabled:opacity-50 transition-opacity dark:text-amber-300 dark:border-amber-500/40 dark:bg-amber-500/15 dark:hover:bg-amber-500/25"
          >
            {seeding ? "Generando datos…" : "Generar datos de prueba"}
          </button>
        </div>

        {/* Release info */}
        <ReleaseInfo />
      </div>
    </div>
  );
}

function ReleaseInfo() {
  const buildDate = new Date(__BUILD_TIME__);
  const formattedDate = buildDate.toLocaleDateString("es-AR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="rounded-xl border border-pos-muted/10 bg-pos-surface p-4 dark:border-gray-600/30 dark:bg-gray-800">
      <h4 className="text-xs font-semibold text-pos-muted uppercase tracking-wider mb-3">
        Release
      </h4>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-pos-muted">Versión</span>
          <span className="text-sm font-semibold text-pos-text font-mono">
            v{__APP_VERSION__}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-pos-muted">Actualizado</span>
          <span className="text-sm text-pos-text">{formattedDate}</span>
        </div>
      </div>
    </div>
  );
}

function CompanySection() {
  return (
    <div>
      <h3 className="text-base font-semibold text-pos-text mb-4">Empresa</h3>
      <CompanySettings />
    </div>
  );
}

function CombosSection() {
  const { storeId } = useActiveStore();
  const combos = useCombosStore((s) => s.combos);
  const products = useProductsStore((s) => s.products);
  const addCombo = useCombosStore((s) => s.addCombo);
  const updateCombo = useCombosStore((s) => s.updateCombo);
  const deleteCombo = useCombosStore((s) => s.deleteCombo);
  const loadCombos = useCombosStore((s) => s.loadCombos);
  const showNotification = useAppStore((s) => s.showNotification);

  const combosLoadedRef = useRef(false);
  useEffect(() => {
    if (combosLoadedRef.current) return;
    combosLoadedRef.current = true;
    loadCombos(storeId).catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [comboPrice, setComboPrice] = useState("");
  const [selectedItems, setSelectedItems] = useState<{ productId: number; quantity: number }[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  function resetForm() {
    setEditingId(null);
    setName("");
    setComboPrice("");
    setSelectedItems([]);
    setProductSearch("");
  }

  function startEdit(combo: typeof combos[0]) {
    setEditingId(combo.id);
    setName(combo.name);
    setComboPrice(String(combo.comboPrice));
    setSelectedItems(combo.items.map((i) => ({ ...i })));
    setProductSearch("");
  }

  function toggleProduct(productId: number) {
    setSelectedItems((prev) => {
      const exists = prev.find((i) => i.productId === productId);
      if (exists) return prev.filter((i) => i.productId !== productId);
      return [...prev, { productId, quantity: 1 }];
    });
  }

  function updateQty(productId: number, quantity: number) {
    setSelectedItems((prev) =>
      prev.map((i) => (i.productId === productId ? { ...i, quantity: Math.max(0, quantity) } : i)),
    );
  }

  function handleSave() {
    if (!name.trim()) { showNotification("El combo debe tener un nombre"); return; }
    if (selectedItems.length === 0) { showNotification("El combo debe tener al menos un producto"); return; }
    if (selectedItems.some((i) => i.quantity < 1)) { showNotification("Todos los productos deben tener cantidad mayor a 0"); return; }
    const price = parseFloat(comboPrice) || 0;
    if (price <= 0) { showNotification("El precio del combo debe ser mayor a 0"); return; }

    if (editingId != null) {
      updateCombo(editingId, { name: name.trim(), comboPrice: price, items: selectedItems });
      showNotification("Combo actualizado");
    } else {
      addCombo({ name: name.trim(), comboPrice: price, items: selectedItems, storeId });
      showNotification("Combo creado");
    }
    resetForm();
  }

  function handleDelete(id: number) {
    if (!confirm("¿Eliminar este combo?")) return;
    deleteCombo(id);
    if (editingId === id) resetForm();
    showNotification("Combo eliminado");
  }

  const storeProducts = products.filter((p) => p.store_id === storeId);
  const storeCombos = combos.filter((c) => c.storeId === storeId);
  const q = productSearch.toLowerCase();
  const filteredProducts = storeProducts.filter((p) => !q || p.name.toLowerCase().includes(q));

  // Reset highlight to first result when search changes
  useEffect(() => {
    setHighlightIndex(0);
  }, [productSearch]);

  // Scroll highlighted item into view
  useEffect(() => {
    const el = listRef.current?.children[highlightIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [highlightIndex]);

  return (
    <div>
      <h3 className="text-base font-semibold text-pos-text mb-4">Combos</h3>
      <div className="max-w-2xl space-y-6">
        {/* Combo list */}
        <div className="space-y-2">
          {storeCombos.length === 0 && (
            <p className="text-sm text-pos-muted">No hay combos creados todavía.</p>
          )}
          {storeCombos.map((combo) => (
            <div
              key={combo.id}
              className="rounded-xl border border-pos-muted/10 bg-pos-surface p-4 dark:border-gray-600/30 dark:bg-gray-800"
            >
              {(() => {
                const regularTotal = combo.items.reduce((sum, item) => {
                  const prod = products.find((p) => p.id === item.productId);
                  return sum + (prod?.price ?? 0) * item.quantity;
                }, 0);
                const savings = regularTotal - combo.comboPrice;
                return (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-pos-text">{combo.name}</h4>
                        <div className="flex items-baseline gap-2 mt-0.5">
                          <span className="text-sm font-bold text-pos-text">${combo.comboPrice.toFixed(2)}</span>
                          {regularTotal > 0 && (
                            <>
                              <span className="text-xs text-pos-muted line-through">${regularTotal.toFixed(2)}</span>
                              <span className="text-xs font-medium text-green-600 dark:text-green-400">-${savings.toFixed(2)}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => startEdit(combo)}
                          className="text-xs px-3 py-1.5 rounded-lg border border-pos-muted/20 text-pos-text touch-target hover:bg-pos-background"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(combo.id)}
                          className="text-xs px-3 py-1.5 rounded-lg text-pos-danger touch-target hover:bg-pos-danger/10"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                    {combo.items.length > 0 && (
                      <div className="overflow-x-auto mt-2">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-pos-muted/60 border-b border-pos-muted/10">
                            <th className="text-left font-medium py-1 pr-2">Producto</th>
                            <th className="text-right font-medium py-1 px-2">Cant</th>
                            <th className="text-right font-medium py-1 pl-2">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {combo.items.map((item) => {
                            const prod = products.find((p) => p.id === item.productId);
                            const lineTotal = (prod?.price ?? 0) * item.quantity;
                            return (
                              <tr key={item.productId} className="border-b border-pos-muted/5 last:border-0">
                                <td className="py-1 pr-2 text-pos-muted">{prod?.name ?? `#${item.productId}`}</td>
                                <td className="py-1 px-2 text-right font-mono text-pos-muted">{item.quantity}</td>
                                <td className="py-1 pl-2 text-right font-mono text-pos-muted">${lineTotal.toFixed(2)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          ))}
        </div>

        {/* Create/Edit form */}
        <div className="rounded-xl border border-pos-muted/10 bg-pos-surface p-4 dark:border-gray-600/30 dark:bg-gray-800">
          <h4 className="text-sm font-semibold text-pos-text mb-3">
            {editingId != null ? "Editar Combo" : "Nuevo Combo"}
          </h4>
          <div className="space-y-3">
            {/* Selected products chips */}
            {selectedItems.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedItems.map((item) => {
                  const prod = products.find((p) => p.id === item.productId);
                  return (
                    <span
                      key={item.productId}
                      className="inline-flex items-center gap-1 rounded-md bg-pos-secondary/10 px-2 py-0.5 text-xs font-medium text-pos-secondary dark:bg-pos-secondary/20"
                    >
                      {prod?.name ?? `#${item.productId}`}
                      {item.quantity > 1 && <span className="font-mono text-[10px] opacity-60">×{item.quantity}</span>}
                      <button
                        onClick={() => toggleProduct(item.productId)}
                        className="ml-0.5 hover:text-pos-danger transition-colors"
                      >
                        ✕
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Product selector */}
            <div>
              <p className="text-xs font-medium text-pos-muted mb-2">Productos</p>
              <input
                type="text"
                value={productSearch}
                onChange={(e) => { setProductSearch(e.target.value); }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setHighlightIndex((i) => Math.min(i + 1, filteredProducts.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setHighlightIndex((i) => Math.max(i - 1, 0));
                  } else if (e.key === "Enter" && filteredProducts[highlightIndex]) {
                    e.preventDefault();
                    toggleProduct(filteredProducts[highlightIndex].id);
                  }
                }}
                placeholder="Buscá y seleccioná productos…"
                className="w-full mb-2 border border-pos-muted/30 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary bg-pos-surface"
                autoFocus
              />
              <div ref={listRef} className="max-h-48 overflow-y-auto space-y-1">
                {filteredProducts.length === 0 && storeProducts.length > 0 && (
                  <p className="text-xs text-pos-muted text-center py-4">Sin resultados</p>
                )}
                {filteredProducts.map((p, idx) => {
                  const selected = selectedItems.find((i) => i.productId === p.id);
                  const highlighted = idx === highlightIndex;
                  return (
                    <label
                      key={p.id}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                        highlighted
                          ? "bg-pos-secondary/10 ring-1 ring-pos-secondary/30"
                          : "hover:bg-pos-background"
                      }`}
                      onMouseEnter={() => setHighlightIndex(idx)}
                    >
                      <input
                        type="checkbox"
                        checked={!!selected}
                        onChange={() => toggleProduct(p.id)}
                        className="rounded accent-pos-secondary"
                      />
                      <span className="text-sm text-pos-text flex-1">{p.name}</span>
                      {selected && (
                        <input
                          type="text"
                          inputMode="numeric"
                          value={selected.quantity || ""}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (raw === "") { updateQty(p.id, 0); return; }
                            const parsed = parseInt(raw);
                            if (!isNaN(parsed)) updateQty(p.id, parsed);
                          }}
                          className="w-12 border border-pos-muted/30 rounded px-2 py-0.5 text-xs text-right font-mono focus:outline-none focus:ring-1 focus:ring-pos-secondary bg-pos-surface"
                        />
                      )}
                      <span className="text-xs text-pos-muted font-mono w-16 text-right">
                        ${p.price.toFixed(2)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Name & price — below products */}
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre del combo"
              className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary bg-pos-surface"
            />
            <input
              type="text"
              inputMode="decimal"
              value={comboPrice}
              onChange={(e) => setComboPrice(e.target.value)}
              placeholder="Precio del combo"
              className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary bg-pos-surface"
            />

            <div className="flex items-center gap-2">
              <button
                onClick={handleSave}
                disabled={selectedItems.length === 0}
                className="px-4 py-2 bg-pos-secondary text-white rounded-lg text-sm font-medium touch-target hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                {editingId != null ? "Guardar Cambios" : "Crear Combo"}
              </button>
              {editingId != null && (
                <button
                  onClick={resetForm}
                  className="px-4 py-2 border border-pos-muted/30 text-pos-text rounded-lg text-sm touch-target hover:bg-pos-background"
                >
                  Cancelar
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PriceListsSection() {
  const { storeId } = useActiveStore();
  const priceLists = usePriceListsStore((s) => s.priceLists);
  const loading = usePriceListsStore((s) => s.loading);
  const itemsByList = usePriceListsStore((s) => s.itemsByList);
  const loadingItems = usePriceListsStore((s) => s.loadingItems);
  const loadPriceLists = usePriceListsStore((s) => s.loadPriceLists);
  const loadListItems = usePriceListsStore((s) => s.loadListItems);
  const updateItem = usePriceListsStore((s) => s.updateItem);
  const updateListName = usePriceListsStore((s) => s.updateListName);
  const bulkSetPercentage = usePriceListsStore((s) => s.bulkSetPercentage);
  const clearOverrides = usePriceListsStore((s) => s.clearOverrides);
  const deletePriceList = usePriceListsStore((s) => s.deletePriceList);
  const showNotification = useAppStore((s) => s.showNotification);

  const allProducts = useProductsStore((s) => s.products);
  const loadProducts = useProductsStore((s) => s.loadProducts);

  const [editingListId, setEditingListId] = useState<number | null>(null);
  const [listNameDraft, setListNameDraft] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [showBulkPct, setShowBulkPct] = useState(false);
  const [bulkPctDraft, setBulkPctDraft] = useState("");
  const [confirmAction, setConfirmAction] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  const priceListsLoadedRef = useRef(false);
  useEffect(() => {
    if (priceListsLoadedRef.current) return;
    if (priceLists.length === 0 && !loading) {
      priceListsLoadedRef.current = true;
      setLoadError(false);
      loadPriceLists(storeId).catch(() => setLoadError(true));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const productsLoadedRef = useRef(false);
  useEffect(() => {
    if (productsLoadedRef.current) return;
    productsLoadedRef.current = true;
    loadProducts(storeId).catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const storeLists = priceLists.filter((pl) => pl.storeId === storeId);

  // ── Vista 2: load items when entering a list (only if not already cached) ──
  const itemsLoadedRef = useRef<number | null>(null);
  useEffect(() => {
    if (editingListId != null) {
      const list = storeLists.find((pl) => pl.id === editingListId);
      if (list) setListNameDraft(list.name);
      // Only load from DB if we don't have items cached for this list yet
      if (itemsLoadedRef.current !== editingListId) {
        itemsLoadedRef.current = editingListId;
        loadListItems(editingListId);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingListId]);

  const [productSearch, setProductSearch] = useState("");

  const storeProducts = allProducts.filter((p) => p.store_id === storeId);
  const editingList = editingListId != null ? storeLists.find((pl) => pl.id === editingListId) : null;
  const listItems = editingListId != null ? (itemsByList[editingListId] ?? []) : [];
  const isLoadingItems = editingListId != null ? (loadingItems[editingListId] ?? false) : false;

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return storeProducts;
    const q = productSearch.toLowerCase();
    return storeProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)),
    );
  }, [storeProducts, productSearch]);

  // Count how many products have overrides in this list
  const overrideCount = listItems.filter((i) => i.price !== null || i.percentage !== null).length;

  function findItem(productId: number): PriceListItem | undefined {
    return listItems.find((i) => i.productId === productId);
  }

  function handlePriceChange(productId: number, value: string) {
    const parsed = value === "" ? null : parseFloat(value);
    if (value !== "" && isNaN(parsed!)) return;
    updateItem(editingListId!, productId, { price: parsed, percentage: null });
  }

  function handlePercentageChange(productId: number, value: string) {
    if (value === "" || value === "-") {
      updateItem(editingListId!, productId, { percentage: null, price: null });
      return;
    }
    const parsed = parseFloat(value);
    if (isNaN(parsed)) return;
    updateItem(editingListId!, productId, { percentage: parsed, price: null });
  }

  function handleBulkPercentage() {
    setBulkPctDraft("");
    setShowBulkPct(true);
  }

  function handleClearOverrides() {
    setConfirmAction({
      title: "Limpiar sobreprecios",
      message: "¿Estás seguro de limpiar todos los precios y porcentajes personalizados de esta lista? Los productos volverán a usar su precio base.",
      onConfirm: () => {
        clearOverrides(editingListId!);
        setConfirmAction(null);
        showNotification("Sobreprescios limpiados");
      },
    });
  }

  function handleDeleteList() {
    setConfirmAction({
      title: `Eliminar "${editingList?.name}"`,
      message: "¿Estás seguro de eliminar esta lista de precios? Los productos no se verán afectados, solo se borra la configuración de precios.",
      onConfirm: () => {
        deletePriceList(editingListId!);
        setEditingListId(null);
        setConfirmAction(null);
        showNotification("Lista eliminada");
      },
    });
  }

  function handleNewList() {
    if (storeLists.length >= 10) {
      showNotification("Ya alcanzaste el máximo de 10 listas");
      return;
    }
    const num = storeLists.length + 1;
    usePriceListsStore.getState().createPriceList(`Lista ${num}`, storeId);
    showNotification(`Lista ${num} creada`);
  }

  function handleRename() {
    if (!listNameDraft.trim() || !editingList) return;
    updateListName(editingList.id, listNameDraft.trim());
    showNotification("Lista renombrada");
  }

  const ACCENT = ACCENTS["price-lists"];

  // ── Empty / Loading / Error states ──
  if (storeLists.length === 0) {
    return (
      <div>
        <h3 className="text-base font-semibold text-pos-text mb-1">Listas de Precio</h3>
        <p className="text-sm text-pos-muted mb-5">gestioná hasta 10 listas con precios personalizados</p>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-xl bg-pos-secondary/10 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-pos-secondary animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <p className="text-sm text-pos-muted">Cargando listas de precio…</p>
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-xl bg-pos-danger/10 flex items-center justify-center mb-4">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6 text-pos-danger">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <p className="text-sm text-pos-danger font-medium mb-3">Error al cargar las listas</p>
            <button
              onClick={() => { setLoadError(false); loadPriceLists(storeId).catch(() => setLoadError(true)); }}
              className="px-4 py-2 bg-pos-secondary text-white rounded-lg text-sm font-medium touch-target hover:opacity-90 transition-opacity"
            >
              Reintentar
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-xl bg-pos-secondary/10 flex items-center justify-center mb-4">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6 text-pos-secondary">
                <path d="M9 5H2v7l6.29 6.29a1 1 0 0 0 1.42 0l5.58-5.58a1 1 0 0 0 0-1.42L9 5z" />
                <circle cx="5.5" cy="6.5" r="1.5" fill="currentColor" opacity="0.3" />
                <path d="M16 5h6v6" />
                <path d="M19 2l-5 5" />
              </svg>
            </div>
            <p className="text-sm text-pos-muted font-medium mb-1">No hay listas de precio</p>
            <p className="text-xs text-pos-muted/60 mb-4">Cargá las listas predeterminadas o creá una nueva</p>
            <button
              onClick={() => { setLoadError(false); loadPriceLists(storeId).catch(() => setLoadError(true)); }}
              className="px-4 py-2 bg-pos-secondary text-white rounded-lg text-sm font-medium touch-target hover:opacity-90 transition-opacity"
            >
              Cargar listas
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Vista 2: Edit list ──
  if (editingListId != null) {
    const editedCount = listItems.length;
    return (
      <div>
        {/* Subtle back link */}
        <button
          onClick={() => setEditingListId(null)}
          className="text-xs text-pos-muted/60 hover:text-pos-muted transition-colors mb-3 flex items-center gap-1 touch-target"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Volver a listas
        </button>

        {/* List name + actions */}
        <div className="rounded-xl border border-pos-muted/10 bg-pos-surface p-4 mb-4 dark:border-gray-600/30 dark:bg-gray-800">
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-xl ${ACCENT.bg} flex items-center justify-center shrink-0`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={`w-5 h-5 ${ACCENT.text}`}>
                <path d="M9 5H2v7l6.29 6.29a1 1 0 0 0 1.42 0l5.58-5.58a1 1 0 0 0 0-1.42L9 5z" />
                <circle cx="5.5" cy="6.5" r="1.5" fill="currentColor" opacity="0.3" />
                <path d="M16 5h6v6" />
                <path d="M19 2l-5 5" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <input
                type="text"
                value={listNameDraft}
                onChange={(e) => setListNameDraft(e.target.value)}
                className="w-full border-0 border-b-2 border-transparent focus:border-pos-secondary bg-transparent px-0 py-0.5 text-base font-semibold text-pos-text focus:outline-none focus:ring-0 transition-colors"
              />
            </div>
            <button
              onClick={handleRename}
              disabled={!listNameDraft.trim() || listNameDraft.trim() === editingList?.name}
              className="px-3 py-1.5 bg-pos-secondary text-white rounded-lg text-xs font-medium touch-target hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              Renombrar
            </button>
            <button
              onClick={handleDeleteList}
              className="px-3 py-1.5 text-pos-danger border border-pos-danger/30 rounded-lg text-xs font-medium touch-target hover:bg-pos-danger/10 transition-colors"
            >
              Eliminar
            </button>
          </div>

          {/* Stats + bulk actions */}
          <div className="flex items-center justify-between text-xs text-pos-muted pt-2 border-t border-pos-muted/10">
            <span>
              <span className="font-medium text-pos-text">{storeProducts.length}</span> productos
              {overrideCount > 0 && (
                <span className="ml-2">
                  · <span className="font-medium text-pos-secondary">{overrideCount}</span> con precio personalizado
                </span>
              )}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleBulkPercentage}
                disabled={isLoadingItems}
                className="px-3 py-1.5 bg-pos-secondary text-white rounded-lg text-xs font-medium touch-target hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                Aplicar % a todos
              </button>
              <button
                onClick={handleClearOverrides}
                disabled={isLoadingItems || overrideCount === 0}
                className="px-3 py-1.5 border border-pos-muted/30 text-pos-text rounded-lg text-xs font-medium touch-target hover:bg-pos-background disabled:opacity-40 transition-colors"
              >
                Limpiar todo
              </button>
            </div>
          </div>
        </div>

        {/* Product table */}
        {isLoadingItems ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-sm text-pos-muted">Cargando productos…</p>
          </div>
        ) : storeProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-xl bg-pos-muted/10 flex items-center justify-center mb-4">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6 text-pos-muted/40">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="9" y1="9" x2="15" y2="15" />
                <line x1="15" y1="9" x2="9" y2="15" />
              </svg>
            </div>
            <p className="text-sm text-pos-muted font-medium">No hay productos en esta tienda</p>
            <p className="text-xs text-pos-muted/60 mt-1">Agregá productos desde la página Productos</p>
          </div>
        ) : (
          <>
            {/* Search */}
            <div className="relative mb-3">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-pos-muted/35" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Buscá producto por nombre o código de barras…"
                className="w-full border border-pos-muted/25 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary bg-pos-surface"
              />
              {productSearch && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white bg-pos-secondary px-1.5 py-0.5 rounded-full pointer-events-none">
                  {filteredProducts.length}
                </span>
              )}
            </div>
            <div className="overflow-x-auto rounded-xl border border-pos-muted/10 dark:border-gray-600/30">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-pos-background/50 text-pos-muted text-xs uppercase tracking-wider">
                  <th className="text-left font-medium px-3 py-2.5">ID</th>
                  <th className="text-left font-medium px-3 py-2.5">Producto</th>
                  <th className="text-right font-medium px-3 py-2.5">Precio base</th>
                  <th className="text-right font-medium px-3 py-2.5">Precio lista</th>
                  <th className="text-right font-medium px-3 py-2.5">% Ajuste</th>
                  <th className="text-right font-medium px-3 py-2.5">Efectivo</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => {
                  const item = findItem(product.id);
                  const priceVal = item?.price ?? null;
                  const pctVal = item?.percentage ?? null;
                  const effective = usePriceListsStore.getState().getEffectivePrice(editingListId!, product.id, product.price);
                  const hasOverride = priceVal !== null || pctVal !== null;
                  const diff = effective - product.price;
                  const diffColor = diff < 0 ? "text-green-600" : diff > 0 ? "text-pos-danger" : "text-pos-muted";

                  return (
                    <tr key={product.id} className={`border-t border-pos-muted/5 hover:bg-pos-background/30 transition-colors ${hasOverride ? "bg-pos-secondary/[0.03]" : ""}`}>
                      <td className="px-3 py-2 text-pos-muted font-mono text-xs">{product.id}</td>
                      <td className="px-3 py-2 max-w-[220px]">
                        <p className="text-pos-text font-medium truncate">{product.name}</p>
                        {product.barcode && (
                          <p className="text-[10px] text-pos-muted/50 font-mono truncate">{product.barcode}</p>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-pos-muted text-xs">${product.price.toFixed(2)}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-[10px] text-pos-muted/40">$</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={priceVal !== null ? priceVal.toString() : ""}
                            onChange={(e) => handlePriceChange(product.id, e.target.value)}
                            placeholder="—"
                            className={`w-20 text-right border rounded-lg px-2 py-1 text-xs font-mono focus:outline-none focus:ring-2 bg-pos-surface transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                              priceVal !== null
                                ? "border-pos-secondary/40 focus:ring-pos-secondary dark:border-pos-secondary/50"
                                : "border-pos-muted/30 focus:ring-pos-secondary"
                            }`}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={pctVal !== null ? pctVal.toString() : ""}
                            onChange={(e) => handlePercentageChange(product.id, e.target.value)}
                            placeholder="—"
                            className={`w-16 text-right border rounded-lg px-2 py-1 text-xs font-mono focus:outline-none focus:ring-2 bg-pos-surface transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                              pctVal !== null
                                ? "border-pos-secondary/40 focus:ring-pos-secondary dark:border-pos-secondary/50"
                                : "border-pos-muted/30 focus:ring-pos-secondary"
                            }`}
                          />
                          <span className="text-[10px] text-pos-muted/40">%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className={`font-mono text-xs font-bold ${hasOverride ? "text-pos-secondary" : "text-pos-muted"}`}>
                          ${effective.toFixed(2)}
                        </span>
                        {hasOverride && diff !== 0 && (
                          <span className={`block text-[10px] font-mono ${diffColor}`}>
                            {diff > 0 ? "+" : ""}{diff.toFixed(2)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}

        {/* ── Bulk Percentage Modal ── */}
        {showBulkPct && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => setShowBulkPct(false)}
          >
            <div
              className="bg-pos-surface rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-5"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Icon */}
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-pos-secondary/10 dark:bg-pos-secondary/15 flex items-center justify-center ring-1 ring-pos-secondary/15">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-8 h-8 text-pos-secondary">
                    <path d="M9 5H2v7l6.29 6.29a1 1 0 0 0 1.42 0l5.58-5.58a1 1 0 0 0 0-1.42L9 5z" />
                    <circle cx="5.5" cy="6.5" r="1.5" fill="currentColor" opacity="0.3" />
                    <path d="M16 5h6v6" />
                    <path d="M19 2l-5 5" />
                  </svg>
                </div>
              </div>

              {/* Title */}
              <div className="text-center space-y-2">
                <h2 className="text-lg font-bold text-pos-text">Aplicar porcentaje</h2>
                <p className="text-sm text-pos-muted leading-relaxed">
                  Ingresá el porcentaje de ajuste para <strong>TODOS</strong> los productos de esta lista.
                  Usá valores negativos para descuento (ej: <strong>-10</strong>) o positivos para aumento (ej: <strong>15</strong>).
                </p>
              </div>

              {/* Input */}
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={bulkPctDraft}
                  onChange={(e) => setBulkPctDraft(e.target.value)}
                  placeholder="0"
                  autoFocus
                  className="w-full text-center text-2xl font-bold font-mono border-2 border-pos-secondary/30 focus:border-pos-secondary rounded-xl px-4 py-4 focus:outline-none focus:ring-4 focus:ring-pos-secondary/20 bg-pos-surface transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const pct = parseFloat(bulkPctDraft);
                      if (isNaN(pct)) return;
                      bulkSetPercentage(editingListId!, pct);
                      setShowBulkPct(false);
                      showNotification(`Porcentaje ${pct > 0 ? "+" : ""}${pct}% aplicado a todos los productos`);
                    }
                    if (e.key === "Escape") setShowBulkPct(false);
                  }}
                />
                <span className="absolute right-5 top-1/2 -translate-y-1/2 text-2xl font-bold text-pos-muted/30 pointer-events-none">%</span>
              </div>

              {bulkPctDraft && !isNaN(parseFloat(bulkPctDraft)) && (
                <div className="text-center text-sm text-pos-muted">
                  {(() => {
                    const pct = parseFloat(bulkPctDraft);
                    if (pct >= 0) {
                      return <>Los precios aumentarán <span className="font-semibold text-pos-danger">+{pct}%</span></>;
                    }
                    return <>Los precios se reducirán <span className="font-semibold text-green-600">{pct}%</span></>;
                  })()}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => setShowBulkPct(false)}
                  className="flex-1 px-4 py-3 border border-pos-muted/20 text-pos-text rounded-xl font-medium text-sm touch-target hover:bg-pos-background hover:border-pos-muted/40 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    const pct = parseFloat(bulkPctDraft);
                    if (isNaN(pct)) {
                      showNotification("Porcentaje inválido");
                      return;
                    }
                    bulkSetPercentage(editingListId!, pct);
                    setShowBulkPct(false);
                    showNotification(`Porcentaje ${pct > 0 ? "+" : ""}${pct}% aplicado a todos los productos`);
                  }}
                  disabled={!bulkPctDraft || isNaN(parseFloat(bulkPctDraft))}
                  className="flex-1 px-4 py-3 bg-pos-secondary text-white rounded-xl font-bold text-sm touch-target hover:bg-pos-secondary/90 active:scale-[0.98] transition-all disabled:opacity-40"
                >
                  Aplicar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Confirm Modal (clear overrides / delete) ── */}
        {confirmAction && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => setConfirmAction(null)}
          >
            <div
              className="bg-pos-surface rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-5"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Warning icon */}
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-pos-danger/10 dark:bg-pos-danger/15 flex items-center justify-center ring-1 ring-pos-danger/15">
                  <svg className="w-8 h-8 text-pos-danger" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
              </div>

              <div className="text-center space-y-2">
                <h2 className="text-lg font-bold text-pos-text">{confirmAction.title}</h2>
                <p className="text-sm text-pos-muted leading-relaxed">{confirmAction.message}</p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => setConfirmAction(null)}
                  className="flex-1 px-4 py-3 border border-pos-muted/20 text-pos-text rounded-xl font-medium text-sm touch-target hover:bg-pos-background hover:border-pos-muted/40 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmAction.onConfirm}
                  className="flex-1 px-4 py-3 bg-pos-danger text-white rounded-xl font-bold text-sm touch-target hover:bg-pos-danger/90 active:scale-[0.98] transition-all"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Vista 1: List of lists ──
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-lg font-semibold text-pos-text">Listas de Precio</h3>
        <button
          onClick={handleNewList}
          disabled={storeLists.length >= 10}
          className="px-4 py-2 bg-pos-secondary text-white rounded-lg text-sm font-medium touch-target hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center gap-1.5"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nueva Lista
        </button>
      </div>
      <p className="text-sm text-pos-muted mb-5">
        {storeLists.length}/10 listas — cada lista tiene precios independientes por producto
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-w-3xl">
        {storeLists.map((list, i) => (
          <button
            key={list.id}
            onClick={() => setEditingListId(list.id)}
            className="card-enter relative rounded-xl border border-pos-muted/10 bg-pos-surface p-4 text-left active:scale-[0.98] transition-all duration-200 dark:border-gray-600/30 dark:bg-gray-800 group cursor-pointer overflow-hidden"
            style={{ animationDelay: `${i * 0.06}s` }}
          >
            {/* Accent bar */}
            <span
              className="absolute top-0 left-0 right-0 h-0.5 opacity-60 group-hover:opacity-100 transition-opacity"
              style={{ backgroundColor: ACCENT.bar }}
            />

            <div className="flex items-center gap-3">
              <span className={`shrink-0 w-9 h-9 rounded-lg ${ACCENT.bg} flex items-center justify-center text-xs font-bold ${ACCENT.text}`}>
                #{list.id}
              </span>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-pos-text">{list.name}</h4>
                <p className="text-[10px] text-pos-muted/60 mt-0.5">
                  {overrideCountForList(list.id) > 0
                    ? `${overrideCountForList(list.id)} productos con precio personalizado`
                    : "Sin precios personalizados"}
                </p>
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-pos-muted/30 group-hover:text-pos-muted/60 transition-colors shrink-0">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
  
  // Helper to count overrides for a list in the overview
  function overrideCountForList(listId: number): number {
    const items = itemsByList[listId];
    if (!items) return 0;
    return items.filter((i) => i.price !== null || i.percentage !== null).length;
  }
}
