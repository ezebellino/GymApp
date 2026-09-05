import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createPayment,
  fetchPayments,
  fetchPaymentsKpis,
  type CreatePaymentInput,
  type PaymentsParams,
  type PeriodRange,
} from "./payments";
import { queryKeys } from "./queryKeys";

export function usePaymentsQuery(params: PaymentsParams) {
  return useQuery({
    queryKey: queryKeys.payments.list(params),
    queryFn: () => fetchPayments(params),
    placeholderData: keepPreviousData,
  });
}

export function usePaymentsKpisQuery(period: PeriodRange) {
  return useQuery({
    queryKey: queryKeys.payments.kpis(period),
    queryFn: () => fetchPaymentsKpis(period),
  });
}

export function useCreatePaymentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePaymentInput) => createPayment(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.payments.all });
    },
  });
}
