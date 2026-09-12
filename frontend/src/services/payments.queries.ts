import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createPayment,
  deletePayment,
  fetchPayments,
  fetchPaymentsKpis,
  fetchPaymentsSummary,
  type CreatePaymentInput,
  type PaymentsParams,
  type PaymentsPeriod,
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

// `rebuild-payments-with-plan-pricing` (D3.4): indicadores del período
// seleccionado en la vista Pagos.
export function usePaymentsSummaryQuery(period: PaymentsPeriod) {
  return useQuery({
    queryKey: queryKeys.payments.summary(period),
    queryFn: () => fetchPaymentsSummary(period),
    placeholderData: keepPreviousData,
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

// Anular un pago (D3.5, invariante I9): invalida también `queryKeys.users.all`
// porque el indicador de cuota de la ficha/listado depende del pago que quede
// como más reciente tras la baja.
export function useDeletePaymentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deletePayment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.payments.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
}
