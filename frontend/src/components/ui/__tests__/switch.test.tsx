import { useState } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Switch } from "@/components/ui/switch";

function Controlled() {
  const [checked, setChecked] = useState(false);
  return <Switch checked={checked} onCheckedChange={setChecked} />;
}

describe("Switch", () => {
  it("expone role=switch y aria-checked, y togglea al click", () => {
    render(<Controlled />);
    const el = screen.getByRole("switch");
    expect(el).toHaveAttribute("aria-checked", "false");
    expect(el).toHaveAttribute("data-state", "unchecked");

    fireEvent.click(el);
    expect(el).toHaveAttribute("aria-checked", "true");
    expect(el).toHaveAttribute("data-state", "checked");

    fireEvent.click(el);
    expect(el).toHaveAttribute("aria-checked", "false");
  });

  it("no togglea si está disabled", () => {
    render(<Switch checked={false} onCheckedChange={() => {}} disabled />);
    const el = screen.getByRole("switch");
    fireEvent.click(el);
    expect(el).toHaveAttribute("aria-checked", "false");
  });
});
