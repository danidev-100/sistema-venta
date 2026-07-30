import { useState, useEffect } from "react";
import { useCustomersStore, type Customer } from "@/store/customers";
import { usePriceListsStore } from "@/store";
import { useActiveStore } from "@/store/context";
import { customerSchema } from "@/lib/validations";

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

interface CustomerFormProps {
  editCustomer: Customer | null;
  onSaved: () => void;
  onCancel: () => void;
}

export default function CustomerForm({
  editCustomer,
  onSaved,
  onCancel,
}: CustomerFormProps) {
  const { storeId } = useActiveStore();
  const addCustomer = useCustomersStore((s) => s.addCustomer);
  const updateCustomer = useCustomersStore((s) => s.updateCustomer);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [cuit, setCuit] = useState("");
  const [selectedPriceListId, setSelectedPriceListId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const priceLists = usePriceListsStore((s) => s.priceLists);

  useEffect(() => {
    if (editCustomer) {
      setName(editCustomer.name);
      setPhone(editCustomer.phone);
      setEmail(editCustomer.email);
      setAddress(editCustomer.address);
      setCuit(editCustomer.cuit);
      setSelectedPriceListId(editCustomer.priceListId);
      setError(null);
    } else {
      setName("");
      setPhone("");
      setEmail("");
      setAddress("");
      setCuit("");
      setSelectedPriceListId(null);
      setError(null);
    }
  }, [editCustomer]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const result = customerSchema.safeParse({
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      address: address.trim(),
      cuit: cuit.trim(),
      store_id: storeId,
      editId: editCustomer?.id,
    });

    if (!result.success) {
      const firstIssue = result.error.issues[0];
      setError(firstIssue.message);
      return;
    }

    setSaving(true);
    try {
      if (editCustomer) {
        await updateCustomer(editCustomer.id, {
          name: result.data.name,
          phone: result.data.phone,
          email: result.data.email,
          address: result.data.address,
          cuit: result.data.cuit,
          priceListId: selectedPriceListId,
        });
      } else {
        await addCustomer({
          name: result.data.name,
          phone: result.data.phone,
          email: result.data.email,
          address: result.data.address,
          cuit: result.data.cuit,
          store_id: storeId,
          creditBalance: 0,
          priceListId: selectedPriceListId,
        });
      }
      onSaved();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Error al guardar el cliente",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-sm font-semibold text-pos-text uppercase tracking-wide">
        {editCustomer ? "Editar Cliente" : "Nuevo Cliente"}
      </h3>

      {error && (
        <div className="bg-pos-danger/10 border border-pos-danger/30 text-pos-danger text-sm rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Name */}
        <div>
          <label
            htmlFor="customer-name"
            className="block text-sm font-medium text-pos-text mb-1"
          >
            Nombre <span className="text-pos-danger">*</span>
          </label>
          <input
            id="customer-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre del cliente"
            required
            className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target"
          />
        </div>

        {/* Phone */}
        <div>
          <label
            htmlFor="customer-phone"
            className="block text-sm font-medium text-pos-text mb-1"
          >
            Teléfono
          </label>
          <input
            id="customer-phone"
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Teléfono"
            className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target"
          />
        </div>

        {/* Email */}
        <div>
          <label
            htmlFor="customer-email"
            className="block text-sm font-medium text-pos-text mb-1"
          >
            Email
          </label>
          <input
            id="customer-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@ejemplo.com"
            className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target"
          />
        </div>

        {/* CUIT */}
        <div>
          <label
            htmlFor="customer-cuit"
            className="block text-sm font-medium text-pos-text mb-1"
          >
            CUIT
          </label>
          <input
            id="customer-cuit"
            type="text"
            value={cuit}
            onChange={(e) => setCuit(e.target.value)}
            placeholder="XX-XXXXXXXX-X"
            className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target"
          />
        </div>

        {/* Price List */}
        <div>
          <label
            htmlFor="customer-price-list"
            className="block text-sm font-medium text-pos-text mb-1"
          >
            Lista de Precio
          </label>
          <select
            id="customer-price-list"
            value={selectedPriceListId ?? ""}
            onChange={(e) =>
              setSelectedPriceListId(
                e.target.value === "" ? null : Number(e.target.value),
              )
            }
            className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target"
          >
            <option value="">Ninguna</option>
            {priceLists.map((pl) => (
              <option key={pl.id} value={pl.id}>
                {pl.name}
              </option>
            ))}
          </select>
        </div>

        {/* Address — full width */}
        <div className="sm:col-span-2">
          <label
            htmlFor="customer-address"
            className="block text-sm font-medium text-pos-text mb-1"
          >
            Dirección
          </label>
          <input
            id="customer-address"
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
          {saving ? "Guardando…" : editCustomer ? "Actualizar" : "Crear"}
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
