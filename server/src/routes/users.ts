import { Router, Request, Response } from "express";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getDb } from "../db.js";
import * as schema from "../../../db/cloud-schema.js";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const users = await db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        role: schema.users.role,
        permissions: schema.users.permissions,
        active: schema.users.active,
        created_at: schema.users.created_at,
        updated_at: schema.users.updated_at,
      })
      .from(schema.users);

    res.json(users);
  } catch (err) {
    console.error("[users] list error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const { name, password, role, permissions } = req.body;

    if (!name || !password) {
      res.status(400).json({ error: "name y password son requeridos" });
      return;
    }

    const password_hash = await bcrypt.hash(password, 10);

    const db = getDb();
    const [user] = await db
      .insert(schema.users)
      .values({
        name,
        password_hash,
        role: role || "custom",
        permissions: permissions || "[]",
      })
      .returning({
        id: schema.users.id,
        name: schema.users.name,
        role: schema.users.role,
        permissions: schema.users.permissions,
        active: schema.users.active,
        created_at: schema.users.created_at,
        updated_at: schema.users.updated_at,
      });

    res.status(201).json(user);
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "El nombre de usuario ya existe" });
      return;
    }
    console.error("[users] create error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.put("/:id", async (req: Request, res: Response) => {
  try {
    const { name, password, role, permissions, active } = req.body;
    const id = Number(req.params.id);

    const values: Record<string, any> = {};
    if (name !== undefined) values.name = name;
    if (role !== undefined) values.role = role;
    if (permissions !== undefined) values.permissions = permissions;
    if (active !== undefined) values.active = active;
    if (password) values.password_hash = await bcrypt.hash(password, 10);
    values.updated_at = new Date();

    const db = getDb();
    const [user] = await db
      .update(schema.users)
      .set(values)
      .where(eq(schema.users.id, id))
      .returning({
        id: schema.users.id,
        name: schema.users.name,
        role: schema.users.role,
        permissions: schema.users.permissions,
        active: schema.users.active,
        created_at: schema.users.created_at,
        updated_at: schema.users.updated_at,
      });

    if (!user) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }

    res.json(user);
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "El nombre de usuario ya existe" });
      return;
    }
    console.error("[users] update error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const [deleted] = await db
      .delete(schema.users)
      .where(eq(schema.users.id, Number(req.params.id)))
      .returning({ id: schema.users.id });

    if (!deleted) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }

    res.json({ message: "Usuario eliminado" });
  } catch (err) {
    console.error("[users] delete error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

export default router;
