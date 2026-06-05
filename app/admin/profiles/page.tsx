import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { togglePublish } from "../actions";

export default async function AdminProfiles() {
  const supabase = await createClient();

  const { data: profiles } = await supabase
    .from("host_profiles")
    .select("id, name, slug, country, city, published, tier, accredited_at")
    .order("created_at", { ascending: false });

  const list = profiles ?? [];

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Directory profiles</h1>
      <p className="mb-8 mt-1 text-sm text-gray-500">
        {list.filter((p) => p.published).length} published · {list.length} total.
        Profiles are created automatically on approval and start unpublished.
      </p>

      {list.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-200 p-10 text-center text-sm text-gray-400">
          No profiles yet — approve an application to create the first one.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
          {list.map((p) => (
            <li key={p.id} className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-sm font-medium">
                  {p.name}{" "}
                  <span
                    className={
                      p.tier === "accredited"
                        ? "ml-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700"
                        : "ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500"
                    }
                  >
                    {p.tier}
                  </span>
                </p>
                <p className="text-xs text-gray-400">
                  {p.city ? `${p.city}, ` : ""}
                  {p.country}
                  {" · "}
                  {p.published ? (
                    <Link href={`/directory/${p.slug}`} className="underline" target="_blank">
                      view live
                    </Link>
                  ) : (
                    "unpublished"
                  )}
                </p>
              </div>
              <form action={togglePublish}>
                <input type="hidden" name="profile_id" value={p.id} />
                <input type="hidden" name="publish" value={String(!p.published)} />
                <button
                  className={
                    p.published
                      ? "rounded-lg border border-gray-200 px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
                      : "rounded-lg bg-gray-900 px-4 py-2 text-xs font-medium text-white hover:bg-gray-700"
                  }
                >
                  {p.published ? "Unpublish" : "Publish"}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
