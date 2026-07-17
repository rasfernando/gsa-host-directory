import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { claimSupplierInvite } from "./actions";

export const dynamic = "force-dynamic";

export default async function SupplierOnboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: rows } = await supabase.rpc("supplier_invite_by_token", { p_token: token });
  const invite = Array.isArray(rows) ? rows[0] : rows;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!invite) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Invite not found</h1>
        <p className="mt-3 text-sm text-stone-600">
          This link doesn&apos;t look right. Please check with the GSA team.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md py-12">
      <p className="text-xs font-semibold uppercase tracking-widest text-warm-700">
        Supplier onboarding
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">
        {invite.company_name ? `Welcome, ${invite.company_name}` : "Complete your supplier profile"}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-stone-600">
        The Global School Alliance has invited you to complete your supplier
        profile and upload your verification documents. It takes a few minutes,
        and your profile stays private.
      </p>

      {invite.used_at && (
        <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This invite has already been used. If that was you,{" "}
          <Link href="/for-suppliers" className="font-semibold underline">open your profile</Link>.
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {decodeURIComponent(error)}
        </p>
      )}

      {!invite.used_at && (
        <div className="mt-6">
          {user ? (
            <form action={claimSupplierInvite}>
              <input type="hidden" name="token" value={token} />
              <button className="rounded-lg bg-warm-600 px-6 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-warm-700">
                Claim &amp; complete my profile
              </button>
            </form>
          ) : (
            <Link
              href={`/login?next=${encodeURIComponent(`/suppliers/onboard/${token}`)}`}
              className="inline-block rounded-lg bg-warm-600 px-6 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-warm-700"
            >
              Sign in to continue
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
