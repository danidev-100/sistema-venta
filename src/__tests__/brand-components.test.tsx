import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useBrandsStore } from "@/store/brands";
import BrandList from "@/components/BrandList";
import BrandForm from "@/components/BrandForm";
import { StoreProvider } from "@/store/context";

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function resetBrands() {
  useBrandsStore.setState({ brands: [] });
}

beforeEach(() => {
  resetBrands();
});

// ──────────────────────────────────────────────
// BrandList — empty state
// ──────────────────────────────────────────────

describe("BrandList — empty state", () => {
  it('shows empty state message when no brands exist', () => {
    render(
      <StoreProvider initialStoreId="store_1">
        <BrandList />
      </StoreProvider>,
    );

    expect(
      screen.getByText(/todavía no hay marcas/i),
    ).toBeInTheDocument();
  });

  it('shows a "+ Agregar Marca" button when empty', () => {
    render(
      <StoreProvider initialStoreId="store_1">
        <BrandList />
      </StoreProvider>,
    );

    expect(screen.getByText("+ Agregar Marca")).toBeInTheDocument();
  });

  it("does not render a table when empty", () => {
    render(
      <StoreProvider initialStoreId="store_1">
        <BrandList />
      </StoreProvider>,
    );

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

// ──────────────────────────────────────────────
// BrandForm — submit validation
// ──────────────────────────────────────────────

describe("BrandForm — submit validation", () => {
  it("shows error when submitting with empty name (create mode)", () => {
    const { container } = render(
      <StoreProvider initialStoreId="store_1">
        <BrandForm editBrand={null} onSaved={vi.fn()} onCancel={vi.fn()} />
      </StoreProvider>,
    );

    // Submit the form directly (bypasses HTML5 required validation on empty input)
    const form = container.querySelector("form")!;
    fireEvent.submit(form);

    expect(
      screen.getByText("El nombre de la marca no puede estar vacío"),
    ).toBeInTheDocument();
  });

  it("shows error when submitting with only spaces (create mode)", async () => {
    const user = userEvent.setup();

    render(
      <StoreProvider initialStoreId="store_1">
        <BrandForm editBrand={null} onSaved={vi.fn()} onCancel={vi.fn()} />
      </StoreProvider>,
    );

    const input = screen.getByPlaceholderText("Nombre de la marca");
    await user.type(input, "   ");
    await user.click(screen.getByRole("button", { name: /Crear/i }));

    expect(
      screen.getByText("El nombre de la marca no puede estar vacío"),
    ).toBeInTheDocument();
  });

  it("calls onSaved after creating a valid brand", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();

    render(
      <StoreProvider initialStoreId="store_1">
        <BrandForm editBrand={null} onSaved={onSaved} onCancel={vi.fn()} />
      </StoreProvider>,
    );

    const input = screen.getByPlaceholderText("Nombre de la marca");
    await user.type(input, "Nueva Marca");
    await user.click(screen.getByRole("button", { name: /Crear/i }));

    // Brand should be added to store
    const brands = useBrandsStore.getState().brands;
    expect(brands).toHaveLength(1);
    expect(brands[0].name).toBe("Nueva Marca");
    expect(onSaved).toHaveBeenCalled();
  });

  it("pre-fills name when editing and calls onSaved on submit", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();

    // Pre-populate a brand
    useBrandsStore.getState().addBrand({
      name: "Coca-Cola",
      store_id: "store_1",
    });
    const existingBrand = useBrandsStore.getState().brands[0];

    render(
      <StoreProvider initialStoreId="store_1">
        <BrandForm editBrand={existingBrand} onSaved={onSaved} onCancel={vi.fn()} />
      </StoreProvider>,
    );

    // Input should be pre-filled
    const input = screen.getByDisplayValue("Coca-Cola");
    expect(input).toBeInTheDocument();

    // Submit should call onSaved — button says "Actualizar" in edit mode
    await user.click(screen.getByRole("button", { name: /Actualizar/i }));
    expect(onSaved).toHaveBeenCalled();
  });
});
