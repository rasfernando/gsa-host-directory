import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { submitListing } from "./actions";

const inputCls =
  "mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-brand-600 focus:outline-none";
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
        <h1 className="text-3xl font-bold tracking-tight">
          {p.name} is {p.published ? "live" : "awaiting review"}
        </h1>
        <p className="mt-3 leading-relaxed text-stone-500">
          {p.published
            ? "Your listing is live in the directory."
            : "The GSA team gives every new listing a quick review before it goes live — usually within a couple of days."}
        </p>
        {p.tier === "listed" && (
          <p className="mt-6 rounded-xl border border-stone-200/70 bg-white p-5 text-sm leading-relaxed text-stone-600 shadow-sm">
            Want to be actively promoted by GSA and earn the gold-standard
            accreditation badge?{" "}
            <Link href="/apply" className="font-semibold text-brand-700 underline">
              Apply for GSA accreditation →
            </Link>
          </p>
        )}
        {p.published && (
          <Link
            href={`/directory/${p.slug}`}
            className="mt-6 inline-block text-sm text-stone-500 underline transition-colors duration-150 hover:text-stone-900"
          >
            View your listing
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <p className="text-xs font-semibold uppercase tracking-widest text-stone-500">
        Become a host
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">
        List your school as a host
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-stone-600">
        Join the global directory in a few minutes. Welcome overseas groups,
        build global citizenship at your school, and get paid for hosting.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-stone-500">
        Signed in as {user?.email}. Listings get a quick review from the GSA
        team before going live. You can apply for full{" "}
        <Link href="/apply" className="underline">GSA accreditation</Link>{" "}
        — the gold standard, actively promoted by GSA — at any time.
      </p>

      <form
        action={submitListing}
        className="mt-8 space-y-4 rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm sm:p-8"
      >
        <div>
          <label className={labelCls} htmlFor="school_name">School name</label>
          <input className={inputCls} id="school_name" name="school_name" required />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="country">Country</label>
            <input className={inputCls} id="country" name="country" required />
          </div>
          <div>
            <label className={labelCls} htmlFor="city">City</label>
            <input className={inputCls} id="city" name="city" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" name="boarding" className="rounded border-stone-300" />
            Boarding available
          </label>
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" name="homestay" className="rounded border-stone-300" />
            Homestay available
          </label>
        </div>
        <div>
          <label className={labelCls} htmlFor="typical_hosting_windows">
            When can you typically host?
          </label>
          <input className={inputCls} id="typical_hosting_windows" name="typical_hosting_windows" placeholder="e.g. Term time, September–November best" />
        </div>
        <div>
          <label className={labelCls} htmlFor="photo">
            A photo of your school <span className="font-normal text-stone-500">(optional, but listings with photos get far more interest)</span>
          </label>
          <input
            className="mt-1 w-full text-sm text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-brand-700 hover:file:bg-brand-100"
            id="photo"
            name="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-lg bg-brand-700 px-4 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-brand-800"
        >
          Submit my listing for review
        </button>
        <p className="text-center text-xs text-stone-500">
          The GSA team reviews every listing — yours will be live within a
          couple of days.
        </p>
      </form>
    </div>
  );
}
