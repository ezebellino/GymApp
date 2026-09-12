import { PencilLine } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import RowActionButton from "../RowActionButton";
import { fireEvent, renderWithProviders, screen } from "../../test/renderWithProviders";

describe("RowActionButton", () => {
  it("expone el verbo como unico nombre accesible y como title", () => {
    renderWithProviders(<RowActionButton icon={PencilLine} label="Editar" onClick={vi.fn()} />);

    const button = screen.getByRole("button", { name: "Editar" });
    expect(button).toHaveAccessibleName("Editar");
    expect(button).toHaveAttribute("title", "Editar");
  });

  it("aplica el tinte destructivo solo cuando tone es destructive", () => {
    renderWithProviders(
      <RowActionButton icon={PencilLine} label="Borrar" tone="destructive" onClick={vi.fn()} />
    );
    const destructiveButton = screen.getByRole("button", { name: "Borrar" });
    expect(destructiveButton.className).toContain("border-destructive/30");

    renderWithProviders(<RowActionButton icon={PencilLine} label="Editar" onClick={vi.fn()} />);
    const neutralButton = screen.getByRole("button", { name: "Editar" });
    expect(neutralButton.className).not.toContain("border-destructive/30");
  });

  it("deshabilita el boton y usa el motivo como title cuando viene disabledReason", () => {
    renderWithProviders(
      <RowActionButton
        icon={PencilLine}
        label="Desactivar"
        disabledReason="No se puede desactivar el último plan activo"
        onClick={vi.fn()}
      />
    );

    const button = screen.getByRole("button", { name: "Desactivar" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "No se puede desactivar el último plan activo");
  });

  it("es un icon-button rounded-full sin texto visible", () => {
    const onClick = vi.fn();
    renderWithProviders(<RowActionButton icon={PencilLine} label="Editar" onClick={onClick} />);

    const button = screen.getByRole("button", { name: "Editar" });
    expect(button.className).toContain("rounded-full");
    expect(button.textContent).toBe("");

    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("mantiene el tinte destructivo en modo dark", () => {
    renderWithProviders(
      <RowActionButton icon={PencilLine} label="Borrar" tone="destructive" onClick={vi.fn()} />
    );

    const button = screen.getByRole("button", { name: "Borrar" });
    expect(button.classList).toContain("dark:bg-destructive/10");
    expect(button.classList).toContain("dark:border-destructive/30");
    expect(button.classList).not.toContain("dark:bg-input/30");
    expect(button.classList).not.toContain("dark:border-input");
  });

  it("no propaga el click a la fila que lo contiene", () => {
    const onClick = vi.fn();
    const onContainerClick = vi.fn();
    renderWithProviders(
      <div onClick={onContainerClick}>
        <RowActionButton icon={PencilLine} label="Editar" onClick={onClick} />
      </div>
    );

    fireEvent.click(screen.getByRole("button", { name: "Editar" }));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onContainerClick).not.toHaveBeenCalled();
  });
});
