import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ListPageLayout from "@/components/ListPageLayout";

describe("ListPageLayout", () => {
  it("renderiza título, adorno, total y acción primaria en el header; toolbar, children y footer en orden", () => {
    const { container } = render(
      <ListPageLayout
        title="Usuarios"
        titleAdornment={<span data-testid="adornment">i</span>}
        count="10 usuarios"
        primaryAction={<button type="button">Crear usuario</button>}
        toolbar={<div data-testid="toolbar">Buscar</div>}
        footer={<div data-testid="footer">Paginación</div>}
      >
        <div data-testid="children">Tabla</div>
      </ListPageLayout>
    );

    const heading = screen.getByRole("heading", { name: "Usuarios" });
    expect(heading.tagName).toBe("H1");

    // La raíz de la plantilla es una Card (dec. 18): la vista entera —no
    // solo la tabla— vive dentro de un único panel Level 1.
    const card = container.querySelector('[data-slot="card"]');
    expect(card).not.toBeNull();

    const header = container.querySelector("header");
    expect(header).not.toBeNull();
    expect(card).toContainElement(header);
    expect(header).toContainElement(heading);
    expect(header).toContainElement(screen.getByTestId("adornment"));
    expect(header).toContainElement(screen.getByText("10 usuarios"));
    expect(header).toContainElement(
      screen.getByRole("button", { name: "Crear usuario" })
    );

    // `children` (la tabla) queda dentro del marco interno, que vuelve a ser
    // un `div` (dec. 18): `flex-1 min-h-0` sigue siendo lo que hace que el
    // scroll interno funcione.
    const frame = screen.getByTestId("children").parentElement;
    expect(frame?.className).toContain("min-h-0");
    expect(frame?.className).toContain("overflow-hidden");
    expect(card).toContainElement(frame!);

    // Toolbar y footer también quedan dentro de la Card.
    expect(card).toContainElement(screen.getByTestId("toolbar"));
    expect(card).toContainElement(screen.getByTestId("footer"));

    // Orden de secciones: header, toolbar, marco de la tabla, footer.
    const children = Array.from(card?.children ?? []);
    const toolbarWrapper = screen.getByTestId("toolbar").parentElement;
    const footerWrapper = screen.getByTestId("footer").parentElement;
    expect(children.indexOf(header!)).toBeLessThan(
      children.indexOf(toolbarWrapper!)
    );
    expect(children.indexOf(toolbarWrapper!)).toBeLessThan(
      children.indexOf(frame!)
    );
    expect(children.indexOf(frame!)).toBeLessThan(
      children.indexOf(footerWrapper!)
    );
  });

  it("no renderiza los slots opcionales que no se pasan", () => {
    render(
      <ListPageLayout title="Título">
        <div>Tabla</div>
      </ListPageLayout>
    );

    expect(screen.queryByText("usuarios")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
