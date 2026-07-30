import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { getDb } from "../db.js";
import { generateToken, authMiddleware } from "../middleware/auth.js";
import * as schema from "../../../db/cloud-schema.js";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Demás intentos de login. Esperá 15 minutos." },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginSchema = z.object({
  username: z.string().min(1, "Usuario requerido"),
  password: z.string().min(1, "Contraseña requerida"),
});

// POST /api/auth/login
router.post("/login", loginLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }

    const { username, password } = parsed.data;

    const db = getDb();
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.name, username))
      .limit(1);

    if (!user) {
      res.status(401).json({ error: "Usuario o contraseña incorrectos" });
      return;
    }

    // Support both bcrypt (new) and SHA-256 (legacy from desktop)
    let valid = false;
    if (user.password_hash.startsWith("$2")) {
      valid = await bcrypt.compare(password, user.password_hash);
    } else {
      // Legacy SHA-256 — migrate on successful login
      const hash = await sha256(password);
      valid = hash === user.password_hash;
      if (valid) {
        const bcryptHash = await bcrypt.hash(password, 10);
        await db
          .update(schema.users)
          .set({ password_hash: bcryptHash })
          .where(eq(schema.users.id, user.id));
      }
    }

    if (!valid) {
      res.status(401).json({ error: "Usuario o contraseña incorrectos" });
      return;
    }

    const token = generateToken({
      userId: user.id,
      username: user.name,
      role: user.role,
      storeId: (user as any).store_id || undefined,
    });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        permissions: user.permissions,
      },
    });
  } catch (err) {
    console.error("[auth] login error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// GET /api/auth/me
router.get("/me", authMiddleware, async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, req.user!.userId))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }

    res.json({
      id: user.id,
      name: user.name,
      role: user.role,
      permissions: user.permissions,
    });
  } catch (err) {
    console.error("[auth] me error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default router;
