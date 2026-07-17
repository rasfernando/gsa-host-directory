import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SUPPLIER_CHECKS, SUPPLIER_DOC_CATEGORIES } from "@/lib/checklist";
import {
  recordSupplierCheck,
  setSupplierStatus,
  createSupplierInvite,
  adminUpdateSupplier,
  adminAddSupplierDoc,
  adminRemoveSupplierDoc,
} from "../actions";

export const dynamic = "force-dynamic";

type Doc = { name: string; path: string; category?: string };

const inputCls =
  "mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-gray-900 focus:outline-none";
const labelCls = "block text-xs font-medium text-gray-600";

const CHECK_BADGES: Record<string, string> = {
  passed: "bg-green-50 text-green-700",
  failed: "bg-red-50 text-red-600",
  waived: "bg-gray-100 text-gray-500",
  pending: "bg-amber-50 text-amber-700",
};

export default async function AdminSupplierDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { id } = await params;
  const { saved, error } = await searchParams;
  const supabase = await createClient();

  const { data: s } = await supabase
    .from("supplier_profiles")
    .select("id, company_name, contact_name, contact_email, country, website, description, logo_url, evidence_files, status, owner_user_id")
    .eq("id", id)
    .maybeSingle();
  if (!s) notFound();

  const { data: checkRows } = await supabase
    .from("supplier_verification_checks")
    .select("check_key, status")
    .eq("supplier_profile_id", id);
  const checkMap = new Map((checkRows ?? []).map((c) => [c.check_key, c.status]));

  const { data: invites } = await supabase
    .from("supplier_invites")
    .select("id, email, token, invited_at, used_at, created_at")
    .eq("supplier_profile_id", id)
    .order("created_at", { ascending: false });

  const docs = (s.evidence_files as Doc[] | null) ?? [];
  const logoUrl = s.logo_url
    ? (await supabase.storage.from("supplier-docs").createSignedUrl(s.logo_url, 600)).data?.signedUrl ?? null
    : null;
  const docLinks = await Promise.all(
    docs.map(async (d) => ({
      ...d,
      url: (await supabase.storage.from("supplier-docs").createSignedUrl(d.path, 600)).data?.signedUrl ?? null,
    }))
  );

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/admin/suppliers" className="text-sm text-gray-500 hover:text-gray-900">
        ← Suppliers
      </Link>

      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-12 w-12 rounded border border-gray-200 object-contain p-1" />
          )}
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{s.company_name}</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              {s.country ? `${s.country} · ` : ""}
              {s.contact_name ? `${s.contact_name} · ` : ""}
              {s.contact_email ?? "no contact"}
              {s.website && (
                <> · <a href={s.website} target="_blank" className="underline">website</a></>
              )}
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium">{s.status}</span>
      </div>

      {saved === "status" && <Flash>Status updated.</Flash>}
      {saved === "invite" && <Flash>Invite created — copy the link below to send it.</Flash>}
      {saved === "details" && <Flash>Details saved.</Flash>}
      {saved === "doc" && <Flash>Documents updated.</Flash>}
      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error === "email"
            ? "Enter an email."
            : error === "name"
              ? "Enter a company name."
              : error === "nofile"
                ? "Choose a file to upload."
                : error === "toobig"
                  ? "That file is over 10 MB."
                  : decodeURIComponent(error)}
        </p>
      )}

      {/* Editable details */}
      <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Details</h2>
        <form action={adminUpdateSupplier} className="mt-3 space-y-4">
          <input type="hidden" name="supplier_id" value={id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="company_name">Company name</label>
              <input className={inputCls} id="company_name" name="company_name" required defaultValue={s.company_name ?? ""} />
            </div>
            <div>
              <label className={labelCls} htmlFor="country">Country</label>
              <input className={inputCls} id="country" name="country" defaultValue={s.country ?? ""} />
            </div>
            <div>
              <label className={labelCls} htmlFor="contact_name">Contact name</label>
              <input className={inputCls} id="contact_name" name="contact_name" defaultValue={s.contact_name ?? ""} />
            </div>
            <div>
              <label className={labelCls} htmlFor="contact_email">Contact email</label>
              <input className={inputCls} id="contact_email" name="contact_email" type="email" defaultValue={s.contact_email ?? ""} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls} htmlFor="website">Website</label>
              <input className={inputCls} id="website" name="website" type="text" inputMode="url" placeholder="yourcompany.com" defaultValue={s.website ?? ""} />
            </div>
          </div>
          <div>
            <label className={labelCls} htmlFor="description">What they offer</label>
            <textarea className={inputCls} id="description" name="description" rows={4} defaultValue={s.description ?? ""} />
          </div>
          <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700">
            Save details
          </button>
        </form>
      </section>

      {/* Documents — houses supplier-submitted docs AND ones GSA adds */}
      <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Documents</h2>
        {docLinks.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No documents yet — upload any they&apos;ve emailed below.</p>
        ) : (
          <ul className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-100">
            {docLinks.map((d) => (
              <li key={d.path} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0">
                  {d.category && (
                    <span className="mr-2 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-500">
                      {d.category.replace(/_/g, " ")}
                    </span>
                  )}
                  {d.name}
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  {d.url ? (
                    <a href={d.url} target="_blank" className="text-xs font-medium text-blue-700 underline">View</a>
                  ) : (
                    <span className="text-xs text-gray-400">unavailable</span>
                  )}
                  <form action={adminRemoveSupplierDoc}>
                    <input type="hidden" name="supplier_id" value={id} />
                    <input type="hidden" name="path" value={d.path} />
                    <button className="text-gray-400 hover:text-red-600" title="Remove" aria-label="Remove">✕</button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* Add a document on the supplier's behalf */}
        <form action={adminAddSupplierDoc} className="mt-4 flex flex-wrap items-end gap-2 rounded-lg border border-gray-100 bg-gray-50 p-3">
          <input type="hidden" name="supplier_id" value={id} />
          <div>
            <label className={labelCls} htmlFor="category">Type</label>
            <select id="category" name="category" className="mt-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
              {SUPPLIER_DOC_CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
          </div>
          <input className="text-sm text-gray-600" name="document" type="file" required />
          <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700">
            Add document
          </button>
        </form>
      </section>

      {/* Verification checks */}
      <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Verification checks</h2>
        <ul className="mt-3 space-y-2">
          {SUPPLIER_CHECKS.map((c) => {
            const st = checkMap.get(c.key) ?? "pending";
            return (
              <li key={c.key} className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm text-gray-800">{c.label}</p>
                  <p className="text-xs text-gray-500">{c.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${CHECK_BADGES[st] ?? CHECK_BADGES.pending}`}>{st}</span>
                  {(["passed", "failed", "waived"] as const).map((target) => (
                    <form key={target} action={recordSupplierCheck}>
                      <input type="hidden" name="supplier_id" value={id} />
                      <input type="hidden" name="check_key" value={c.key} />
                      <input type="hidden" name="status" value={target} />
                      <button className="rounded border border-gray-200 px-2 py-1 text-[11px] font-medium text-gray-600 hover:bg-gray-50">
                        {target}
                      </button>
                    </form>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Decision */}
      <section className="mt-6 flex flex-wrap gap-3">
        <form action={setSupplierStatus}>
          <input type="hidden" name="supplier_id" value={id} />
          <input type="hidden" name="status" value="verified" />
          <button className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800">
            Mark verified
          </button>
        </form>
        <form action={setSupplierStatus}>
          <input type="hidden" name="supplier_id" value={id} />
          <input type="hidden" name="status" value="rejected" />
          <button className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Reject
          </button>
        </form>
      </section>

      {/* Invite to claim + complete */}
      <section className="mt-8 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Invite the supplier</h2>
        <p className="mt-1 text-xs text-gray-500">
          {s.owner_user_id
            ? "This supplier has claimed their profile and can edit it themselves."
            : "Send a link for the supplier to claim this profile and complete their details & documents."}
        </p>
        <form action={createSupplierInvite} className="mt-3 flex flex-wrap items-end gap-2">
          <input type="hidden" name="supplier_id" value={id} />
          <input type="hidden" name="company_name" value={s.company_name} />
          <input name="email" type="email" placeholder="supplier@example.com" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" required />
          <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700">
            Create invite link
          </button>
        </form>
        {invites && invites.length > 0 && (
          <ul className="mt-3 space-y-1.5 text-xs">
            {invites.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-gray-100 px-3 py-2">
                <span className="text-gray-600">{i.email}{i.used_at ? " · claimed" : ""}</span>
                <code className="break-all text-gray-500">
                  https://gsa-host-directory.vercel.app/suppliers/onboard/{i.token}
                </code>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Flash({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
      {children}
    </p>
  );
}
