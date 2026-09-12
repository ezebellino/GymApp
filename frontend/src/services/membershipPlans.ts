import api from "../lib/http";
import type { MembershipPlan, MembershipPlanDetail } from "@/types";
import { readTotalCount, type PaginatedResult } from "./pagination";

// Fetchers de planes de membresía (`add-membership-plans`, design D4). Mismo
// patrón que `services/users.ts`: funciones puras, `readTotalCount` para el
// listado paginado, nunca el `AxiosResponse` crudo.

export type MembershipPlansParams = {
  q?: string;
  is_active?: boolean;
  limit?: number;
  offset?: number;
};

export async function fetchMembershipPlans(
  params: MembershipPlansParams = {},
): Promise<PaginatedResult<MembershipPlan>> {
  const { q, is_active, limit = 50, offset = 0 } = params;
  const { data, headers } = await api.get<MembershipPlan[]>("/membership-plans/", {
    params: { q, is_active, limit, offset },
  });

  return { items: data, total: readTotalCount(headers, data.length) };
}

export async function fetchMembershipPlan(id: string): Promise<MembershipPlanDetail> {
  const { data } = await api.get<MembershipPlanDetail>(`/membership-plans/${id}`);
  return data;
}

export type CreateMembershipPlanInput = {
  name: string;
  description?: string | null;
  amount: number;
};

export async function createMembershipPlan(
  input: CreateMembershipPlanInput,
): Promise<MembershipPlan> {
  const { data } = await api.post<MembershipPlan>("/membership-plans/", input);
  return data;
}

export type UpdateMembershipPlanInput = {
  name?: string;
  description?: string | null;
};

export async function updateMembershipPlan(
  id: string,
  input: UpdateMembershipPlanInput,
): Promise<MembershipPlan> {
  const { data } = await api.patch<MembershipPlan>(`/membership-plans/${id}`, input);
  return data;
}

export type AddMembershipPlanPriceInput = {
  amount: number;
  effective_from?: string | null;
};

export async function addMembershipPlanPrice(
  id: string,
  input: AddMembershipPlanPriceInput,
): Promise<MembershipPlan["current_price"]> {
  const { data } = await api.post(`/membership-plans/${id}/prices`, input);
  return data;
}

export async function deactivateMembershipPlan(id: string): Promise<MembershipPlan> {
  const { data } = await api.post<MembershipPlan>(`/membership-plans/${id}/deactivate`, {});
  return data;
}

export async function activateMembershipPlan(id: string): Promise<MembershipPlan> {
  const { data } = await api.post<MembershipPlan>(`/membership-plans/${id}/activate`, {});
  return data;
}
