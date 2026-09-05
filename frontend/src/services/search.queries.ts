import { useQuery } from "@tanstack/react-query";
import { searchUsers } from "./search";
import { queryKeys } from "./queryKeys";

// Comparten cache entre si cuando el termino coincide (dec. 7): usado por las
// dos busquedas debounceadas del Dashboard (check-in rapido y cobro rapido).
export function useUsersSearchQuery(term: string, options?: { enabled?: boolean }) {
  const trimmed = term.trim();

  return useQuery({
    queryKey: queryKeys.users.search(trimmed),
    queryFn: () => searchUsers(trimmed),
    enabled: options?.enabled ?? trimmed.length > 0,
  });
}
