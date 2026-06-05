import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VERIFICATION_CHECKS } from "@/lib/checklist";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";

// The "approval pack": a printable verification statement a teacher can
// hand to their headteacher, governors, or EVC when seeking trip approval.
export default async function VerificationStatement({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("host_profiles")
    .select("name, slug, country, city, accredited_at, verification_summary")
    .eq("slug", slug)
    .eq("published", true)
    .eq("tier", "accredited")
    .single();

  if (!profile) notFound();

  const summary = (profile.verification_summary ?? []) as {
    key: string;
    status: string;
    date: string | null;
  }[];
  const labelMap = new Map<string, { label: string; description: string }>(
    VERIFICATION_CHECKS.map((c) => [c.key, { label: c.label, description: c.description }])
  );

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between print:hidden">
        <Link
          href={`/directory/${profile.slug}`}
          className="text-sm text-gray-400 hover:text-gray-900"
        >
          ← Back to {profile.name}
        </Link>
        <PrintButton />
      </div>

      <div className="mt-8 print:mt-0">
        <p className="text-sm font-semibold uppercase tracking-wide text-gray-400">
          Global School Alliance · Verification statement
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{profile.name}</h1>
        <p className="mt-1 text-gray-500">
          {profile.city ? `${profile.city}, ` : ""}
          {profile.country}
        </p>

        <p className="mt-6 text-sm leading-relaxed text-gray-700">
          This school is an accredited Global School Alliance host school
          {profile.accredited_at &&
            `, verified on ${new Date(profile.accredited_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`}
          . Before accreditation, the GSA team personally completed the
          following verification steps. This statement is intended to support
          school leaders, governors, and educational visits coordinators in
          their own approval and risk-assessment processes.
        </p>

        <table className="mt-8 w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
              <th className="pb-2 pr-4 font-medium">Verification step</th>
              <th className="pb-2 pr-4 font-medium">Outcome</th>
              <th className="pb-2 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {summary.map((item) => {
              const meta = labelMap.get(item.key);
              return (
                <tr key={item.key} className="border-b border-gray-100 align-top">
                  <td className="py-3 pr-4">
                    <p className="font-medium text-gray-900">
                      {meta?.label ?? item.key.replace(/_/g, " ")}
                    </p>
                    {meta?.description && (
                      <p className="mt-0.5 text-xs text-gray-500">{meta.description}</p>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={
                        item.status === "passed"
                          ? "font-medium text-green-700"
                          : "font-medium text-gray-500"
                      }
                    >
                      {item.status === "passed" ? "Verified" : "Verified (equivalent)"}
                    </span>
                  </td>
                  <td className="py-3 text-gray-500">
                    {item.date
                      ? new Date(item.date).toLocaleDateString("en-GB")
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {summary.length === 0 && (
          <p className="mt-6 rounded-lg bg-gray-50 p-4 text-sm text-gray-500">
            Verification details for this school are available on request from
            the GSA team.
          </p>
        )}

        <div className="mt-10 rounded-lg bg-gray-50 p-5 text-xs leading-relaxed text-gray-500 print:bg-transparent print:border print:border-gray-200">
          <p>
            <strong className="text-gray-700">About GSA verification:</strong>{" "}
            the Global School Alliance verifies each host school&apos;s
            safeguarding policy, designated safeguarding lead, registration
            with its national education authority, references, and insurance,
            and meets school leadership by video before accreditation.
            Verification is reviewed periodically. This statement reflects
            checks completed at the date shown and does not replace a visiting
            school&apos;s own risk assessment. Questions:
            contact the GSA team via globalschoolalliance.com.
          </p>
        </div>
      </div>
    </div>
  );
}
