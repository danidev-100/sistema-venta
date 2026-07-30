import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

let JWT_SECRET: string;

const envSecret = process.env.JWT_SECRET;
if (envSecret) {
  JWT_SECRET = envSecret;
} else {
  console.error("[auth] JWT_SECRET no está configurado — el servidor no arrancará de forma segura");
  if (process.env.NODE_ENV !== "production") {
    console.warn("[auth] ⚠️  Usando JWT_SECRET por defecto. Setealo en .env para producción.");
    JWT_SECRET = "sistema-venta-secret-change-me";
  } else {
    JWT_SECRET = "";
  }
}

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
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
    req.user = decoded;
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

export function requireStoreAccess(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role === "admin") {
    return next();
  }

  if (!req.user?.storeId) {
    return next();
  }

  const requestedStoreId = req.query.storeId as string || req.body.storeId || req.body.store_id;

  if (requestedStoreId && requestedStoreId !== req.user.storeId) {
    res.status(403).json({ error: "No tenés acceso a esta tienda" });
    return;
  }

  next();
}
