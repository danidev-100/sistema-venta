import app from "./app.js";

const PORT = parseInt(process.env.PORT || "3000", 10);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[server] Sistema de Ventas running on http://0.0.0.0:${PORT}`);
});
