import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

function Harness({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const [open, setOpen] = useState(true);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Titulo</DialogTitle>
          <DialogDescription>Descripcion</DialogDescription>
        </DialogHeader>
        <p>contenido</p>
        <DialogFooter>
          <Button onClick={() => setOpen(false)}>Cerrar footer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

describe("Dialog (sin Radix, sobre <dialog> nativo)", () => {
  it("abre via showModal y liga aria-labelledby/aria-describedby al titulo/descripcion", () => {
    render(<Harness onOpenChange={() => {}} />);
    const dialog = screen.getByRole("dialog", { hidden: true });
    const title = screen.getByText("Titulo");
    const description = screen.getByText("Descripcion");

    expect(dialog.hasAttribute("open")).toBe(true);
    expect(dialog.getAttribute("aria-labelledby")).toBe(title.id);
    expect(dialog.getAttribute("aria-describedby")).toBe(description.id);
  });

  it("clickear el backdrop (target = el propio <dialog>) cierra", () => {
    const onOpenChange = vi.fn();
    render(<Harness onOpenChange={onOpenChange} />);
    const dialog = screen.getByRole("dialog", { hidden: true });

    fireEvent.click(dialog);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("clickear contenido interno NO cierra", () => {
    const onOpenChange = vi.fn();
    render(<Harness onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByText("contenido"));

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("el boton X cierra", () => {
    const onOpenChange = vi.fn();
    render(<Harness onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByText("Close"));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("el evento nativo cancel (Escape) avisa via onOpenChange en vez de cerrar de un frame", () => {
    const onOpenChange = vi.fn();
    render(<Harness onOpenChange={onOpenChange} />);
    const dialog = screen.getByRole("dialog", { hidden: true });

    fireEvent(dialog, new Event("cancel", { cancelable: true }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("montado con open=false no lleva la clase grid (pisaría el display:none nativo del <dialog> cerrado)", () => {
    render(
      <Dialog open={false}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Titulo</DialogTitle>
            <DialogDescription>Descripcion</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );

    // El <dialog> no tiene `role="dialog"` expuesto por accesibilidad cuando
    // esta cerrado, asi que se busca por su data-slot en vez de por rol.
    const dialog = document.querySelector('[data-slot="dialog-content"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.hasAttribute("open")).toBe(false);
    expect(dialog?.className).toContain("hidden");
    expect(dialog?.className).not.toMatch(/(^|\s)grid(\s|$)/);
  });
});
