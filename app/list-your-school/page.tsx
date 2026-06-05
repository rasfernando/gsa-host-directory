import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { submitListing } from "./actions";

const inputCls =
  "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none";
const labelCls = "block text-sm font-medium";

export default async function ListYourSchoolPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Already listed? Show status instead of the form.
  const { data: existing } = await supabase
    .from("host_profiles")
    .select("id, name, slug, published, tier")
    .limit(1);

  if (existing && existing.length > 0) {
    const p = existing[0];
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          {p.name} is {p.published ? "live" : "awaiting review"}
        </h1>
        <p className="mt-3 text-gray-500">
          {p.published
            ? "Your listing is live in the directory."
            : "The GSA team gives every new listing a quick review before it goes live — usually within a couple of days."}
        </p>
        {p.tier === "listed" && (
          <p className="mt-4 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
            Want to be actively promoted by GSA and earn the gold-standard
            accreditation badge?{" "}
            <Link href="/apply" className="underline">
              Apply for GSA accreditation →
            </Link>
          </p>
        )}
        {p.published && (
          <Link
            href={`/directory/${p.slug}`}
            className="mt-6 inline-block text-sm text-gray-500 underline"
          >
            View your listing
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight">
        List your school as a host
      </h1>
      <p className="mb-2 mt-2 text-sm text-gray-500">
        Join the global directory in a few minutes. Welcome overseas groups,
        build global citizenship at your school, and get paid for hosting.
      </p>
      <p className="mb-8 text-sm text-gray-500">
        Signed in as {user?.email}. Listings get a quick review from the GSA
        team before going live. You can apply for full{" "}
        <Link href="/apply" className="underline">GSA accreditation</Link>{" "}
        — the gold standard, actively promoted by GSA — at any time.
      </p>

      <form action={submitListing} className="space-y-4">
        <div>
          <label className={labelCls} htmlFor="school_name">School name</label>
          <input className={inputCls} id="school_name" name="school_name" required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls} htmlFor="country">Country</label>
            <input className={inputCls} id="country" name="country" required />
          </div>
          <div>
            <label className={labelCls} htmlFor="city">City</label>
            <input className={inputCls} id="city" name="city" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls} htmlFor="contact_name">Your name</label>
            <input className={inputCls} id="contact_name" name="contact_name" required />
          </div>
          <div>
            <label className={labelCls} htmlFor="website">School website</label>
            <input className={inputCls} id="website" name="website" type="url" placeholder="https://" required />
          </div>
        </div>
        <div>
          <label className={labelCls} htmlFor="headline">
            One-line description of your school
          </label>
          <input className={inputCls} id="headline" name="headline" placeholder="e.g. Bilingual secondary school with a strong arts programme" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelCls} htmlFor="age_range_min">Ages from</label>
            <input className={inputCls} id="age_range_min" name="age_range_min" type="number" min={3} max={19} />
          </div>
          <div>
            <label className={labelCls} htmlFor="age_range_max">Ages to</label>
            <input className={inputCls} id="age_range_max" name="age_range_max" type="number" min={3} max={19} />
          </div>
          <div>
            <label className={labelCls} htmlFor="capacity">Max group size</label>
            <input className={inputCls} id="capacity" name="capacity" type="number" min={1} />
          </div>
        </div>
        <div>
          <label className={labelCls} htmlFor="languages">Languages spoken (comma-separated)</label>
          <input className={inputCls} id="languages" name="languages" placeholder="English, Spanish" />
        </div>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" name="boarding" className="rounded border-gray-300" />
            Boarding available
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" name="homestay" className="rounded border-gray-300" />
            Homestay available
          </label>
        </div>
        <div>
          <label className={labelCls} htmlFor="typical_hosting_windows">
            When can you typically host?
          </label>
          <input className={inputCls} id="typical_hosting_windows" name="typical_hosting_windows" placeholder="e.g. Term time, September–November best" />
        </div>
        <button
          type="submit"
          className="w-full rounded-lg bg-gray-900 px-4 py-3 text-sm font-medium text-white hover:bg-gray-700"
        >
          Create listing
        </button>
      </form>
    </div>
  );
}
