import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { inputCls, labelCls } from "@/lib/forms";
import { SUPPLIER_DOC_CATEGORIES } from "@/lib/checklist";
import {
  updateSupplierProfile,
  uploadSupplierLogo,
  addSupplierDoc,
  removeSupplierDoc,
  submitSupplierProfile,
} from "./actions";

export const dynamic = "force-dynamic";

type Doc = { name: string; path: string; category?: string };

const ERRORS: Record<string, string> = {
  name: "Please enter your company name.",
  nofile: "Please choose a file to upload.",
  toobig: "That file is too large.",
  logotype: "Logo must be JPG, PNG, WebP or SVG.",
  noprofile: "Save your company details first, then add documents.",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft — not yet submitted",
  submitted: "Submitted — with the GSA team for verification",
  verified: "Verified",
  rejected: "Not approved — the GSA team will be in touch",
};

export default async function ForSuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; submitted?: string; error?: string }>;
}) {
  const { saved, submitted, error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/for-suppliers");

  const { data: profile } = await supabase
    .from("supplier_profiles")
    .select("id, company_name, contact_name, contact_email, country, website, description, logo_url, evidence_files, status")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  const docs = (profile?.evidence_files as Doc[] | null) ?? [];
  // Signed URLs for the private logo + documents.
  const logoUrl =
    profile?.logo_url
      ? (await supabase.storage.from("supplier-docs").createSignedUrl(profile.logo_url, 600)).data?.signedUrl ?? null
      : null;
  const docLinks = await Promise.all(
    docs.map(async (d) => ({
      ...d,
      url: (await supabase.storage.from("supplier-docs").createSignedUrl(d.path, 600)).data?.signedUrl ?? null,
    }))
  );

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-widest text-warm-700">
        Supplier onboarding
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Your supplier profile</h1>
      <p className="mt-2 text-sm leading-relaxed text-stone-500">
        Complete your company profile and upload your verification documents. This
        is private — it&apos;s only shared with the Global School Alliance team for
        verification, never published.
      </p>

      {profile && (
        <p className="mt-4 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700">
          Status: <strong>{STATUS_LABEL[profile.status] ?? profile.status}</strong>
        </p>
      )}
      {submitted && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
          Thank you — your profile has been submitted. The GSA team will review it
          and be in touch.
        </p>
      )}
      {saved && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
          Saved.
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {ERRORS[error] ?? decodeURIComponent(error)}
        </p>
      )}

      {/* Company details */}
      <form action={updateSupplierProfile} className="mt-6 space-y-4 rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-bold tracking-tight">Company details</h2>
        <div>
          <label className={labelCls} htmlFor="company_name">Company name</label>
          <input className={inputCls} id="company_name" name="company_name" required defaultValue={profile?.company_name ?? ""} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="contact_name">Contact name</label>
            <input className={inputCls} id="contact_name" name="contact_name" defaultValue={profile?.contact_name ?? ""} />
          </div>
          <div>
            <label className={labelCls} htmlFor="contact_email">Contact email</label>
            <input className={inputCls} id="contact_email" name="contact_email" type="email" defaultValue={profile?.contact_email ?? user.email ?? ""} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="country">Country</label>
            <input className={inputCls} id="country" name="country" defaultValue={profile?.country ?? ""} />
          </div>
          <div>
            <label className={labelCls} htmlFor="website">Website</label>
            <input className={inputCls} id="website" name="website" type="text" inputMode="url" placeholder="yourcompany.com" defaultValue={profile?.website ?? ""} />
          </div>
        </div>
        <div>
          <label className={labelCls} htmlFor="description">What you offer</label>
          <textarea className={inputCls} id="description" name="description" rows={4} defaultValue={profile?.description ?? ""} placeholder="The services you provide — accommodation, transport, activities, etc." />
        </div>
        <button className="rounded-lg bg-warm-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-warm-700">
          Save details
        </button>
      </form>

      {profile ? (
        <>
          {/* Logo */}
          <section className="mt-4 rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-lg font-bold tracking-tight">Logo</h2>
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Your logo" className="mt-3 h-16 w-auto rounded border border-stone-200 bg-white object-contain p-1" />
            )}
            <form action={uploadSupplierLogo} className="mt-3 flex flex-wrap items-center gap-3">
              <input className="text-sm text-stone-600" name="logo" type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" required />
              <button className="rounded-lg border border-warm-600 px-4 py-2 text-sm font-semibold text-warm-700 hover:bg-warm-50">
                {logoUrl ? "Replace logo" : "Upload logo"}
              </button>
            </form>
          </section>

          {/* Documents */}
          <section className="mt-4 rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-lg font-bold tracking-tight">Verification documents</h2>
            <p className="mt-1 text-sm text-stone-500">
              Confidential — only the GSA team sees these.
            </p>
            {docLinks.length > 0 && (
              <ul className="mt-4 divide-y divide-stone-100 rounded-xl border border-stone-200/70">
                {docLinks.map((d) => (
                  <li key={d.path} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="min-w-0">
                      {d.category && (
                        <span className="mr-2 rounded bg-stone-100 px-1.5 py-0.5 text-[11px] font-medium text-stone-500">
                          {d.category.replace(/_/g, " ")}
                        </span>
                      )}
                      {d.name}
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      {d.url && (
                        <a href={d.url} target="_blank" className="text-xs font-medium text-warm-700 underline">View</a>
                      )}
                      <form action={removeSupplierDoc}>
                        <input type="hidden" name="path" value={d.path} />
                        <button className="text-stone-400 hover:text-red-600" title="Remove" aria-label="Remove">✕</button>
                      </form>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 grid gap-3">
              {SUPPLIER_DOC_CATEGORIES.map((c) => (
                <form key={c.key} action={addSupplierDoc} className="flex flex-wrap items-center gap-3 rounded-xl border border-stone-200/70 p-3">
                  <input type="hidden" name="category" value={c.key} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-stone-800">{c.label}</p>
                    <p className="text-xs text-stone-500">{c.hint}</p>
                  </div>
                  <input className="text-xs text-stone-600" name="document" type="file" required />
                  <button className="rounded-lg border border-warm-600 px-3 py-1.5 text-xs font-semibold text-warm-700 hover:bg-warm-50">
                    Upload
                  </button>
                </form>
              ))}
            </div>
          </section>

          {/* Submit */}
          {profile.status === "draft" && (
            <form action={submitSupplierProfile} className="mt-6">
              <button className="rounded-lg bg-warm-600 px-6 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-warm-700">
                Submit for verification
              </button>
              <p className="mt-2 text-xs text-stone-500">
                Once you&apos;ve added your details and documents, submit for the
                GSA team to review.
              </p>
            </form>
          )}
        </>
      ) : (
        <p className="mt-4 text-sm text-stone-500">
          Save your company details above to unlock document uploads.
        </p>
      )}
    </div>
  );
}
