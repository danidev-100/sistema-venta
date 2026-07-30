import { useState, useEffect } from "react";
import { useProveedoresStore, type Proveedor } from "@/store/proveedores";
import { useActiveStore } from "@/store/context";
import { proveedorSchema } from "@/lib/validations";

interface ProveedorFormProps {
  editProveedor: Proveedor | null;
  onSaved: () => void;
  onCancel: () => void;
}

export default function ProveedorForm({
  editProveedor,
  onSaved,
  onCancel,
}: ProveedorFormProps) {
  const { storeId } = useActiveStore();
  const addProveedor = useProveedoresStore((s) => s.addProveedor);
  const updateProveedor = useProveedoresStore((s) => s.updateProveedor);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [cuit, setCuit] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editProveedor) {
      setName(editProveedor.name);
      setPhone(editProveedor.phone);
      setEmail(editProveedor.email);
      setAddress(editProveedor.address);
      setCuit(editProveedor.cuit);
      setError(null);
    } else {
      setName("");
      setPhone("");
      setEmail("");
      setAddress("");
      setCuit("");
      setError(null);
    }
  }, [editProveedor]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const result = proveedorSchema.safeParse({
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      address: address.trim(),
      cuit: cuit.trim(),
      store_id: storeId,
      editId: editProveedor?.id,
    });

    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }

    setSaving(true);
    try {
      if (editProveedor) {
        updateProveedor(editProveedor.id, {
          name: result.data.name,
          phone: result.data.phone,
          email: result.data.email,
          address: result.data.address,
          cuit: result.data.cuit,
        });
      } else {
        addProveedor({
          name: result.data.name,
          phone: result.data.phone,
          email: result.data.email,
          address: result.data.address,
          cuit: result.data.cuit,
          store_id: storeId,
        });
      }
      onSaved();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Error al guardar el proveedor",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-sm font-semibold text-pos-text uppercase tracking-wide">
        {editProveedor ? "Editar Proveedor" : "Nuevo Proveedor"}
      </h3>

      {error && (
        <div className="bg-pos-danger/10 border border-pos-danger/30 text-pos-danger text-sm rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="prov-name" className="block text-sm font-medium text-pos-text mb-1">
            Nombre <span className="text-pos-danger">*</span>
          </label>
          <input
            id="prov-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre del proveedor"
            required
            className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target"
          />
        </div>

        <div>
          <label htmlFor="prov-phone" className="block text-sm font-medium text-pos-text mb-1">
            Teléfono
          </label>
          <input
            id="prov-phone"
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Teléfono"
            className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target"
          />
        </div>

        <div>
          <label htmlFor="prov-email" className="block text-sm font-medium text-pos-text mb-1">
            Email
          </label>
          <input
            id="prov-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@ejemplo.com"
            className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target"
          />
        </div>

        <div>
          <label htmlFor="prov-cuit" className="block text-sm font-medium text-pos-text mb-1">
            CUIT
          </label>
          <input
            id="prov-cuit"
            type="text"
            value={cuit}
            onChange={(e) => setCuit(e.target.value)}
            placeholder="XX-XXXXXXXX-X"
            className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="prov-address" className="block text-sm font-medium text-pos-text mb-1">
            Dirección
          </label>
          <input
            id="prov-address"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Dirección"
            className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-pos-secondary text-white rounded-lg font-medium text-sm touch-target hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Guardando…" : editProveedor ? "Actualizar" : "Crear"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-pos-muted/30 text-pos-text rounded-lg font-medium text-sm touch-target hover:bg-pos-background"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
