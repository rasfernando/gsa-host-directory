import { createClient } from "@/lib/supabase/server";

export type BookedWindow = {
  trip_id: string;
  start_date: string;
  end_date: string;
  num_students: number | null;
  places_held: number | null;
  status: string;
  is_own: boolean;
};

// A host school's booked date windows from active trips (via the
// SECURITY DEFINER RPC, so cross-organiser clashes are visible without
// exposing who booked).
export async function getBookedWindows(hostProfileId: string): Promise<BookedWindow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("host_booked_windows", {
    p_host_profile_id: hostProfileId,
  });
  return (data ?? []) as BookedWindow[];
}

// Inclusive date-range overlap: [s1,e1] vs [s2,e2].
function overlaps(s1: string, e1: string, s2: string, e2: string) {
  return s1 <= e2 && s2 <= e1;
}

// Windows (excluding the trip itself) that clash with a candidate stay.
export function clashesFor(
  windows: BookedWindow[],
  startDate: string,
  numDays: number,
  excludeTripId?: string
): BookedWindow[] {
  if (!startDate) return [];
  const end = new Date(startDate);
  end.setDate(end.getDate() + Math.max(numDays, 1) - 1);
  const endStr = end.toISOString().slice(0, 10);
  return windows.filter(
    (w) =>
      w.trip_id !== excludeTripId &&
      overlaps(startDate, endStr, w.start_date, w.end_date)
  );
}
