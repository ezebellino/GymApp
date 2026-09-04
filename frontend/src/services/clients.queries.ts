import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createClient,
  fetchClients,
  updateClient,
  type ClientsParams,
  type CreateClientInput,
  type UpdateClientInput,
} from "./clients";
import { queryKeys } from "./queryKeys";

export function useClientsQuery(params: ClientsParams) {
  return useQuery({
    queryKey: queryKeys.clients.list(params),
    queryFn: () => fetchClients(params),
    // Evita que la tabla parpadee al paginar o tipear en el buscador: se
    // mantiene la pagina anterior mientras llega la nueva (dec. 4).
    placeholderData: keepPreviousData,
  });
}

export function useCreateClientMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateClientInput) => createClient(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
    },
  });
}

export function useUpdateClientMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateClientInput }) =>
      updateClient(id, input),
    onSuccess: () => {
      // Editar un cliente invalida tambien payments/attendance: sus filas
      // embeben `client` (`Payment.client`, `Attendance.client`), asi que un
      // cambio de nombre las deja mintiendo si no se invalidan (dec. 6).
      queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.payments.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all });
    },
  });
}
