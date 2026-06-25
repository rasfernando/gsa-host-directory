import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { inputCls, labelCls } from "@/lib/forms";
import {
  RoleField,
  WhyHostField,
  AgeBandField,
  SubjectStrengthsField,
  LanguagesField,
  HostedBeforeField,
  HostMonthsField,
} from "@/components/host-profile-fields";
import { submitListing } from "./actions";

export default async function ListYourSchoolPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not signed in? Show the pitch and a sign-in prompt — the public
  // "published" RLS policy means an unfiltered query here would return
  // other schools' listings.
  if (!user) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-stone-500">
          Become a host
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          List your school as a host
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-stone-600">
          Join the global directory in a few minutes. Welcome overseas groups,
          build global citizenship at your school, and get paid for hosting.
        </p>
        <Link
          href="/login?next=/list-your-school"
          className="mt-8 inline-block rounded-lg bg-warm-600 px-6 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-warm-700"
        >
          Sign in to get started
        </Link>
        <p className="mt-3 text-xs text-stone-500">
          No password needed — we&apos;ll email you a sign-in link.
        </p>
      </div>
    );
  }

  // Already listed? Show status instead of the form — but only this
  // school's own listing, never the first row RLS happens to return.
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("school_id")
    .eq("id", user.id)
    .single();

  // Already listed? Manage it from the dashboard rather than a dead-end.
  if (profile?.school_id) {
    const { data: existing } = await supabase
      .from("host_profiles")
      .select("id")
      .eq("school_id", profile.school_id)
      .limit(1);
    if (existing && existing.length > 0) redirect("/your-school");
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

      {error && (
        <p className="mt-4 rounded-xl border border-warm-200 bg-warm-50 px-4 py-3 text-sm text-warm-700">
          {decodeURIComponent(error)} — please try again, or email
          hello@globalschoolalliance.com if it persists.
        </p>
      )}

      <p className="mt-6 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
        Information shared here will be visible on your profile after
        verification.
      </p>

      <form
        action={submitListing}
        className="mt-4 space-y-4 rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm sm:p-8"
      >
        <div>
          <label className={labelCls} htmlFor="school_name">School name</label>
          <input className={inputCls} id="school_name" name="school_name" required />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className={labelCls} htmlFor="country">Country</label>
            <input className={inputCls} id="country" name="country" required />
          </div>
          <div>
            <label className={labelCls} htmlFor="state">
              State / Region <span className="font-normal text-stone-500">(if applicable)</span>
            </label>
            <input className={inputCls} id="state" name="state" />
          </div>
          <div>
            <label className={labelCls} htmlFor="city">City</label>
            <input className={inputCls} id="city" name="city" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="contact_first_name">First name</label>
            <input className={inputCls} id="contact_first_name" name="contact_first_name" required />
          </div>
          <div>
            <label className={labelCls} htmlFor="contact_last_name">Last name</label>
            <input className={inputCls} id="contact_last_name" name="contact_last_name" required />
          </div>
        </div>
        <RoleField />
        <div>
          <label className={labelCls} htmlFor="website">School website</label>
          <input className={inputCls} id="website" name="website" type="text" inputMode="url" placeholder="yourschool.org" required />
          <p className="mt-1 text-xs text-stone-500">No need for https:// — we&apos;ll add it.</p>
        </div>
        <div>
          <label className={labelCls} htmlFor="headline">
            One-line description of your school
          </label>
          <input className={inputCls} id="headline" name="headline" placeholder="e.g. Bilingual secondary school with a strong arts programme" />
        </div>
        <WhyHostField />
        <AgeBandField />
        <div>
          <label className={labelCls} htmlFor="capacity">Max student group size</label>
          <input className={inputCls} id="capacity" name="capacity" type="number" min={1} />
        </div>
        <LanguagesField />
        <SubjectStrengthsField />
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
        <HostedBeforeField />
        <HostMonthsField />
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
          className="w-full rounded-lg bg-warm-600 px-4 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-warm-700"
        >
          Submit my profile for review
        </button>
        <p className="text-center text-xs text-stone-500">
          The GSA team reviews every listing — we&apos;ll contact you with
          updates on your profile.
        </p>
      </form>
    </div>
  );
}
