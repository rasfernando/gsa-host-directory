"use client";

import { deleteDraftTrip } from "@/app/trips/actions";

// Delete a draft trip, with a confirm step. Drafts only — the server action
// re-checks status, so this never touches a reserved/paid trip.
export function ConfirmDeleteButton({ tripId }: { tripId: string }) {
  return (
    <form
      action={deleteDraftTrip}
      onSubmit={(e) => {
        if (!confirm("Delete this draft trip? This can't be undone.")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="trip_id" value={tripId} />
      <button
        className="rounded-lg border border-stone-200 px-2.5 py-1 text-xs font-medium text-stone-400 transition-colors duration-150 hover:border-stone-300 hover:text-warm-700"
        title="Delete draft"
      >
        Delete
      </button>
    </form>
  );
}
