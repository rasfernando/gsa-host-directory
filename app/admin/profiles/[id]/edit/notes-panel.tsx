import { createClient } from "@/lib/supabase/server";
import { addNote, deleteNote } from "../../actions";

// Internal log on a host profile: what's happening, requests, bookings, calls.
// Never shown to the school. Renders a notice until the migration is applied.

type Note = { id: string; body: string; created_at: string; created_by: string | null };

export async function NotesPanel({ profileId }: { profileId: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("host_notes")
    .select("id, body, created_at, created_by")
    .eq("host_profile_id", profileId)
    .order("created_at", { ascending: false });

  return (
    <section id="notes" className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-gray-900">Internal notes</h2>
      <p className="mt-0.5 text-xs text-gray-500">
        Calls, requests, bookings, anything the team should know. The school never sees this.
      </p>

      {error ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {error.code === "42P01"
            ? "Not set up yet: apply supabase/migrations/20261027_directory_v1.sql in Supabase and this panel will work."
            : error.message}
        </div>
      ) : (
        <>
          <form action={addNote} className="mt-4 flex items-start gap-2">
            <input type="hidden" name="profile_id" value={profileId} />
            <textarea
              id="note-body"
              name="body"
              rows={2}
              required
              placeholder="Add a note…"
              className="grow rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700">
              Add
            </button>
          </form>

          {(data ?? []).length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">No notes yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {(data as Note[]).map((n) => (
                <li key={n.id} className="rounded-lg bg-gray-50 px-4 py-3">
                  <p className="whitespace-pre-wrap text-sm text-gray-800">{n.body}</p>
                  <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                    <span>{new Date(n.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span>
                    <form action={deleteNote}>
                      <input type="hidden" name="profile_id" value={profileId} />
                      <input type="hidden" name="id" value={n.id} />
                      <button className="text-gray-400 hover:text-red-600">Delete</button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
