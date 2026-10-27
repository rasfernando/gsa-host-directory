import { createClient } from "@/lib/supabase/server";
import { addAvailability, setAvailabilityStatus, deleteAvailability } from "../../actions";

// Dates a host can take a group, each available or reserved (and for whom).
// Renders a plain notice until migration 20261027_directory_v1.sql is applied.

type Window = {
  id: string;
  starts_on: string;
  ends_on: string;
  status: "available" | "reserved";
  reserved_for: string | null;
  note: string | null;
};

const fmt = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

const inputCls = "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm";
const labelCls = "block text-xs font-medium text-gray-600";

export async function AvailabilityPanel({ profileId }: { profileId: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("host_availability")
    .select("id, starts_on, ends_on, status, reserved_for, note")
    .eq("host_profile_id", profileId)
    .order("starts_on");

  const today = new Date().toISOString().slice(0, 10);

  return (
    <section id="availability" className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-gray-900">Availability</h2>
      <p className="mt-0.5 text-xs text-gray-500">
        Dates this school can host. Mark a window reserved to hold it for someone.
      </p>

      {error ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {error.code === "42P01"
            ? "Not set up yet: apply supabase/migrations/20261027_directory_v1.sql in Supabase and this panel will work."
            : error.message}
        </div>
      ) : (
        <>
          {(data ?? []).length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">No dates added yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-gray-100 rounded-lg border border-gray-100">
              {(data as Window[]).map((w) => {
                const past = w.ends_on < today;
                return (
                  <li key={w.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${past ? "opacity-60" : ""}`}>
                    <div className="min-w-0 grow">
                      <p className="text-sm font-medium">
                        {fmt(w.starts_on)}
                        {w.ends_on !== w.starts_on ? ` – ${fmt(w.ends_on)}` : ""}
                      </p>
                      <p className="text-xs text-gray-500">
                        <span
                          className={
                            w.status === "reserved"
                              ? "rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700"
                              : "rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700"
                          }
                        >
                          {w.status}
                        </span>
                        {w.status === "reserved" && w.reserved_for ? ` for ${w.reserved_for}` : ""}
                        {w.note ? ` · ${w.note}` : ""}
                      </p>
                    </div>
                    <form action={setAvailabilityStatus} className="flex items-center gap-2">
                      <input type="hidden" name="profile_id" value={profileId} />
                      <input type="hidden" name="id" value={w.id} />
                      {w.status === "available" ? (
                        <>
                          <input type="hidden" name="status" value="reserved" />
                          <input
                            name="reserved_for"
                            placeholder="Reserved for…"
                            className="w-40 rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
                          />
                          <button className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                            Reserve
                          </button>
                        </>
                      ) : (
                        <>
                          <input type="hidden" name="status" value="available" />
                          <button className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                            Release
                          </button>
                        </>
                      )}
                    </form>
                    <form action={deleteAvailability}>
                      <input type="hidden" name="profile_id" value={profileId} />
                      <input type="hidden" name="id" value={w.id} />
                      <button className="text-xs text-gray-400 hover:text-red-600">Delete</button>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}

          <form action={addAvailability} className="mt-4 grid grid-cols-1 gap-3 rounded-lg bg-gray-50 p-4 sm:grid-cols-5">
            <input type="hidden" name="profile_id" value={profileId} />
            <div>
              <label className={labelCls} htmlFor="av-start">From</label>
              <input id="av-start" name="starts_on" type="date" required className={inputCls} />
            </div>
            <div>
              <label className={labelCls} htmlFor="av-end">To</label>
              <input id="av-end" name="ends_on" type="date" className={inputCls} />
            </div>
            <div>
              <label className={labelCls} htmlFor="av-status">Status</label>
              <select id="av-status" name="status" className={inputCls} defaultValue="available">
                <option value="available">Available</option>
                <option value="reserved">Reserved</option>
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="av-for">Reserved for</label>
              <input id="av-for" name="reserved_for" placeholder="if reserved" className={inputCls} />
            </div>
            <div className="flex items-end">
              <button className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700">
                Add dates
              </button>
            </div>
            <div className="sm:col-span-5">
              <label className={labelCls} htmlFor="av-note">Note (optional)</label>
              <input id="av-note" name="note" className={inputCls} placeholder="e.g. prefers Year 9 groups, max 20" />
            </div>
          </form>
        </>
      )}
    </section>
  );
}
