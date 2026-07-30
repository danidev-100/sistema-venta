import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { authMiddleware } from "./middleware/auth.js";
import authRoutes from "./routes/auth.js";
import productsRoutes from "./routes/products.js";
import categoriesRoutes from "./routes/categories.js";
import brandsRoutes from "./routes/brands.js";
import customersRoutes from "./routes/customers.js";
import salesRoutes from "./routes/sales.js";
import cashRoutes from "./routes/cash.js";
import expensesRoutes from "./routes/expenses.js";
import proveedoresRoutes from "./routes/proveedores.js";
import pedidosRoutes from "./routes/pedidos.js";
import combosRoutes from "./routes/combos.js";
import bultosRoutes from "./routes/bultos.js";
import comprobantesRoutes from "./routes/comprobantes.js";
import invoicesRoutes from "./routes/invoices.js";
import plantillasRoutes from "./routes/plantillas.js";
import companyRoutes from "./routes/company.js";
import priceListsRoutes from "./routes/price-lists.js";
import usersRoutes from "./routes/users.js";
import storesRoutes from "./routes/stores.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ── Middleware ──
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// ── Public routes ──
app.use("/api/auth", authRoutes);

// ── Protected routes ──
app.use("/api/products", authMiddleware, productsRoutes);
app.use("/api/categories", authMiddleware, categoriesRoutes);
app.use("/api/brands", authMiddleware, brandsRoutes);
app.use("/api/customers", authMiddleware, customersRoutes);
app.use("/api/sales", authMiddleware, salesRoutes);
app.use("/api/cash", authMiddleware, cashRoutes);
app.use("/api/expenses", authMiddleware, expensesRoutes);
app.use("/api/proveedores", authMiddleware, proveedoresRoutes);
app.use("/api/pedidos", authMiddleware, pedidosRoutes);
app.use("/api/combos", authMiddleware, combosRoutes);
app.use("/api/bultos", authMiddleware, bultosRoutes);
app.use("/api/comprobantes", authMiddleware, comprobantesRoutes);
app.use("/api/invoices", authMiddleware, invoicesRoutes);
app.use("/api/plantillas", authMiddleware, plantillasRoutes);
app.use("/api/company", authMiddleware, companyRoutes);
app.use("/api/price-lists", authMiddleware, priceListsRoutes);
app.use("/api/users", authMiddleware, usersRoutes);
app.use("/api/stores", authMiddleware, storesRoutes);

// ── Serve frontend (only in non-Vercel environments) ──
// On Vercel, static files are served by the CDN, not by Express.
if (!process.env.VERCEL) {
  const distPath = path.resolve(__dirname, "../../dist");
  app.use(express.static(distPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

export default app;
