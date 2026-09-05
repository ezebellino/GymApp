import { useState } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button">Afuera</button>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger aria-label="Ver leyenda">Info</PopoverTrigger>
        <PopoverContent>Contenido del popover</PopoverContent>
      </Popover>
    </>
  );
}

describe("Popover (sin Radix, sin portal)", () => {
  it("cerrado no renderiza el contenido", () => {
    render(<Harness />);
    expect(screen.queryByText("Contenido del popover")).toBeNull();
  });

  it("click en el trigger abre y pone aria-expanded=true", () => {
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Ver leyenda" });

    fireEvent.click(trigger);

    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Contenido del popover")).toBeInTheDocument();
  });

  // No hay `@testing-library/user-event` instalado (no se suma una
  // dependencia por un test) y jsdom no sintetiza el "click" que un
  // navegador real dispara al presionar Enter/Espacio sobre un botón
  // enfocado, así que "Enter y Espacio abren" no es verificable acá. Lo que
  // SÍ da esa garantía y es verificable es la semántica: el trigger es un
  // `<button>` nativo (no un `div role="button"`), así que la activación por
  // teclado la resuelve el navegador solo, sin código de este componente
  // (hallazgo 7 de verification.md, dec. 23).
  it("el trigger es un <button> nativo (la activación por Enter/Espacio la da esa semántica, no código propio)", () => {
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Ver leyenda" });

    expect(trigger.tagName).toBe("BUTTON");
  });

  it("Escape cierra y devuelve el foco al trigger", () => {
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Ver leyenda" });

    fireEvent.click(trigger);
    expect(screen.getByText("Contenido del popover")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByText("Contenido del popover")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("click afuera cierra", () => {
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Ver leyenda" });

    fireEvent.click(trigger);
    expect(screen.getByText("Contenido del popover")).toBeInTheDocument();

    fireEvent.pointerDown(screen.getByRole("button", { name: "Afuera" }));

    expect(screen.queryByText("Contenido del popover")).toBeNull();
  });
});
