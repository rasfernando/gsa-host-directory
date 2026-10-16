import { createServiceClient } from "@/lib/supabase/service";
import { inviteAdmin } from "./actions";

// user_profiles holds only id / role / school_id, so the readable bits
// (email, when they joined) come from auth.users via the service role.
// Without that key we say so rather than render a list of bare UUIDs.

type Admin = { id: string; email: string | null; created_at: string | null };

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const flags = await searchParams;
  const service = createServiceClient();

  let admins: Admin[] = [];
  if (service) {
    const [{ data: rows }, { data: users }] = await Promise.all([
      service.from("user_profiles").select("id").eq("role", "gsa_admin"),
      service.auth.admin.listUsers({ perPage: 1000 }),
    ]);
    const byId = new Map((users?.users ?? []).map((u) => [u.id, u]));
    admins = (rows ?? [])
      .map((r) => {
        const u = byId.get(r.id);
        return { id: r.id, email: u?.email ?? null, created_at: u?.created_at ?? null };
      })
      .sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""));
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold">GSA team</h1>
      <p className="mt-1 text-sm text-gray-600">
        Admins can review applications, onboard schools and use every tab here. Invite a colleague
        by email; if they already have an account, they are made an admin on the spot.
      </p>

      {flags.saved === "invited" && (
        <div className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Invite sent. They will be an admin as soon as they open the link.
        </div>
      )}
      {flags.saved === "promoted" && (
        <div className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          They already had an account, so they are an admin now — no email needed.
        </div>
      )}
      {flags.error && (
        <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {decodeURIComponent(flags.error)}
        </div>
      )}

      {service ? (
        <form action={inviteAdmin} className="mt-6 flex flex-wrap items-end gap-3">
          <label className="block grow text-sm">
            <span className="font-medium">Email address</span>
            <input
              id="invite-email"
              name="email"
              type="email"
              required
              autoComplete="off"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              placeholder="name@globalschoolalliance.com"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
          >
            Invite as admin
          </button>
        </form>
      ) : (
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-medium">Invites are unavailable in this environment.</p>
          <p className="mt-1">
            They need <code className="font-mono text-xs">SUPABASE_SERVICE_ROLE_KEY</code>, which is set
            in production but not here.
          </p>
        </div>
      )}

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-gray-500">
        Current admins
      </h2>
      {!service ? (
        <p className="mt-2 text-sm text-gray-500">Not listed without the service key.</p>
      ) : admins.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">No admins found.</p>
      ) : (
        <ul className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-100 bg-white">
          {admins.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <p className="truncate text-sm font-medium">{a.email ?? a.id}</p>
              {a.created_at && (
                <p className="shrink-0 text-xs text-gray-500">
                  since {new Date(a.created_at).toLocaleDateString("en-GB")}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-xs text-gray-500">
        Removing an admin is still done in the Supabase dashboard for now, so nobody can lock
        themselves out from here.
      </p>
    </div>
  );
}
