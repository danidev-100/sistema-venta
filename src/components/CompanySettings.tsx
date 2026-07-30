import { useState, useEffect, useRef, useCallback } from "react";
import { useActiveStore } from "@/store/context";
import { useCompanyStore, type CompanyInput } from "@/store/company";

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export default function CompanySettings() {
  const { storeId } = useActiveStore();
  const data = useCompanyStore((s) => s.data);
  const loaded = useCompanyStore((s) => s.loaded);
  const loadCompany = useCompanyStore((s) => s.loadCompany);
  const saveCompany = useCompanyStore((s) => s.saveCompany);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [cuit, setCuit] = useState("");
  const [email, setEmail] = useState("");
  const [web, setWeb] = useState("");
  const [logoPreview, setLogoPreview] = useState("");
  const [logoBase64, setLogoBase64] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load company data
  useEffect(() => {
    loadCompany(storeId);
  }, [storeId, loadCompany]);

  // Populate form when data loads
  useEffect(() => {
    if (data) {
      setName(data.name);
      setPhone(data.phone);
      setAddress(data.address);
      setCuit(data.cuit);
      setEmail(data.email);
      setWeb(data.web);
      setLogoBase64(data.logo_base64);
      setLogoPreview(data.logo_base64);
    }
  }, [data]);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result as string;
      setLogoBase64(b64);
      setLogoPreview(b64);
    };
    reader.readAsDataURL(file);
  }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave() {
    setDragOver(false);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const input: CompanyInput = {
        name,
        phone,
        address,
        cuit,
        email,
        web,
        logo_base64: logoBase64,
      };
      await saveCompany(storeId, input);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  function handleRemoveLogo() {
    setLogoBase64("");
    setLogoPreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  if (!loaded) {
    return <p className="text-sm text-pos-muted italic">Cargando…</p>;
  }

  return (
    <div className="max-w-xl space-y-5">
      <p className="text-sm text-pos-muted">
        Configurá los datos de tu empresa. Estos datos se usan en las plantillas de
        comprobantes (facturas, boletas, tickets, etc.).
      </p>

      {/* Logo drag & drop */}
      <div>
        <label className="block text-sm font-medium text-pos-text mb-2">Logo</label>
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center w-40 h-40 rounded-xl border-2 border-dashed cursor-pointer touch-target transition-all ${
            dragOver
              ? "border-pos-secondary bg-pos-secondary/5 scale-105"
              : logoPreview
                ? "border-pos-muted/20 bg-pos-background/30"
                : "border-pos-muted/30 hover:border-pos-secondary/40 hover:bg-pos-background/50"
          }`}
        >
          {logoPreview ? (
            <>
              <img
                src={logoPreview}
                alt="Logo"
                className="max-w-[90%] max-h-[90%] object-contain rounded-lg"
              />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleRemoveLogo(); }}
                className="absolute -top-2 -right-2 w-6 h-6 bg-pos-danger text-white rounded-full text-xs flex items-center justify-center shadow hover:scale-110 transition-transform"
                title="Eliminar logo"
              >
                ✕
              </button>
            </>
          ) : (
            <div className="text-center px-4">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-8 h-8 text-pos-muted/50 mx-auto mb-2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <p className="text-xs text-pos-muted">Arrastrá tu logo o hacé clic</p>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileInput}
            className="hidden"
          />
        </div>
      </div>

      {/* Form fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-pos-text mb-1">Razón Social</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Mi Empresa S.R.L."
            className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target bg-pos-surface" />
        </div>
        <div>
          <label className="block text-sm font-medium text-pos-text mb-1">CUIT</label>
          <input type="text" value={cuit} onChange={(e) => setCuit(e.target.value)}
            placeholder="30-12345678-9"
            className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target bg-pos-surface" />
        </div>
        <div>
          <label className="block text-sm font-medium text-pos-text mb-1">Teléfono</label>
          <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)}
            placeholder="(011) 4567-8901"
            className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target bg-pos-surface" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-pos-text mb-1">Dirección</label>
          <input type="text" value={address} onChange={(e) => setAddress(e.target.value)}
            placeholder="Av. Corrientes 1234, CABA"
            className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target bg-pos-surface" />
        </div>
        <div>
          <label className="block text-sm font-medium text-pos-text mb-1">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="contacto@miempresa.com"
            className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target bg-pos-surface" />
        </div>
        <div>
          <label className="block text-sm font-medium text-pos-text mb-1">Sitio Web</label>
          <input type="text" value={web} onChange={(e) => setWeb(e.target.value)}
            placeholder="www.miempresa.com"
            className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target bg-pos-surface" />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <button onClick={handleSave} disabled={saving}
          className="px-6 py-2.5 bg-pos-secondary text-white rounded-lg font-medium text-sm touch-target hover:opacity-90 transition-opacity disabled:opacity-50">
          {saving ? "Guardando…" : "Guardar"}
        </button>
        {saved && (
          <span className="text-sm text-emerald-600 font-medium animate-fade-in">
            ✓ Datos guardados
          </span>
        )}
      </div>
    </div>
  );
}
