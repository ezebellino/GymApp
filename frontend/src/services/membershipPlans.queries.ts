import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  activateMembershipPlan,
  addMembershipPlanPrice,
  createMembershipPlan,
  deactivateMembershipPlan,
  fetchMembershipPlan,
  fetchMembershipPlans,
  updateMembershipPlan,
  type AddMembershipPlanPriceInput,
  type CreateMembershipPlanInput,
  type MembershipPlansParams,
  type UpdateMembershipPlanInput,
} from "./membershipPlans";
import { queryKeys } from "./queryKeys";

export function useMembershipPlansQuery(params: MembershipPlansParams) {
  return useQuery({
    queryKey: queryKeys.membershipPlans.list(params),
    queryFn: () => fetchMembershipPlans(params),
    // Mismo criterio que `useUsersQuery`: evita el parpadeo al paginar/filtrar.
    placeholderData: keepPreviousData,
  });
}

export function useMembershipPlanQuery(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.membershipPlans.detail(id ?? ""),
    queryFn: () => fetchMembershipPlan(id as string),
    enabled: Boolean(id),
  });
}

// Toda mutación de plan invalida `queryKeys.membershipPlans.all` (design D4):
// el listado, el detalle y los selectores de plan de los diálogos de usuario
// dependen de la misma respuesta.

export function useCreateMembershipPlanMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateMembershipPlanInput) => createMembershipPlan(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.membershipPlans.all });
    },
  });
}

export function useUpdateMembershipPlanMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateMembershipPlanInput }) =>
      updateMembershipPlan(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.membershipPlans.all });
    },
  });
}

export function useAddMembershipPlanPriceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AddMembershipPlanPriceInput }) =>
      addMembershipPlanPrice(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.membershipPlans.all });
    },
  });
}

export function useDeactivateMembershipPlanMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deactivateMembershipPlan(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.membershipPlans.all });
    },
  });
}

export function useActivateMembershipPlanMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => activateMembershipPlan(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.membershipPlans.all });
    },
  });
}
