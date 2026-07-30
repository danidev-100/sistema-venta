import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { getPool } from "../db.js";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, name, role, permissions, active, created_at, updated_at FROM users ORDER BY name`,
    );
    res.json(result.rows);
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
    const pool = getPool();

    const result = await pool.query(
      `INSERT INTO users (name, password_hash, role, permissions, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING id, name, role, permissions, active, created_at, updated_at`,
      [name, password_hash, role || "custom", permissions || "[]"],
    );

    res.status(201).json(result.rows[0]);
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

    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (name !== undefined) { sets.push(`name = $${idx++}`); params.push(name); }
    if (role !== undefined) { sets.push(`role = $${idx++}`); params.push(role); }
    if (permissions !== undefined) { sets.push(`permissions = $${idx++}`); params.push(permissions); }
    if (active !== undefined) { sets.push(`active = $${idx++}`); params.push(active); }
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      sets.push(`password_hash = $${idx++}`);
      params.push(hash);
    }
    sets.push(`updated_at = NOW()`);

    if (sets.length === 0) {
      res.status(400).json({ error: "Nada que actualizar" });
      return;
    }

    params.push(id);
    const pool = getPool();
    const result = await pool.query(
      `UPDATE users SET ${sets.join(", ")} WHERE id = $${idx}
       RETURNING id, name, role, permissions, active, created_at, updated_at`,
      params,
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }

    res.json(result.rows[0]);
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
    const pool = getPool();
    const result = await pool.query(
      `DELETE FROM users WHERE id = $1 RETURNING id`,
      [Number(req.params.id)],
    );

    if (result.rows.length === 0) {
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
