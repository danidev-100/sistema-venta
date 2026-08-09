import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import { authMiddleware, requireStoreAccess } from "./middleware/auth.js";
import authRoutes from "./routes/auth.js";
import productsRoutes from "./routes/products.js";
import categoriesRoutes from "./routes/categories.js";
import brandsRoutes from "./routes/brands.js";
import customersRoutes from "./routes/customers.js";
import salesRoutes from "./routes/sales.js";
import cashRoutes from "./routes/cash.js";
import expensesRoutes from "./routes/expenses.js";
import proveedoresRoutes from "./routes/proveedores.js";
import purchaseInvoicesRoutes from "./routes/purchase-invoices.js";
import pedidosRoutes from "./routes/pedidos.js";
import combosRoutes from "./routes/combos.js";
import bultosRoutes from "./routes/bultos.js";
import comprobantesRoutes from "./routes/comprobantes.js";
import invoicesRoutes from "./routes/invoices.js";
import plantillasRoutes from "./routes/plantillas.js";
import companyRoutes from "./routes/company.js";
import afipRoutes from "./routes/afip.js";
import priceListsRoutes from "./routes/price-lists.js";
import usersRoutes from "./routes/users.js";
import storesRoutes from "./routes/stores.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ── Security headers ──
app.use(helmet());

// ── CORS ──
const CORS_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",")
  : ["http://localhost:1420", "http://localhost:3000", "http://localhost:5173"];

app.use(cors({
  origin: CORS_ORIGINS,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// ── Body parser ──
app.use(express.json({ limit: "5mb" }));

// ── Global rate limiter ──
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas requests, intentá de nuevo más tarde" },
});
app.use(globalLimiter);

// ── Public routes ──
app.use("/api/auth", authRoutes);

// ── Protected routes ──
app.use("/api/products", authMiddleware, requireStoreAccess, productsRoutes);
app.use("/api/categories", authMiddleware, requireStoreAccess, categoriesRoutes);
app.use("/api/brands", authMiddleware, requireStoreAccess, brandsRoutes);
app.use("/api/customers", authMiddleware, requireStoreAccess, customersRoutes);
app.use("/api/sales", authMiddleware, requireStoreAccess, salesRoutes);
app.use("/api/cash", authMiddleware, requireStoreAccess, cashRoutes);
app.use("/api/expenses", authMiddleware, requireStoreAccess, expensesRoutes);
app.use("/api/proveedores", authMiddleware, requireStoreAccess, proveedoresRoutes);
app.use("/api/purchase-invoices", authMiddleware, requireStoreAccess, purchaseInvoicesRoutes);
app.use("/api/pedidos", authMiddleware, requireStoreAccess, pedidosRoutes);
app.use("/api/combos", authMiddleware, requireStoreAccess, combosRoutes);
app.use("/api/bultos", authMiddleware, requireStoreAccess, bultosRoutes);
app.use("/api/comprobantes", authMiddleware, requireStoreAccess, comprobantesRoutes);
app.use("/api/invoices", authMiddleware, requireStoreAccess, invoicesRoutes);
app.use("/api/plantillas", authMiddleware, requireStoreAccess, plantillasRoutes);
app.use("/api/company", authMiddleware, requireStoreAccess, companyRoutes);
app.use("/api/afip", authMiddleware, requireStoreAccess, afipRoutes);
app.use("/api/price-lists", authMiddleware, requireStoreAccess, priceListsRoutes);
app.use("/api/users", authMiddleware, requireStoreAccess, usersRoutes);
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
