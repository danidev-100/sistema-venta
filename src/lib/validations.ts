import { z } from "zod";
import { useCustomersStore } from "@/store/customers";
import { useProveedoresStore } from "@/store/proveedores";
import { useProductsStore } from "@/store/products";

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function trimmedString(msg = "Este campo no puede estar vacío") {
  return z.string().trim().min(1, msg);
}

function optionalString() {
  return z.string().trim().optional().default("");
}

function nonNegativeNumber(msg = "Debe ser un número no negativo") {
  return z.number().min(0, msg);
}

// ──────────────────────────────────────────────
// Customer
// ──────────────────────────────────────────────

export const customerSchema = z
  .object({
    name: trimmedString("El nombre del cliente es obligatorio"),
    phone: optionalString(),
    email: optionalString(),
    address: optionalString(),
    cuit: optionalString(),
    store_id: z.string(),
    editId: z.number().optional(),
  })
  .superRefine((data, ctx) => {
    const customers = useCustomersStore.getState().customers;
    const storeCustomers = customers.filter((c) => c.store_id === data.store_id);

    // Duplicate name
    if (data.name) {
      const dupName = storeCustomers.find(
        (c) => c.name.toLowerCase() === data.name.toLowerCase() && c.id !== data.editId,
      );
      if (dupName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Ya existe un cliente con el nombre "${data.name}"`,
          path: ["name"],
        });
      }
    }

    // Duplicate phone
    if (data.phone) {
      const dupPhone = storeCustomers.find(
        (c) => c.phone === data.phone && c.id !== data.editId,
      );
      if (dupPhone) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `El teléfono "${data.phone}" ya está registrado`,
          path: ["phone"],
        });
      }
    }

    // Duplicate CUIT
    if (data.cuit) {
      const dupCuit = storeCustomers.find(
        (c) => c.cuit === data.cuit && c.id !== data.editId,
      );
      if (dupCuit) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `El CUIT "${data.cuit}" ya está registrado`,
          path: ["cuit"],
        });
      }
    }
  });

export type CustomerInput = z.input<typeof customerSchema>;

// ──────────────────────────────────────────────
// Proveedor
// ──────────────────────────────────────────────

export const proveedorSchema = z
  .object({
    name: trimmedString("El nombre del proveedor es obligatorio"),
    phone: optionalString(),
    email: optionalString(),
    address: optionalString(),
    cuit: optionalString(),
    store_id: z.string(),
    editId: z.number().optional(),
  })
  .superRefine((data, ctx) => {
    const proveedores = useProveedoresStore.getState().proveedores;
    const storeProveedores = proveedores.filter((p) => p.store_id === data.store_id);

    // Duplicate name
    const dupName = storeProveedores.find(
      (p) => p.name.toLowerCase() === data.name.toLowerCase() && p.id !== data.editId,
    );
    if (dupName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Ya existe un proveedor con el nombre "${data.name}"`,
        path: ["name"],
      });
    }

    // Duplicate phone
    if (data.phone) {
      const dupPhone = storeProveedores.find(
        (p) => p.phone === data.phone && p.id !== data.editId,
      );
      if (dupPhone) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `El teléfono "${data.phone}" ya está registrado`,
          path: ["phone"],
        });
      }
    }

    // Duplicate CUIT
    if (data.cuit) {
      const dupCuit = storeProveedores.find(
        (p) => p.cuit === data.cuit && p.id !== data.editId,
      );
      if (dupCuit) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `El CUIT "${data.cuit}" ya está registrado`,
          path: ["cuit"],
        });
      }
    }
  });

export type ProveedorInput = z.input<typeof proveedorSchema>;

// ──────────────────────────────────────────────
// Product
// ──────────────────────────────────────────────

export const productSchema = z
  .object({
    name: trimmedString("El nombre del producto es obligatorio"),
    barcode: optionalString(),
    image: z.string().default(""),
    price: nonNegativeNumber("El precio debe ser un número no negativo"),
    costPrice: nonNegativeNumber("El costo debe ser un número no negativo").default(0),
    stock: z.number().int().min(0).default(0),
    minStock: z.number().int().min(0).default(0),
    category_id: z.number().nullable().default(null),
    brandId: z.number().nullable().default(null),
    saleUnit: z.enum(["unit", "gram", "kilogram"]).default("unit"),
    store_id: z.string(),
    editId: z.number().optional(),
  })
  .superRefine((data, ctx) => {
    const products = useProductsStore.getState().products;
    const storeProducts = products.filter((p) => p.store_id === data.store_id);

    // Duplicate name
    const dupName = storeProducts.find(
      (p) => p.name.toLowerCase() === data.name.toLowerCase() && p.id !== data.editId,
    );
    if (dupName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Ya existe un producto con el nombre "${data.name}"`,
        path: ["name"],
      });
    }

    // Duplicate barcode
    if (data.barcode) {
      const dupBarcode = storeProducts.find(
        (p) => p.barcode === data.barcode && p.id !== data.editId,
      );
      if (dupBarcode) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `El código "${data.barcode}" ya está registrado`,
          path: ["barcode"],
        });
      }
    }
  });

export type ProductInput = z.input<typeof productSchema>;

// ──────────────────────────────────────────────
// User
// ──────────────────────────────────────────────

export const userNameSchema = trimmedString("El nombre de usuario es obligatorio");
