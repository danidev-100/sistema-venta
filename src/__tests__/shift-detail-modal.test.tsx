import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ShiftDetailModal from "@/components/ShiftDetailModal";
import { formatCurrency } from "@/lib/format";
import type { CompletedSale } from "@/store";
import type { Shift } from "@/store/cash-closing";

function sale(overrides: Partial<CompletedSale> = {}): CompletedSale {
  return {
    id: 1,
    items: [],
    total: 0,
    subtotal: 0,
    iva: 0,
    discountPercent: 0,
    discountAmount: 0,
    paymentMethod: "cash",
    amountPaid: null,
    cashAmount: null,
    cardAmount: null,
    mercadopagoAmount: null,
    change: null,
    date: "2026-01-10T12:00:00.000Z",
    storeId: "s1",
    customerName: null,
    createdBy: "admin",
    status: "completed",
    priceListId: null,
    ...overrides,
  } as CompletedSale;
}

const shift = {
  id: 7,
  employee: "Cajero Noche",
  openTime: "2026-01-10T10:00:00.000Z",
  closeTime: "2026-01-10T14:00:00.000Z",
  status: "closed",
  storeId: "s1",
} as unknown as Shift;

describe("ShiftDetailModal", () => {
  it("shows the cashier, the products sold and how each sale was paid", () => {
    const sales = [
      sale({
        id: 1,
        paymentMethod: "cash",
        total: 2800,
        createdBy: "Cajero Noche",
        items: [
          {
            productId: 1,
            productName: "Coca-Cola 500ml",
            quantity: 2,
            unitPrice: 1400,
            subtotal: 2800,
            discountPercent: 0,
            saleUnit: "unit",
          },
        ],
      }),
      sale({
        id: 2,
        paymentMethod: "card",
        total: 10000,
        createdBy: "Cajero Noche",
        date: "2026-01-10T13:00:00.000Z",
        items: [
          {
            productId: 2,
            productName: "toner",
            quantity: 1,
            unitPrice: 10000,
            subtotal: 10000,
            discountPercent: 0,
            saleUnit: "unit",
          },
        ],
      }),
    ];

    render(<ShiftDetailModal shift={shift} sales={sales} onClose={() => {}} />);

    // Cashier and window
    expect(screen.getByRole("heading", { name: "Cajero Noche" })).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: /detalle del turno de cajero noche/i })).toBeInTheDocument();

    // Products sold, biggest money first
    const products = screen.getByRole("region", { name: /productos vendidos/i });
    expect(products).toHaveTextContent("toner");
    expect(products).toHaveTextContent("Coca-Cola 500ml");
    expect(products).toHaveTextContent("2 ×");

    // Payment breakdown counts each method
    const paid = screen.getByRole("region", { name: /cómo se cobró/i });
    expect(paid).toHaveTextContent(formatCurrency(2800));
    expect(paid).toHaveTextContent(formatCurrency(10000));
    expect(paid).toHaveTextContent("2 ventas");

    // Sale by sale tells how it was collected
    const rows = screen.getByRole("region", { name: /ventas del turno/i });
    expect(rows).toHaveTextContent("Efectivo");
    expect(rows).toHaveTextContent("Tarjeta");
  });

  it("ignores sales outside the shift window", () => {
    render(
      <ShiftDetailModal
        shift={shift}
        sales={[sale({ id: 9, total: 500, date: "2026-01-10T16:00:00.000Z" })]}
        onClose={() => {}}
      />,
    );

    const paid = screen.getByRole("region", { name: /cómo se cobró/i });
    expect(paid).toHaveTextContent("0 ventas");
    expect(screen.getByText(/no hay ventas registradas en este turno/i)).toBeInTheDocument();
    expect(formatCurrency(500)).not.toBe(formatCurrency(0));
  });

  it("closes from the header button and from the footer button", async () => {
    const onClose = vi.fn();
    render(<ShiftDetailModal shift={shift} sales={[]} onClose={onClose} />);

    await userEvent.click(screen.getByRole("button", { name: /cerrar detalle del turno/i }));
    await userEvent.click(screen.getByRole("button", { name: /^cerrar$/i }));

    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
