import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { adminAddSupplier } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-500",
  submitted: "bg-amber-50 text-amber-700",
  verified: "bg-green-50 text-green-700",
  rejected: "bg-red-50 text-red-600",
};

type Row = {
  id: string;
  company_name: string;
  country: string | null;
  contact_email: string | null;
  status: string;
  owner_user_id: string | null;
  created_at: string;
};

export default async function AdminSuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("supplier_profiles")
    .select("id, company_name, country, contact_email, status, owner_user_id, created_at")
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as Row[];

  const submitted = rows.filter((r) => r.status === "submitted");

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Suppliers</h1>
      <p className="mt-1 text-sm text-gray-500">
        Tourism &amp; in-country suppliers. Add them here or let them self-register;
        review their documents and verify. Profiles are private.
      </p>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error === "name" ? "Enter a company name." : decodeURIComponent(error)}
        </p>
      )}

      {/* Add supplier */}
      <form action={adminAddSupplier} className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <div>
          <label className="block text-xs font-medium text-gray-600" htmlFor="company_name">Company name</label>
          <input id="company_name" name="company_name" required className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600" htmlFor="contact_email">Contact email</label>
          <input id="contact_email" name="contact_email" type="email" className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600" htmlFor="country">Country</label>
          <input id="country" name="country" className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700">
          Add supplier
        </button>
      </form>

      {submitted.length > 0 && (
        <>
          <h2 className="mt-8 text-sm font-semibold text-gray-900">
            Awaiting review ({submitted.length})
          </h2>
          <SupplierList rows={submitted} />
        </>
      )}

      <h2 className="mt-8 text-sm font-semibold text-gray-900">
        All suppliers ({rows.length})
      </h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">No suppliers yet.</p>
      ) : (
        <SupplierList rows={rows} />
      )}
    </div>
  );
}

function SupplierList({ rows }: { rows: Row[] }) {
  return (
    <ul className="mt-3 divide-y divide-gray-100 rounded-xl border border-gray-200">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
          <div className="min-w-0">
            <Link href={`/admin/suppliers/${r.id}`} className="text-sm font-medium text-gray-900 hover:underline">
              {r.company_name}
            </Link>
            <p className="text-xs text-gray-500">
              {r.country ? `${r.country} · ` : ""}
              {r.contact_email ?? "no contact"}
              {" · "}
              {r.owner_user_id ? "claimed" : "not claimed"}
            </p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${STATUS_BADGE[r.status] ?? "bg-gray-100 text-gray-500"}`}>
            {r.status}
          </span>
        </li>
      ))}
    </ul>
  );
}
