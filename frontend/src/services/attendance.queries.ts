import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  checkin,
  fetchAttendance,
  fetchAttendanceCount,
  type AttendanceParams,
  type CheckinInput,
  type PeriodRange,
} from "./attendance";
import { queryKeys } from "./queryKeys";

export function useAttendanceQuery(params: AttendanceParams) {
  return useQuery({
    queryKey: queryKeys.attendance.list(params),
    queryFn: () => fetchAttendance(params),
    placeholderData: keepPreviousData,
  });
}

export function useAttendanceCountQuery(period: PeriodRange) {
  return useQuery({
    queryKey: queryKeys.attendance.count(period),
    queryFn: () => fetchAttendanceCount(period),
  });
}

export function useCheckinMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CheckinInput) => checkin(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all });
    },
  });
}
