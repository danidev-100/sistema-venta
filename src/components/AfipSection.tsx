import { useState, useEffect, useRef } from "react";
import { useActiveStore } from "@/store/context";
import { useAfipStore, type AfipConfigInput, type CondicionIva, type Ambiente } from "@/store/afip";
import { useAppStore } from "@/store";

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export default function AfipSection() {
  const { storeId } = useActiveStore();
  const afipConfig = useAfipStore((s) => s.afipConfig);
  const loading = useAfipStore((s) => s.loading);
  const loadAfipConfig = useAfipStore((s) => s.loadAfipConfig);
  const saveAfipConfig = useAfipStore((s) => s.saveAfipConfig);
  const testAfipConnection = useAfipStore((s) => s.testAfipConnection);
  const showNotification = useAppStore((s) => s.showNotification);

  const [cuit, setCuit] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [domicilio, setDomicilio] = useState("");
  const [condicionIva, setCondicionIva] = useState<CondicionIva>("monotributo");
  const [puntoVenta, setPuntoVenta] = useState("1");
  const [ambiente, setAmbiente] = useState<Ambiente>("homo");
  const [activo, setActivo] = useState(false);
  const [exigirCae, setExigirCae] = useState(false);
  const [cert, setCert] = useState("");
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const initializedRef = useRef(false);

  // Load existing config on mount
  useEffect(() => {
    loadAfipConfig(storeId);
  }, [storeId, loadAfipConfig]);

  // Populate form when config loads
  useEffect(() => {
    if (loading || initializedRef.current) return;
    initializedRef.current = true;
    setCuit(afipConfig.cuit);
    setRazonSocial(afipConfig.razonSocial);
    setDomicilio(afipConfig.domicilio);
    setCondicionIva(afipConfig.condicionIva);
    setPuntoVenta(String(afipConfig.puntoVenta));
    setAmbiente(afipConfig.ambiente);
    setActivo(afipConfig.activo);
    setExigirCae(afipConfig.exigirCae);
    setCert(afipConfig.cert);
    setKey(afipConfig.key);
  }, [loading, afipConfig]);

  function formConfig(): AfipConfigInput {
    return {
      cuit: cuit.trim(),
      razonSocial: razonSocial.trim(),
      domicilio: domicilio.trim(),
      condicionIva,
      puntoVenta: parseInt(puntoVenta) || 1,
      ambiente,
      activo,
      exigirCae,
      cert,
      key,
    };
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await saveAfipConfig(storeId, formConfig());
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      showNotification("Configuración AFIP guardada");
    } catch (err) {
      showNotification(err instanceof Error ? err.message : "Error al guardar la configuración AFIP");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testAfipConnection(storeId, formConfig());
      if (res.ok) {
        const puntos = Array.isArray(res.puntosVenta)
          ? res.puntosVenta.map((p: any) => p?.Nro ?? p?.PtoVta ?? p).join(", ")
          : JSON.stringify(res.puntosVenta);
        setTestResult({ ok: true, text: `Conexión exitosa. Puntos de venta: ${puntos}` });
      } else {
        setTestResult({ ok: false, text: res.error ?? "Error de conexión desconocido" });
      }
    } catch (err) {
      setTestResult({ ok: false, text: err instanceof Error ? err.message : "Error de conexión desconocido" });
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-pos-muted italic">Cargando…</p>;
  }

  return (
    <div className="max-w-xl space-y-5">
      <p className="text-sm text-pos-muted">
        Configurá los datos fiscales del negocio para facturar con CAE ante AFIP.
        Cuando emitas un comprobante vas a poder elegir entre "AFIP" e "Interno".
      </p>

      {/* Form fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-pos-text mb-1">CUIT</label>
          <input type="text" value={cuit} onChange={(e) => setCuit(e.target.value)}
            placeholder="30-12345678-9"
            className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target bg-pos-surface" />
        </div>
        <div>
          <label className="block text-sm font-medium text-pos-text mb-1">Razón social</label>
          <input type="text" value={razonSocial} onChange={(e) => setRazonSocial(e.target.value)}
            placeholder="Mi Empresa S.R.L."
            className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target bg-pos-surface" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-pos-text mb-1">Domicilio</label>
          <input type="text" value={domicilio} onChange={(e) => setDomicilio(e.target.value)}
            placeholder="Av. Corrientes 1234, CABA"
            className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target bg-pos-surface" />
        </div>
        <div>
          <label className="block text-sm font-medium text-pos-text mb-1">Condición fiscal</label>
          <select value={condicionIva} onChange={(e) => setCondicionIva(e.target.value as CondicionIva)}
            className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target bg-pos-surface">
            <option value="monotributo">Monotributo</option>
            <option value="responsable_inscripto">Responsable Inscripto</option>
            <option value="exento">Exento</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-pos-text mb-1">Punto de venta</label>
          <input type="number" inputMode="numeric" min={1} max={9999} value={puntoVenta}
            onChange={(e) => setPuntoVenta(e.target.value)}
            className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target bg-pos-surface" />
        </div>
        <div>
          <label className="block text-sm font-medium text-pos-text mb-1">Ambiente</label>
          <select value={ambiente} onChange={(e) => setAmbiente(e.target.value as Ambiente)}
            className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target bg-pos-surface">
            <option value="homo">Homologación (pruebas)</option>
            <option value="prod">Producción</option>
          </select>
        </div>
      </div>

      {/* Checkboxes */}
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm text-pos-text cursor-pointer touch-target">
          <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} className="accent-pos-secondary" />
          Activo
        </label>
        <label className="flex items-center gap-2 text-sm text-pos-text cursor-pointer touch-target">
          <input type="checkbox" checked={exigirCae} onChange={(e) => setExigirCae(e.target.checked)} className="accent-pos-secondary" />
          Exigir CAE
        </label>
      </div>

      {/* Certificate / key */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-pos-text mb-1">Certificado</label>
          <textarea value={cert} onChange={(e) => setCert(e.target.value)} rows={5}
            placeholder={"-----BEGIN CERTIFICATE-----"}
            className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target bg-pos-surface resize-y" />
        </div>
        <div>
          <label className="block text-sm font-medium text-pos-text mb-1">Clave privada</label>
          <textarea value={key} onChange={(e) => setKey(e.target.value)} rows={5}
            placeholder={"-----BEGIN PRIVATE KEY-----"}
            className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target bg-pos-surface resize-y" />
        </div>
      </div>

      {/* Mini-guía de certificado */}
      <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 dark:border-blue-500/30 dark:bg-blue-500/10">
        <h4 className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2 dark:text-blue-400">
          Certificado de homologación
        </h4>
        <p className="text-xs text-pos-muted leading-relaxed">
          Para probar en homologación generá un certificado de prueba:
          <code className="block mt-1.5 px-2 py-1.5 rounded bg-pos-background/60 text-[11px] font-mono overflow-x-auto">
            openssl req -newkey rsa:2048 -nodes -keyout key.pem -x509 -days 365 -out cert.pem
          </code>
          y dale de alta en el webservice WSFEv1 del ambiente de prueba con tu CUIT en AFIP.
        </p>
      </div>

      {/* Test result */}
      {testResult && (
        <div className={`rounded-lg px-3 py-2 text-sm border ${
          testResult.ok
            ? "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400"
            : "bg-pos-danger/10 border-pos-danger/30 text-pos-danger"
        }`}>
          {testResult.text}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button onClick={handleSave} disabled={saving}
          className="px-6 py-2.5 bg-pos-secondary text-white rounded-lg font-medium text-sm touch-target hover:opacity-90 transition-opacity disabled:opacity-50">
          {saving ? "Guardando…" : "Guardar"}
        </button>
        <button onClick={handleTest} disabled={testing}
          className="px-6 py-2.5 border border-pos-muted/30 text-pos-text rounded-lg font-medium text-sm touch-target hover:bg-pos-background transition-colors disabled:opacity-50">
          {testing ? "Probando…" : "Probar conexión AFIP"}
        </button>
        {saved && (
          <span className="text-sm text-emerald-600 font-medium animate-fade-in">
            ✓ Configuración guardada
          </span>
        )}
      </div>
    </div>
  );
}
