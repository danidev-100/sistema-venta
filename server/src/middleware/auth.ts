import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { and, eq } from "drizzle-orm";
import { getDb } from "../db.js";
import * as schema from "../../../db/cloud-schema.js";
import { decideStoreAccess } from "../domain/store-access.js";
import { shouldRefreshSession } from "../domain/session.js";

const JWT_SECRET: string = (() => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error("[auth] JWT_SECRET no está configurado — el servidor no arrancará");
    process.exit(1);
  }
  return secret;
})();

export interface AuthPayload {
  userId: number;
  username: string;
  role: string;
  storeId?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function generateToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "24h" });
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Token requerido" });
    return;
  }

  try {
    const token = header.slice(7);
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload & { exp?: number };
    req.user = decoded;

    // Sesión deslizante: si al token le queda poco, se entrega uno nuevo para
    // que un turno largo no muera con un 401 en medio de una venta.
    if (shouldRefreshSession(decoded.exp, Date.now())) {
      const { userId, username, role, storeId } = decoded;
      res.setHeader("X-Refreshed-Token", generateToken({ userId, username, role, storeId }));
    }

    next();
  } catch {
    res.status(401).json({ error: "Token inválido o expirado" });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: "Token requerido" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "No tenés permisos para esta acción" });
      return;
    }
    next();
  };
}

export async function requireStoreAccess(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: "No autenticado" });
      return;
    }

    const requestedStoreId =
      (req.query.storeId as string) || req.body?.storeId || req.body?.store_id || null;

    // Sólo se consulta la base para lo que la decisión realmente necesita.
    let openShifts: string[] = [];
    let hasShiftHistory = false;
    let storeIsActive: boolean | undefined;

    if (user.role !== "admin") {
      const db = getDb();

      const open = await db
        .select({ store_id: schema.shifts.store_id })
        .from(schema.shifts)
        .where(
          and(eq(schema.shifts.user_id, user.userId), eq(schema.shifts.status, "open")),
        );
      openShifts = open.map((row) => row.store_id);

      if (openShifts.length === 0) {
        const previous = await db
          .select({ id: schema.shifts.id })
          .from(schema.shifts)
          .where(eq(schema.shifts.user_id, user.userId))
          .limit(1);
        hasShiftHistory = previous.length > 0;
      }

      const openingShift = req.method === "POST" && req.path === "/shifts";
      if (openingShift) {
        if (!requestedStoreId) {
          res.status(400).json({ error: "Sucursal requerida" });
          return;
        }
        const [store] = await db
          .select({ active: schema.stores.active })
          .from(schema.stores)
          .where(eq(schema.stores.id, requestedStoreId))
          .limit(1);
        storeIsActive = !!store?.active;
      }
    }

    const decision = decideStoreAccess({
      role: user.role,
      method: req.method,
      pathname: `${req.baseUrl}${req.path}`,
      requestedStoreId,
      openShifts,
      hasShiftHistory,
      storeIsActive,
    });

    if (!decision.allow) {
      res.status(decision.status).json({ error: decision.error });
      return;
    }

    // La sucursal resuelta queda disponible para las rutas: así dejan de
    // depender del storeId que manda el cliente.
    (req as Request & { storeId?: string | null }).storeId = decision.store;
    next();
  } catch (err) {
    console.error("[auth] requireStoreAccess error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}
