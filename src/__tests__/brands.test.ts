import { describe, it, expect, beforeEach, vi } from "vitest";
import { useBrandsStore } from "@/store/brands";

vi.mock("@/lib/api", () => {
  let nextId = 1;
  return {
    api: {
      get: vi.fn(() => Promise.resolve([])),
      post: vi.fn((_path: string, data: unknown) =>
        Promise.resolve({ ...(data as object), id: nextId++ }),
      ),
      put: vi.fn(() => Promise.resolve(undefined)),
      del: vi.fn(() => Promise.resolve(undefined)),
    },
  };
});

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

const STORE_A = "store_1";
const STORE_B = "store_2";

function resetStore() {
  useBrandsStore.setState({ brands: [] });
}

beforeEach(() => {
  resetStore();
});

// ──────────────────────────────────────────────
// Brands CRUD
// ──────────────────────────────────────────────

describe("Brands CRUD", () => {
  it("creates a brand with a name and store_id", async () => {
    const store = useBrandsStore.getState();
    const brand = await store.addBrand({
      name: "Coca-Cola",
      store_id: STORE_A,
    });

    expect(brand.name).toBe("Coca-Cola");
    expect(brand.store_id).toBe(STORE_A);

    const brands = useBrandsStore.getState().brands;
    expect(brands).toHaveLength(1);
  });

  it("updates a brand's name", async () => {
    const store = useBrandsStore.getState();
    const brand = await store.addBrand({
      name: "Coca-Cola",
      store_id: STORE_A,
    });

    await useBrandsStore.getState().updateBrand(brand.id, {
      name: "Coca-Cola Zero",
    });

    const updated = useBrandsStore
      .getState()
      .brands.find((b) => b.id === brand.id);
    expect(updated?.name).toBe("Coca-Cola Zero");
  });

  it("deletes a brand", async () => {
    const store = useBrandsStore.getState();
    const brand = await store.addBrand({
      name: "Coca-Cola",
      store_id: STORE_A,
    });

    await useBrandsStore.getState().deleteBrand(brand.id);

    const remaining = useBrandsStore.getState().brands;
    expect(remaining.find((b) => b.id === brand.id)).toBeUndefined();
  });

  it("lists brands alphabetically by name", async () => {
    const store = useBrandsStore.getState();
    await store.addBrand({ name: "Pepsi", store_id: STORE_A });
    await store.addBrand({ name: "Coca-Cola", store_id: STORE_A });
    await store.addBrand({ name: "Seven Up", store_id: STORE_A });

    const result = useBrandsStore.getState().getBrandsByStore(STORE_A);
    expect(result).toHaveLength(3);
    expect(result[0].name).toBe("Coca-Cola");
    expect(result[1].name).toBe("Pepsi");
    expect(result[2].name).toBe("Seven Up");
  });
});

// ──────────────────────────────────────────────
// Duplicate name rejection
// ──────────────────────────────────────────────

describe("Duplicate brand name", () => {
  it("rejects a duplicate brand name in the same store", async () => {
    const store = useBrandsStore.getState();
    await store.addBrand({ name: "Coca-Cola", store_id: STORE_A });

    await expect(store.addBrand({ name: "Coca-Cola", store_id: STORE_A })).rejects.toThrow(/already exists/);
  });

  it("allows same brand name in different stores", async () => {
    const store = useBrandsStore.getState();
    await store.addBrand({ name: "Coca-Cola", store_id: STORE_A });

    await expect(store.addBrand({ name: "Coca-Cola", store_id: STORE_B })).resolves.toBeDefined();

    const storeBBrands = useBrandsStore.getState().getBrandsByStore(STORE_B);
    expect(storeBBrands).toHaveLength(1);
    expect(storeBBrands[0].name).toBe("Coca-Cola");
  });

  it("rejects duplicate name on update", async () => {
    const store = useBrandsStore.getState();
    const b1 = await store.addBrand({ name: "Coca-Cola", store_id: STORE_A });
    await store.addBrand({ name: "Pepsi", store_id: STORE_A });

    await expect(useBrandsStore.getState().updateBrand(b1.id, { name: "Pepsi" })).rejects.toThrow(/already exists/);
  });

  it("allows updating a brand to its own name (no-op)", async () => {
    const store = useBrandsStore.getState();
    const brand = await store.addBrand({ name: "Coca-Cola", store_id: STORE_A });

    await expect(useBrandsStore.getState().updateBrand(brand.id, { name: "Coca-Cola" })).resolves.toBeUndefined();
  });
});

// ──────────────────────────────────────────────
// Store isolation
// ──────────────────────────────────────────────

describe("Store isolation", () => {
  it("brands are isolated per store", async () => {
    const store = useBrandsStore.getState();
    await store.addBrand({ name: "Coca-Cola", store_id: STORE_A });
    await store.addBrand({ name: "Pepsi", store_id: STORE_B });

    const storeABrands = useBrandsStore.getState().getBrandsByStore(STORE_A);
    const storeBBrands = useBrandsStore.getState().getBrandsByStore(STORE_B);

    expect(storeABrands).toHaveLength(1);
    expect(storeABrands[0].name).toBe("Coca-Cola");

    expect(storeBBrands).toHaveLength(1);
    expect(storeBBrands[0].name).toBe("Pepsi");
  });

  it("querying store A brands from store B returns empty", async () => {
    const store = useBrandsStore.getState();
    await store.addBrand({ name: "Coca-Cola", store_id: STORE_A });

    const storeBBrands = useBrandsStore.getState().getBrandsByStore(STORE_B);
    expect(storeBBrands).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────
// Edge cases
// ──────────────────────────────────────────────

describe("Brand edge cases", () => {
  it("can have multiple brands in the same store", async () => {
    const store = useBrandsStore.getState();
    await store.addBrand({ name: "Brand A", store_id: STORE_A });
    await store.addBrand({ name: "Brand B", store_id: STORE_A });
    await store.addBrand({ name: "Brand C", store_id: STORE_A });

    const brands = useBrandsStore.getState().getBrandsByStore(STORE_A);
    expect(brands).toHaveLength(3);
  });

  it("deleting unused brand has no side effects", async () => {
    const store = useBrandsStore.getState();
    const brand = await store.addBrand({ name: "Unused", store_id: STORE_A });

    await useBrandsStore.getState().deleteBrand(brand.id);

    const remaining = useBrandsStore.getState().brands;
    expect(remaining).toHaveLength(0);
  });
});
