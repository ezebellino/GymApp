import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createClient,
  fetchClients,
  type ClientsParams,
  type CreateClientInput,
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
