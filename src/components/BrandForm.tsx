import { useState, useEffect } from "react";
import { useBrandsStore, type Brand } from "@/store/brands";
import { useActiveStore } from "@/store/context";

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

interface BrandFormProps {
  editBrand: Brand | null;
  onSaved: () => void;
  onCancel: () => void;
}

export default function BrandForm({
  editBrand,
  onSaved,
  onCancel,
}: BrandFormProps) {
  const { storeId } = useActiveStore();
  const addBrand = useBrandsStore((s) => s.addBrand);
  const updateBrand = useBrandsStore((s) => s.updateBrand);

  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editBrand) {
      setName(editBrand.name);
      setError(null);
    } else {
      setName("");
      setError(null);
    }
  }, [editBrand]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = name.trim();
    if (!trimmed) {
      setError("El nombre de la marca no puede estar vacío");
      return;
    }

    setSaving(true);
    try {
      if (editBrand) {
        updateBrand(editBrand.id, { name: trimmed });
      } else {
        addBrand({ name: trimmed, store_id: storeId });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar la marca");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h3 className="text-sm font-semibold text-pos-text uppercase tracking-wide">
        {editBrand ? "Editar Marca" : "Nueva Marca"}
      </h3>

      {error && (
        <div className="bg-pos-danger/10 border border-pos-danger/30 text-pos-danger text-sm rounded-lg px-3 py-2 dark:bg-red-900/20 dark:border-red-500/30 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          id="brand-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre de la marca"
          required
          className="flex-1 border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
        />
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-pos-secondary text-white rounded-lg font-medium text-sm touch-target hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Guardando..." : editBrand ? "Actualizar" : "Crear"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-pos-muted/30 text-pos-text rounded-lg font-medium text-sm touch-target hover:bg-pos-background dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
