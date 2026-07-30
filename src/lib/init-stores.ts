import { useBrandsStore } from "@/store/brands";
import { useProductsStore } from "@/store/products";
import { useCustomersStore } from "@/store/customers";
import { useProveedoresStore } from "@/store/proveedores";
import { usePedidosStore } from "@/store/pedidos";
import { useInvoicesStore } from "@/store/invoices";
import { useCashClosingStore } from "@/store/cash-closing";
import { useAuthStore } from "@/store/auth";
import { useExpensesStore } from "@/store/expenses";
import { useComprobantesStore } from "@/store/comprobantes";
import { useCombosStore } from "@/store/combos";
import { useBultosStore } from "@/store/bultos";
import { usePriceListsStore } from "@/store/price-lists";
import { useAppStore } from "@/store";

let initialized = false;

export async function initAllStores(force = false): Promise<void> {
  if (initialized && !force) return;
  initialized = true;

  // For now, just check auth session
  const user = useAuthStore.getState().currentUser;
  if (user) {
    // If user is logged in, load their store data
    console.log("[init] User already logged in, data will load on demand");
  }

  console.log("[init] Stores ready");
}
