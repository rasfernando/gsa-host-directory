import Link from "next/link";
import { CONTACT_ROLES, SCHOOL_TYPES, inputCls, labelCls } from "@/lib/forms";
import { adminCreateSchool } from "../actions";

// Add a school on its behalf: no account, no invite link, nothing emailed.
// Lands on the profile's edit page for the hosting details.
export default async function NewSchoolPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/admin/profiles" className="text-sm text-gray-500 hover:text-gray-900">
        ← Profiles
      </Link>
      <h1 className="mt-3 text-2xl font-bold tracking-tight">Add a school</h1>
      <p className="mt-1 text-sm text-gray-600">
        Add a school yourself, with whatever you know so far. The school
        isn&apos;t emailed and doesn&apos;t need an account. It appears in
        Profiles, unpublished, and is sent to HubSpot. You add the hosting
        details on the next page.
      </p>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <form action={adminCreateSchool} className="mt-6 space-y-5 rounded-xl border border-gray-200 bg-white p-6">
        <div>
          <label className={labelCls} htmlFor="name">School name</label>
          <input className={inputCls} id="name" name="name" required />
          <p className="mt-1 text-xs text-gray-500">
            Use the name exactly as it appears in HubSpot, so it matches the
            existing record.
          </p>
        </div>

        <div>
          <label className={labelCls} htmlFor="school_type">Type of school</label>
          <select className={inputCls} id="school_type" name="school_type" defaultValue="">
            <option value="">Select a type…</option>
            {SCHOOL_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={labelCls} htmlFor="country">Country</label>
            <input className={inputCls} id="country" name="country" required />
          </div>
          <div>
            <label className={labelCls} htmlFor="city">City</label>
            <input className={inputCls} id="city" name="city" />
          </div>
          <div>
            <label className={labelCls} htmlFor="postcode">Postcode</label>
            <input className={inputCls} id="postcode" name="postcode" />
          </div>
        </div>

        <div>
          <label className={labelCls} htmlFor="website">Website</label>
          <input className={inputCls} id="website" name="website" placeholder="www.school.org" />
        </div>

        <fieldset className="space-y-4 border-t border-gray-100 pt-5">
          <legend className="text-sm font-semibold text-gray-900">
            Contact at the school <span className="font-normal text-gray-500">(optional)</span>
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="contact_first_name">First name</label>
              <input className={inputCls} id="contact_first_name" name="contact_first_name" />
            </div>
            <div>
              <label className={labelCls} htmlFor="contact_last_name">Last name</label>
              <input className={inputCls} id="contact_last_name" name="contact_last_name" />
            </div>
            <div>
              <label className={labelCls} htmlFor="contact_email">Email</label>
              <input className={inputCls} id="contact_email" name="contact_email" type="email" />
            </div>
            <div>
              <label className={labelCls} htmlFor="contact_phone">Phone</label>
              <input className={inputCls} id="contact_phone" name="contact_phone" type="tel" />
            </div>
          </div>
          <div>
            <label className={labelCls} htmlFor="contact_role">Role</label>
            <select className={inputCls} id="contact_role" name="contact_role" defaultValue="">
              <option value="">Select a role…</option>
              {CONTACT_ROLES.filter((r) => r !== "Other").map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        </fieldset>

        <button className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-700">
          Add school
        </button>
      </form>
    </div>
  );
}
