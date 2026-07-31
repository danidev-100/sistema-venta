// End-to-end test for all CRUD endpoints
// Run: node test-endpoints.mjs

const BASE = "http://localhost:3000/api";

// We need a real token — get it from login
async function getToken() {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "admin123" }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("LOGIN FAILED:", err);
    process.exit(1);
  }
  const data = await res.json();
  return data.token;
}

async function test(description, fn) {
  try {
    await fn();
    console.log(`  ✅ ${description}`);
  } catch (err) {
    console.log(`  ❌ ${description}: ${err.message}`);
  }
}

async function main() {
  console.log("\n🔐 Obteniendo token...");
  const token = await getToken();
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  const storeId = "store_1";

  console.log("\n=== USERS ===");
  await test("GET /users", async () => {
    const r = await fetch(`${BASE}/users`, { headers });
    if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
    const data = await r.json();
    if (!Array.isArray(data)) throw new Error("Expected array");
  });
  await test("POST /users (create)", async () => {
    const r = await fetch(`${BASE}/users`, { method: "POST", headers, body: JSON.stringify({ name: "test-user", password: "test123456", role: "custom", permissions: ["ventas"] }) });
    if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
    const data = await r.json();
    // Clean up
    await fetch(`${BASE}/users/${data.id}`, { method: "DELETE", headers });
  });

  console.log("\n=== PRODUCTS ===");
  let testProductId;
  await test("POST /products", async () => {
    const r = await fetch(`${BASE}/products`, { method: "POST", headers, body: JSON.stringify({ name: "Test Product", price: 100, cost_price: 50, stock: 10, store_id: storeId, sale_unit: "unit" }) });
    if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
    const data = await r.json();
    testProductId = data.id;
  });
  await test("GET /products", async () => {
    const r = await fetch(`${BASE}/products?storeId=${storeId}`, { headers });
    if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
  });
  if (testProductId) {
    await test("GET /products/:id", async () => {
      const r = await fetch(`${BASE}/products/${testProductId}`, { headers });
      if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
    });
    await test("PUT /products/:id", async () => {
      const r = await fetch(`${BASE}/products/${testProductId}`, { method: "PUT", headers, body: JSON.stringify({ price: 120 }) });
      if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
    });
    await test("DELETE /products/:id", async () => {
      const r = await fetch(`${BASE}/products/${testProductId}`, { method: "DELETE", headers });
      if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
    });
  }

  console.log("\n=== CUSTOMERS ===");
  let testCustomerId;
  await test("POST /customers", async () => {
    const r = await fetch(`${BASE}/customers`, { method: "POST", headers, body: JSON.stringify({ name: "Test Customer", store_id: storeId }) });
    if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
    const data = await r.json();
    testCustomerId = data.id;
  });
  await test("GET /customers", async () => {
    const r = await fetch(`${BASE}/customers?storeId=${storeId}`, { headers });
    if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
  });
  if (testCustomerId) {
    await test("PUT /customers/:id", async () => {
      const r = await fetch(`${BASE}/customers/${testCustomerId}`, { method: "PUT", headers, body: JSON.stringify({ phone: "123456789" }) });
      if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
    });
    await test("DELETE /customers/:id", async () => {
      const r = await fetch(`${BASE}/customers/${testCustomerId}`, { method: "DELETE", headers });
      if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
    });
  }

  console.log("\n=== PROVEEDORES ===");
  let testProveedorId;
  await test("POST /proveedores", async () => {
    const r = await fetch(`${BASE}/proveedores`, { method: "POST", headers, body: JSON.stringify({ name: "Test Supplier", store_id: storeId }) });
    if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
    const data = await r.json();
    testProveedorId = data.id;
  });
  await test("GET /proveedores", async () => {
    const r = await fetch(`${BASE}/proveedores?storeId=${storeId}`, { headers });
    if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
  });
  if (testProveedorId) {
    await test("DELETE /proveedores/:id", async () => {
      const r = await fetch(`${BASE}/proveedores/${testProveedorId}`, { method: "DELETE", headers });
      if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
    });
  }

  console.log("\n=== EXPENSES ===");
  let testExpenseId;
  await test("POST /expenses", async () => {
    const r = await fetch(`${BASE}/expenses`, { method: "POST", headers, body: JSON.stringify({ storeId, description: "Test expense", amount: 50, category: "Varios", date: "2026-07-30", paymentMethod: "cash" }) });
    if (!r.ok) {
      const text = await r.text();
      throw new Error(`${r.status}: ${text}`);
    }
    const data = await r.json();
    testExpenseId = data.id;
  });
  await test("GET /expenses", async () => {
    const r = await fetch(`${BASE}/expenses?storeId=${storeId}`, { headers });
    if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
  });
  if (testExpenseId) {
    await test("PUT /expenses/:id", async () => {
      const r = await fetch(`${BASE}/expenses/${testExpenseId}`, { method: "PUT", headers, body: JSON.stringify({ amount: 75 }) });
      if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
    });
    await test("DELETE /expenses/:id", async () => {
      const r = await fetch(`${BASE}/expenses/${testExpenseId}`, { method: "DELETE", headers });
      if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
    });
  }

  console.log("\n=== COMBOS ===");
  let testComboId;
  await test("POST /combos", async () => {
    const r = await fetch(`${BASE}/combos`, { method: "POST", headers, body: JSON.stringify({ name: "Test Combo", combo_price: 200, store_id: storeId, items: [] }) });
    if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
    const data = await r.json();
    testComboId = data.id;
  });
  await test("GET /combos", async () => {
    const r = await fetch(`${BASE}/combos?storeId=${storeId}`, { headers });
    if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
  });
  if (testComboId) {
    await test("DELETE /combos/:id", async () => {
      const r = await fetch(`${BASE}/combos/${testComboId}`, { method: "DELETE", headers });
      if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
    });
  }

  console.log("\n=== BULTOS ===");
  let testBultoId;
  await test("POST /bultos", async () => {
    const r = await fetch(`${BASE}/bultos`, { method: "POST", headers, body: JSON.stringify({ name: "Test Bulto", bulto_price: 150, store_id: storeId }) });
    if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
    const data = await r.json();
    testBultoId = data.id;
  });
  await test("GET /bultos", async () => {
    const r = await fetch(`${BASE}/bultos?storeId=${storeId}`, { headers });
    if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
  });
  if (testBultoId) {
    await test("DELETE /bultos/:id", async () => {
      const r = await fetch(`${BASE}/bultos/${testBultoId}`, { method: "DELETE", headers });
      if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
    });
  }

  console.log("\n=== PRICE LISTS ===");
  let testListId;
  await test("POST /price-lists", async () => {
    const r = await fetch(`${BASE}/price-lists`, { method: "POST", headers, body: JSON.stringify({ name: "Test List", store_id: storeId }) });
    if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
    const data = await r.json();
    testListId = data.id;
  });
  await test("GET /price-lists", async () => {
    const r = await fetch(`${BASE}/price-lists?storeId=${storeId}`, { headers });
    if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
  });
  if (testListId) {
    await test("GET /price-lists/:id/items", async () => {
      const r = await fetch(`${BASE}/price-lists/${testListId}/items`, { headers });
      if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
    });
    await test("DELETE /price-lists/:id", async () => {
      const r = await fetch(`${BASE}/price-lists/${testListId}`, { method: "DELETE", headers });
      if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
    });
  }

  console.log("\n=== CATEGORIES ===");
  let testCategoryId;
  await test("POST /categories", async () => {
    const r = await fetch(`${BASE}/categories`, { method: "POST", headers, body: JSON.stringify({ name: "Test Cat", store_id: storeId }) });
    if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
    const data = await r.json();
    testCategoryId = data.id;
  });
  await test("DELETE /categories/:id", async () => {
    const r = await fetch(`${BASE}/categories/${testCategoryId}`, { method: "DELETE", headers });
    if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
  });

  console.log("\n=== BRANDS ===");
  let testBrandId;
  await test("POST /brands", async () => {
    const r = await fetch(`${BASE}/brands`, { method: "POST", headers, body: JSON.stringify({ name: "Test Brand", store_id: storeId }) });
    if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
    const data = await r.json();
    testBrandId = data.id;
  });
  await test("DELETE /brands/:id", async () => {
    const r = await fetch(`${BASE}/brands/${testBrandId}`, { method: "DELETE", headers });
    if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
  });

  console.log("\n✅ ALL TESTS COMPLETED");
}

main().catch(console.error);
