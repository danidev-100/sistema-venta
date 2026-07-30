import { describe, it, expect, beforeEach } from "vitest";
import { useProveedoresStore } from "@/store/proveedores";

function resetStore() {
  useProveedoresStore.setState({ proveedores: [] });
}

beforeEach(() => {
  resetStore();
});

describe("Proveedores CRUD", () => {
  it("adds a proveedor with all required fields", () => {
    const p = useProveedoresStore.getState().addProveedor({
      name: "Distribuidora SRL",
      phone: "123456789",
      email: "info@distri.com",
      address: "Av. Siempre Viva 123",
      cuit: "30-12345678-9",
      store_id: "store_1",
    });

    expect(p.id).toBeGreaterThan(0);
    expect(p.name).toBe("Distribuidora SRL");
    expect(p.phone).toBe("123456789");
    expect(p.email).toBe("info@distri.com");
    expect(p.address).toBe("Av. Siempre Viva 123");
    expect(p.cuit).toBe("30-12345678-9");
    expect(p.store_id).toBe("store_1");
  });

  it("increments id for each new proveedor", () => {
    const p1 = useProveedoresStore.getState().addProveedor({
      name: "Proveedor A",
      phone: "",
      email: "",
      address: "",
      cuit: "",
      store_id: "store_1",
    });
    const p2 = useProveedoresStore.getState().addProveedor({
      name: "Proveedor B",
      phone: "",
      email: "",
      address: "",
      cuit: "",
      store_id: "store_1",
    });

    expect(p2.id).toBe(p1.id + 1);
  });

  it("rejects duplicate name in same store", () => {
    useProveedoresStore.getState().addProveedor({
      name: "Duplicado",
      phone: "",
      email: "",
      address: "",
      cuit: "",
      store_id: "store_1",
    });

    expect(() => {
      useProveedoresStore.getState().addProveedor({
        name: "Duplicado",
        phone: "",
        email: "",
        address: "",
        cuit: "",
        store_id: "store_1",
      });
    }).toThrow(/ya existe/i);
  });

  it("allows same name in different stores", () => {
    useProveedoresStore.getState().addProveedor({
      name: "Mismo nombre",
      phone: "",
      email: "",
      address: "",
      cuit: "",
      store_id: "store_1",
    });

    const p2 = useProveedoresStore.getState().addProveedor({
      name: "Mismo nombre",
      phone: "",
      email: "",
      address: "",
      cuit: "",
      store_id: "store_2",
    });

    expect(p2.id).toBeGreaterThan(0);
  });

  it("updates an existing proveedor", () => {
    const p = useProveedoresStore.getState().addProveedor({
      name: "Original",
      phone: "111",
      email: "a@a.com",
      address: "",
      cuit: "",
      store_id: "store_1",
    });

    useProveedoresStore.getState().updateProveedor(p.id, {
      name: "Actualizado",
      phone: "222",
    });

    const updated = useProveedoresStore
      .getState()
      .proveedores.find((x) => x.id === p.id)!;
    expect(updated.name).toBe("Actualizado");
    expect(updated.phone).toBe("222");
    expect(updated.email).toBe("a@a.com");
  });

  it("rejects update to duplicate name", () => {
    useProveedoresStore.getState().addProveedor({
      name: "Uno",
      phone: "",
      email: "",
      address: "",
      cuit: "",
      store_id: "store_1",
    });
    const p2 = useProveedoresStore.getState().addProveedor({
      name: "Dos",
      phone: "",
      email: "",
      address: "",
      cuit: "",
      store_id: "store_1",
    });

    expect(() => {
      useProveedoresStore.getState().updateProveedor(p2.id, { name: "Uno" });
    }).toThrow(/ya existe/i);
  });

  it("deletes a proveedor", () => {
    const p = useProveedoresStore.getState().addProveedor({
      name: "To delete",
      phone: "",
      email: "",
      address: "",
      cuit: "",
      store_id: "store_1",
    });

    useProveedoresStore.getState().deleteProveedor(p.id);
    expect(
      useProveedoresStore.getState().proveedores.find((x) => x.id === p.id),
    ).toBeUndefined();
  });

  it("silently ignores deleting non-existent proveedor", () => {
    useProveedoresStore.getState().addProveedor({
      name: "Keep me",
      phone: "",
      email: "",
      address: "",
      cuit: "",
      store_id: "store_1",
    });

    useProveedoresStore.getState().deleteProveedor(999);
    expect(useProveedoresStore.getState().proveedores).toHaveLength(1);
  });
});

describe("getProveedoresByStore", () => {
  beforeEach(() => {
    useProveedoresStore.getState().addProveedor({
      name: "Zeta",
      phone: "",
      email: "",
      address: "",
      cuit: "",
      store_id: "store_1",
    });
    useProveedoresStore.getState().addProveedor({
      name: "Alpha",
      phone: "",
      email: "",
      address: "",
      cuit: "",
      store_id: "store_1",
    });
    useProveedoresStore.getState().addProveedor({
      name: "Otra tienda",
      phone: "",
      email: "",
      address: "",
      cuit: "",
      store_id: "store_2",
    });
  });

  it("returns only proveedores for the given store, sorted by name", () => {
    const result = useProveedoresStore
      .getState()
      .getProveedoresByStore("store_1");
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Alpha");
    expect(result[1].name).toBe("Zeta");
  });

  it("returns empty array for store with no proveedores", () => {
    const result = useProveedoresStore
      .getState()
      .getProveedoresByStore("store_3");
    expect(result).toHaveLength(0);
  });
});
