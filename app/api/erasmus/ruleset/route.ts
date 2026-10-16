import { NextResponse } from "next/server";
import { ruleset, RULESET_VERSION } from "@/lib/erasmus/rubric";

// The one definition the Assessor and the Project Builder both score against.
// Public and unauthenticated on purpose: it is rubric, not data, and a Builder
// on a different backend has to be able to fetch it. Deliberately outside the
// V1 module gate (lib/features.ts only gates /admin/erasmus), so switching the
// Erasmus admin tab off never breaks a consumer of the rules.
export async function GET() {
  return NextResponse.json(ruleset(), {
    headers: {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      "X-Erasmus-Ruleset-Version": RULESET_VERSION,
    },
  });
}
