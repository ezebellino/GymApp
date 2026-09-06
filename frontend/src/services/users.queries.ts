import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  activateMembership,
  cancelMembership,
  createUser,
  fetchUser,
  fetchUsers,
  inviteUser,
  updateUser,
  verifyUserContact,
  type CreateUserInput,
  type UpdateUserInput,
  type UsersParams,
} from "./users";
import { queryKeys } from "./queryKeys";

export function useUsersQuery(params: UsersParams) {
  return useQuery({
    queryKey: queryKeys.users.list(params),
    queryFn: () => fetchUsers(params),
    // Evita que la tabla parpadee al paginar o tipear en el buscador: se
    // mantiene la pagina anterior mientras llega la nueva (dec. 4).
    placeholderData: keepPreviousData,
  });
}

export function useUserQuery(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.users.detail(id ?? ""),
    queryFn: () => fetchUser(id as string),
    enabled: Boolean(id),
  });
}

export function useCreateUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateUserInput) => createUser(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
}

export function useUpdateUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateUserInput }) => updateUser(id, input),
    onSuccess: () => {
      // Editar un usuario invalida tambien payments/attendance: sus filas
      // embeben `user`, asi que un cambio de nombre las deja mintiendo si no
      // se invalidan (dec. 6 heredada de clients.ts).
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.payments.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all });
    },
  });
}

export function useCancelMembershipMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, cancelledAt }: { id: string; cancelledAt?: string | null }) =>
      cancelMembership(id, cancelledAt),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
}

export function useActivateMembershipMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => activateMembership(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
}

export function useInviteUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => inviteUser(id),
    onSuccess: () => {
      // Invitar mueve `invitation_status` de `none`/`expired` a `pending`: la
      // card de la ficha necesita reflejarlo sin recargar (design D4).
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
}

export function useVerifyContactMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => verifyUserContact(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
}
