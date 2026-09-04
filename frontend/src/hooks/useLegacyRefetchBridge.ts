import { useEffect } from "react";
import { queryClient } from "@/lib/queryClient";
import { queryKeys } from "@/services/queryKeys";

// Puente temporal (dec. 13): `NewPaymentDialog` y `UserCard` (fuera de
// alcance de este change) siguen emitiendo `"payments:created"` despues de
// cobrar. Mientras no se migren a `useMutation`, este es el unico oyente en
// toda la app y traduce el evento a una invalidacion de react-query.
//
// TODO(change siguiente): borrar este hook y su montaje en App.jsx cuando
// esos dialogos pasen a `useCreatePaymentMutation`.
export function useLegacyRefetchBridge() {
  useEffect(() => {
    const handlePaymentsCreated = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.payments.all });
    };

    window.addEventListener("payments:created", handlePaymentsCreated);
    return () => {
      window.removeEventListener("payments:created", handlePaymentsCreated);
    };
  }, []);
}
