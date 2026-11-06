// Reglas puras de acceso por sucursal (auditoría P0-2).
//
// La sucursal de un usuario se deriva de su turno de caja abierto: no viaja en
// el token, porque los usuarios no tienen sucursal propia en la base. Un admin
// sigue eligiendo sucursal, que es lo que necesita el selector del POS.

export type StoreAccessInput = {
  role: string;
  method: string;
  /** Ruta completa pedida, por ejemplo "/api/cash/shifts". */
  pathname: string;
  /** Sucursal que pidió el cliente por query o body. */
  requestedStoreId: string | null;
  /** Sucursales de los turnos de caja abiertos del usuario. */
  openShifts: string[];
  /** Si el usuario abrió algún turno en su historia. */
  hasShiftHistory: boolean;
  /** undefined = no se consultó (sólo importa al abrir turno). */
  storeIsActive?: boolean;
};

export type StoreAccessDecision =
  | {
      allow: true;
      store: string | null;
      rule: "admin" | "open-shift" | "open-shift-request" | "bootstrap";
    }
  | { allow: false; status: 400 | 403 | 409; error: string };

/** Rutas que un usuario sin turno necesita para poder abrir su primer turno. */
const BOOTSTRAP_PATHS = [
  "/api/products",
  "/api/categories",
  "/api/brands",
  "/api/company",
  "/api/price-lists",
  "/api/cash/shifts",
];

const OPEN_SHIFT_PATH = "/api/cash/shifts";

function isBootstrapRead(method: string, pathname: string): boolean {
  if (method !== "GET") return false;
  return BOOTSTRAP_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function decideStoreAccess(input: StoreAccessInput): StoreAccessDecision {
  const { role, method, pathname, requestedStoreId, openShifts, hasShiftHistory, storeIsActive } =
    input;

  if (role === "admin") {
    return { allow: true, store: requestedStoreId, rule: "admin" };
  }

  // Abrir un turno es la única operación que puede cambiar la sucursal activa,
  // así que se permite con una sucursal activa aunque ya haya historia.
  if (method === "POST" && pathname === OPEN_SHIFT_PATH) {
    if (storeIsActive === false) {
      return { allow: false, status: 400, error: "Sucursal inexistente o inactiva" };
    }
    return { allow: true, store: requestedStoreId, rule: "open-shift-request" };
  }

  if (openShifts.length > 1) {
    return {
      allow: false,
      status: 409,
      error: `Tenés más de un turno de caja abierto (${openShifts.join(", ")}). Cerrá uno antes de seguir`,
    };
  }

  if (openShifts.length === 1) {
    const store = openShifts[0];
    if (requestedStoreId && requestedStoreId !== store) {
      return { allow: false, status: 403, error: "No tenés acceso a esta tienda" };
    }
    return { allow: true, store, rule: "open-shift" };
  }

  // Sin turno abierto: puede leer el catálogo mientras nunca haya abierto uno,
  // para llegar a abrirlo. Con historia, tiene que abrir turno.
  if (!hasShiftHistory && isBootstrapRead(method, pathname)) {
    if (!requestedStoreId) {
      return { allow: false, status: 400, error: "Sucursal requerida" };
    }
    return { allow: true, store: requestedStoreId, rule: "bootstrap" };
  }

  return { allow: false, status: 403, error: "Abrí un turno de caja para operar" };
}
