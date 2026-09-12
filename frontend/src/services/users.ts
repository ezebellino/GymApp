import api from "../lib/http";
import type { MembershipStatus, Role, User } from "@/types";
import { readTotalCount, type PaginatedResult } from "./pagination";

export type UsersParams = {
  q?: string;
  role?: Role;
  membership_status?: MembershipStatus;
  limit?: number;
  offset?: number;
};

export async function fetchUsers(
  params: UsersParams = {},
): Promise<PaginatedResult<User>> {
  const { q, role, membership_status, limit = 10, offset = 0 } = params;
  const { data, headers } = await api.get<User[]>("/users/", {
    params: { q, role, membership_status, limit, offset },
  });

  return { items: data, total: readTotalCount(headers, data.length) };
}

export async function fetchUser(id: string): Promise<User> {
  const { data } = await api.get<User>(`/users/${id}`);
  return data;
}

export type CreateUserInput = {
  first_name: string;
  last_name?: string | null;
  role: Role;
  email?: string | null;
  phone?: string | null;
  birth_date?: string | null;
  weight_kg?: number | null;
  height_cm?: number | null;
  password?: string;
  // `membership-plans`: obligatorio en el backend solo cuando `role ===
  // "member"` (se valida ahí, no acá — ver `CreateUserDialog`).
  membership_plan_id?: string | null;
};

export async function createUser(input: CreateUserInput): Promise<User> {
  const { data } = await api.post<User>("/users", input);
  return data;
}

export type UpdateUserInput = Partial<CreateUserInput>;

export async function updateUser(id: string, input: UpdateUserInput): Promise<User> {
  const { data } = await api.patch<User>(`/users/${id}`, input);
  return data;
}

export async function cancelMembership(id: string, cancelledAt?: string | null): Promise<User> {
  const { data } = await api.post<User>(
    `/users/${id}/membership/cancel`,
    cancelledAt ? { cancelled_at: cancelledAt } : {},
  );
  return data;
}

export async function activateMembership(
  id: string,
  membershipPlanId?: string
): Promise<User> {
  // D2.2: si el usuario no tiene plan, `membership_plan_id` lo asigna y activa
  // en la misma operación; si ya tiene plan, se omite y se comporta como
  // siempre (reactivación simple).
  const { data } = await api.post<User>(`/users/${id}/membership/activate`, {
    ...(membershipPlanId ? { membership_plan_id: membershipPlanId } : {}),
  });
  return data;
}

export type InviteUserResult = {
  email_link: string;
  phone_link: string;
  expires_at: string;
};

export async function inviteUser(id: string): Promise<InviteUserResult> {
  const { data } = await api.post<InviteUserResult>(`/users/${id}/invitation`, {});
  return data;
}

export async function verifyUserContact(id: string): Promise<User> {
  const { data } = await api.post<User>(`/users/${id}/contact/verify`, {});
  return data;
}

// `membership-plans` (D2): mismo endpoint sirve al cambio de plan y a la
// asignación inicial de un miembro preexistente sin plan (D3).
export async function changeUserPlan(id: string, membershipPlanId: string): Promise<User> {
  const { data } = await api.post<User>(`/users/${id}/plan`, {
    membership_plan_id: membershipPlanId,
  });
  return data;
}
