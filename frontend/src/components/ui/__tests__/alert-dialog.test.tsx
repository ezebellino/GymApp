import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function Harness({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const [open, setOpen] = useState(true);
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminar cliente</AlertDialogTitle>
          <AlertDialogDescription>Seguro?</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setOpen(false)}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction onClick={() => setOpen(false)}>
            Confirmar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

describe("AlertDialog (sin Radix, sobre <dialog> nativo)", () => {
  it("expone role=alertdialog y liga aria-labelledby/aria-describedby", () => {
    render(<Harness onOpenChange={() => {}} />);
    const dialog = screen.getByRole("alertdialog", { hidden: true });
    const title = screen.getByText("Eliminar cliente");
    const description = screen.getByText("Seguro?");

    expect(dialog.getAttribute("aria-labelledby")).toBe(title.id);
    expect(dialog.getAttribute("aria-describedby")).toBe(description.id);
  });

  it("clickear el fondo del dialogo NO cierra (a diferencia de Dialog)", () => {
    const onOpenChange = vi.fn();
    render(<Harness onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByRole("alertdialog", { hidden: true }));

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("Action/Cancel son <button> de shadcn (clases de Button), no un nodo extra", () => {
    render(<Harness onOpenChange={() => {}} />);

    const cancelBtn = screen.getByText("Cancelar");
    const actionBtn = screen.getByText("Confirmar");

    expect(cancelBtn.tagName).toBe("BUTTON");
    expect(cancelBtn.className).toContain("border"); // variant outline
    expect(actionBtn.className).toContain("bg-primary"); // variant default
  });

  it("Cancelar corre su propio onClick (no hay auto-cierre implicito sin Radix debajo)", async () => {
    // AlertDialogAction/Cancel son un <Button> liso: quien los usa decide
    // cuando cerrar (asi lo hace useConfirm.tsx: `onClick={() => settle(false)}`
    // llama a su propio setOpen, no pasa por el onOpenChange de <AlertDialog>).
    render(<Harness onOpenChange={() => {}} />);
    const dialog = screen.getByRole("alertdialog", { hidden: true });

    fireEvent.click(screen.getByText("Cancelar"));

    await waitFor(() => expect(dialog.hasAttribute("open")).toBe(false));
  });
});
