import api from "../lib/http";
import type { Client } from "@/types";

export async function fetchClients(params: {
  q?: string;
  limit?: number;
  offset?: number;
}) {
  const { q, limit = 10, offset = 0 } = params ?? {};
  const { data, headers } = await api.get<Client[]>("/clients/", {
    params: { q, limit, offset },
  });

  // El backend coloca el total en esta cabecera
  const totalHeader =
    (headers["x-total-count"] as string) ??
    (headers["X-Total-Count"] as unknown as string);
  const total = totalHeader ? Number(totalHeader) : data.length;

  return { items: data, total };
}
