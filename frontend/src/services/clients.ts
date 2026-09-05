import api from "../lib/http";
import type { Client } from "@/types";
import { readTotalCount, type PaginatedResult } from "./pagination";

export type ClientsParams = {
  q?: string;
  limit?: number;
  offset?: number;
};

export async function fetchClients(
  params: ClientsParams = {},
): Promise<PaginatedResult<Client>> {
  const { q, limit = 10, offset = 0 } = params;
  const { data, headers } = await api.get<Client[]>("/clients/", {
    params: { q, limit, offset },
  });

  return { items: data, total: readTotalCount(headers, data.length) };
}

export type CreateClientInput = {
  full_name: string;
  email: string | null;
  phone: string | null;
};

export async function createClient(input: CreateClientInput): Promise<Client> {
  const { data } = await api.post<Client>("/clients", input);
  return data;
}
