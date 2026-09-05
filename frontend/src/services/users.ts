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

export async function activateMembership(id: string): Promise<User> {
  const { data } = await api.post<User>(`/users/${id}/membership/activate`, {});
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
