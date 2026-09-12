import type { FC } from "react";
import { Card } from "@/components/ui/card";

// Placeholder único de las secciones que quedaron vacías a la espera de una
// iteración futura (Seguimiento, Asistencias, Reportes). La sección sigue
// existiendo en el Sidebar y en el router a propósito: el usuario la ve, entra
// y entiende que está pendiente, en vez de encontrarse con un 404 o con una
// entrada que desaparece y reaparece entre releases.
type ComingSoonProps = {
  title: string;
  description: string;
  icon: FC<{ size?: number; className?: string }>;
};

export default function ComingSoon({ title, description, icon: Icon }: ComingSoonProps) {
  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-headline-lg font-extrabold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="text-body-sm text-muted-foreground">{description}</p>
      </header>

      <Card className="grid place-items-center border-dashed border-border bg-surface-1/60 px-6 py-16 text-center">
        <div className="max-w-md space-y-4">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary-strong">
            <Icon size={24} />
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-2/60 px-3 py-1 text-label-caps uppercase text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
            To Do
          </span>
          <p className="text-body-sm text-muted-foreground">
            Esta sección todavía no está disponible. Se va a trabajar en una
            iteración futura.
          </p>
        </div>
      </Card>
    </section>
  );
}
