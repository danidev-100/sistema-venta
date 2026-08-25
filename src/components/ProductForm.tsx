import { useState, useEffect } from "react";
import {
  useProductsStore,
  type Product,
  type Category,
} from "@/store/products";
import { useBrandsStore } from "@/store/brands";
import { useAuthStore } from "@/store/auth";
import { useActiveStore } from "@/store/context";
import { productSchema } from "@/lib/validations";
import NumberInput from "@/components/NumberInput";

// ──────────────────────────────────────────────
// Form state
// ──────────────────────────────────────────────

type FormData = {
  name: string;
  barcode: string;
  image: string;
  price: string;
  costPrice: string;
  brandId: string; // string because select value
  category_id: string; // string because select value
  minStock: string;
  midStock: string;
  saleUnit: string;
};

const INITIAL_FORM: FormData = {
  name: "",
  barcode: "",
  image: "",
  price: "",
  costPrice: "",
  brandId: "",
  category_id: "",
  minStock: "",
  midStock: "",
  saleUnit: "unit",
};

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function flattenCategories(
  cats: Category[],
  parentId: number | null,
  depth: number,
  result: { id: number; label: string }[],
): { id: number; label: string }[] {
  cats
    .filter((c) => c.parent_id === parentId)
    .forEach((c) => {
      result.push({
        id: c.id,
        label: `${"  ".repeat(depth)}${c.name}`,
      });
      flattenCategories(cats, c.id, depth + 1, result);
    });
  return result;
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

interface ProductFormProps {
  editProduct: Product | null;
  onSaved: () => void;
  onCancel: () => void;
  /** Barcode captured by scanner — auto-fills the barcode field */
  scannedBarcode?: string;
}

export default function ProductForm({
  editProduct,
  onSaved,
  onCancel,
  scannedBarcode,
}: ProductFormProps) {
  const { storeId } = useActiveStore();
  const categories = useProductsStore((s) => s.categories);
  const addProduct = useProductsStore((s) => s.addProduct);
  const updateProduct = useProductsStore((s) => s.updateProduct);
  const brands = useBrandsStore((s) => s.brands);
  const canViewCost = useAuthStore((s) => s.hasPermission("productos"));

  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showScanHint, setShowScanHint] = useState(!editProduct);

  const storeCategories = categories.filter((c) => c.store_id === storeId);
  const flatCategories = flattenCategories(storeCategories, null, 0, []);
  const storeBrands = brands
    .filter((b) => b.store_id === storeId)
    .sort((a, b) => a.name.localeCompare(b.name));

  // Populate form when editing
  useEffect(() => {
    if (editProduct) {
      setForm({
        name: editProduct.name,
        barcode: editProduct.barcode ?? "",
        image: editProduct.image ?? "",
        price: String(editProduct.price),
        costPrice: String(editProduct.costPrice),
        brandId: editProduct.brandId != null ? String(editProduct.brandId) : "",
        category_id: editProduct.category_id != null ? String(editProduct.category_id) : "",
        minStock: String(editProduct.minStock),
        midStock: String(editProduct.midStock),
        saleUnit: editProduct.saleUnit,
      });
      setShowScanHint(false);
      setError(null);
    } else {
      setForm(INITIAL_FORM);
      setShowScanHint(true);
      setError(null);
    }
  }, [editProduct]);

  // Auto-fill barcode when scanned from the parent
  useEffect(() => {
    if (scannedBarcode) {
      setForm((prev) => ({ ...prev, barcode: scannedBarcode }));
      setShowScanHint(false);
    }
  }, [scannedBarcode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const price = parseFloat(form.price);
    const costPrice = parseFloat(form.costPrice);
    const categoryId = form.category_id ? Number(form.category_id) : null;
    const brandId = form.brandId ? Number(form.brandId) : null;
    const minStock = parseInt(form.minStock, 10) || 0;
    const midStock = parseInt(form.midStock, 10) || 0;

    const result = productSchema.safeParse({
      name: form.name.trim(),
      barcode: form.barcode.trim(),
      image: form.image,
      price: form.price === "" ? 0 : isNaN(price) ? -1 : price,
      costPrice: form.costPrice === "" ? 0 : isNaN(costPrice) ? -1 : costPrice,
      stock: 0,
      minStock: 0,
      category_id: categoryId,
      brandId,
      store_id: storeId,
      editId: editProduct?.id,
    });

    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }

    setSaving(true);
    try {
      if (editProduct) {
        await updateProduct(editProduct.id, {
          name: result.data.name,
          barcode: result.data.barcode || null,
          image: result.data.image,
          price: result.data.price,
          costPrice: result.data.costPrice,
          brandId: result.data.brandId,
          minStock,
          midStock,
          category_id: result.data.category_id,
          store_id: storeId,
          saleUnit: form.saleUnit as "unit" | "gram" | "kilogram",
        });
      } else {
        await addProduct({
          name: result.data.name,
          barcode: result.data.barcode || null,
          image: result.data.image,
          price: result.data.price,
          costPrice: result.data.costPrice,
          brandId: result.data.brandId,
          stock: 0,
          minStock,
          midStock,
          category_id: result.data.category_id,
          store_id: storeId,
          saleUnit: form.saleUnit as "unit" | "gram" | "kilogram",
        });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar el producto");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-sm font-semibold text-pos-text uppercase tracking-wide">
        {editProduct ? "Editar Producto" : "Nuevo Producto"}
      </h2>

      {/* Error */}
      {error && (
        <div className="bg-pos-danger/10 border border-pos-danger/30 text-pos-danger text-sm rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* Name */}
      <div>
        <label
          htmlFor="product-name"
          className="block text-sm font-medium text-pos-text mb-1"
        >
          Nombre *
        </label>
        <input
          id="product-name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Nombre del producto"
          required
          className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target"
        />
      </div>

      {/* Image */}
      <div>
        <label className="block text-sm font-medium text-pos-text mb-1">
          Imagen
          <span className="text-pos-muted ml-1">(opcional)</span>
        </label>
        {form.image ? (
          <div className="relative inline-block">
            <img
              src={form.image}
              alt="Preview"
              className="w-24 h-24 object-cover rounded-lg border border-pos-muted/20"
            />
            <button
              type="button"
              onClick={() => setForm({ ...form, image: "" })}
              className="absolute -top-2 -right-2 w-5 h-5 bg-pos-danger text-white rounded-full text-xs flex items-center justify-center hover:opacity-90"
            >
              ×
            </button>
          </div>
        ) : (
          <label className="inline-flex items-center gap-2 px-4 py-2 border border-dashed border-pos-muted/30 rounded-lg cursor-pointer hover:bg-pos-background/50 text-sm text-pos-muted touch-target">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Subir imagen
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => setForm({ ...form, image: reader.result as string });
                reader.readAsDataURL(file);
              }}
            />
          </label>
        )}
      </div>

      {/* Barcode */}
      <div>
        <label
          htmlFor="product-barcode"
          className="block text-sm font-medium text-pos-text mb-1"
        >
          Código de barras
          <span className="text-pos-muted ml-1">(opcional)</span>
          {showScanHint && (
            <span className="ml-2 text-xs text-pos-secondary animate-pulse">
              📷 Escaneá el código
            </span>
          )}
        </label>
        <input
          id="product-barcode"
          autoFocus={!editProduct}
          value={form.barcode}
          onChange={(e) => setForm({ ...form, barcode: e.target.value })}
          placeholder="ej. 77912345"
          className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target"
        />
      </div>

      {/* Price */}
      <div>
        <label
          htmlFor="product-price"
          className="block text-sm font-medium text-pos-text mb-1"
        >
          Precio
        </label>
        <NumberInput
          id="product-price"
          value={parseFloat(form.price) || 0}
          onChange={(n) => setForm({ ...form, price: n.toString() })}
          placeholder="0,00"
          className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target"
        />
      </div>

      {/* Cost Price (admin only) */}
      {canViewCost && (
        <div>
          <label
            htmlFor="product-cost-price"
            className="block text-sm font-medium text-pos-text mb-1"
          >
            Cost Price
            <span className="text-pos-muted ml-1">(opcional)</span>
          </label>
          <NumberInput
            id="product-cost-price"
            value={parseFloat(form.costPrice) || 0}
            onChange={(n) => setForm({ ...form, costPrice: n.toString() })}
            placeholder="0,00"
            className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target"
          />
        </div>
      )}

      {/* Brand (admin only) */}
      {canViewCost && (
        <div>
          <label
            htmlFor="product-brand"
            className="block text-sm font-medium text-pos-text mb-1"
          >
            Marca
            <span className="text-pos-muted ml-1">(opcional)</span>
          </label>
          <select
            id="product-brand"
            value={form.brandId}
            onChange={(e) => setForm({ ...form, brandId: e.target.value })}
            className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target"
          >
            <option value="">— Sin marca —</option>
            {storeBrands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Category */}
      <div>
        <label
          htmlFor="product-category"
          className="block text-sm font-medium text-pos-text mb-1"
        >
          Categoría
          <span className="text-pos-muted ml-1">(opcional)</span>
        </label>
        <select
          id="product-category"
          value={form.category_id}
          onChange={(e) => setForm({ ...form, category_id: e.target.value })}
          className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target"
        >
          <option value="">— Sin categoría —</option>
          {flatCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {/* Sale unit */}
      <div>
        <label
          htmlFor="product-sale-unit"
          className="block text-sm font-medium text-pos-text mb-1"
        >
          Unidad de venta
        </label>
        <select
          id="product-sale-unit"
          value={form.saleUnit}
          onChange={(e) => setForm({ ...form, saleUnit: e.target.value })}
          className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target"
        >
          <option value="unit">Unidad</option>
          <option value="gram">Gramo</option>
          <option value="kilogram">Kilogramo</option>
        </select>
      </div>

      {/* Stock levels */}
      <div>
        <p className="text-xs font-semibold text-pos-muted uppercase tracking-wide mb-2">
          {form.saleUnit === "unit" ? "Niveles de Stock" : "Stock en gramos"}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="product-min-stock"
              className="block text-xs font-medium text-pos-muted mb-1"
            >
              <span className="inline-block w-2 h-2 rounded-full bg-pos-danger shrink-0 mr-1.5" />
              Stock crítico
            </label>
            <input
              id="product-min-stock"
              type="number"
              min={0}
              value={form.minStock}
              onChange={(e) => setForm({ ...form, minStock: e.target.value })}
              className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm text-right font-mono focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target"
            />
          </div>
          <div>
            <label
              htmlFor="product-mid-stock"
              className="block text-xs font-medium text-pos-muted mb-1"
            >
              <span className="inline-block w-2 h-2 rounded-full bg-amber-400 shrink-0 mr-1.5" />
              Stock medio
            </label>
            <input
              id="product-mid-stock"
              type="number"
              min={0}
              value={form.midStock}
              onChange={(e) => setForm({ ...form, midStock: e.target.value })}
              className="w-full border border-pos-muted/30 rounded-lg px-3 py-2 text-sm text-right font-mono focus:outline-none focus:ring-2 focus:ring-pos-secondary touch-target"
            />
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex items-center gap-2 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 px-4 py-2 bg-pos-secondary text-white rounded-lg font-medium text-sm touch-target hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Guardando..." : editProduct ? "Actualizar Producto" : "Crear Producto"}
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
