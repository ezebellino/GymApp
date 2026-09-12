import { useEffect } from "react";
import { queryClient } from "@/lib/queryClient";
import { queryKeys } from "@/services/queryKeys";

// Puente temporal (dec. 13): el "pago rápido" de `UserCard` (fuera de
// alcance de `rebuild-payments-with-plan-pricing`, `api.post` directo) sigue
// emitiendo `"payments:created"` despues de cobrar. `PaymentDialog` también
// lo emite (D5.2), aunque ya invalida por `useCreatePaymentMutation` —se deja
// por si algún otro oyente legacy lo necesita. Mientras el pago rápido no se
// migre a `useMutation`, este es el unico oyente en toda la app y traduce el
// evento a una invalidacion de react-query.
//
// TODO(change siguiente): borrar este hook y su montaje en App.jsx cuando
// el pago rápido de `UserCard` pase a `useCreatePaymentMutation`.
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
