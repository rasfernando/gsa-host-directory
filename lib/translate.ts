import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { LOCALES } from "@/i18n/request";

// Automatic profile translation via the Claude API. Env-gated like
// lib/notify.ts: without ANTHROPIC_API_KEY every call no-ops and pages fall
// back to English. Runs on publish, on content-change approval, and as a
// nightly catch-up sweep on the cron.

const TRANSLATED_FIELDS = ["headline", "description", "typical_hosting_windows", "city"] as const;
type SourceFields = Partial<Record<(typeof TRANSLATED_FIELDS)[number], string | null>>;

const TARGETS = LOCALES.filter((l) => l !== "en");
const LANGUAGE_NAMES: Record<string, string> = {
  zh: "Simplified Chinese",
  fr: "French",
  es: "Spanish",
  de: "German",
  pl: "Polish",
};

// Staleness marker stored alongside the translations: when the source
// content changes, the hash stops matching and the profile re-translates.
// Keep in sync with the SQL equivalent:
// md5(coalesce(headline,'')||'|'||coalesce(description,'')||'|'||coalesce(typical_hosting_windows,'')||'|'||coalesce(city,''))
export function contentHash(f: SourceFields): string {
  return createHash("md5")
    .update(
      [f.headline ?? "", f.description ?? "", f.typical_hosting_windows ?? "", f.city ?? ""].join("|")
    )
    .digest("hex");
}

export function translationEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function translateProfileFields(
  fields: SourceFields
): Promise<Record<string, Record<string, string>> | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log("[translate skipped — ANTHROPIC_API_KEY not set]");
    return null;
  }

  const source: Record<string, string> = {};
  for (const k of TRANSLATED_FIELDS) {
    const value = fields[k];
    if (value) source[k] = value;
  }
  if (Object.keys(source).length === 0) return {};

  const prompt = `Translate the JSON values below from English into each of these languages: ${TARGETS.map(
    (l) => `${l} (${LANGUAGE_NAMES[l]})`
  ).join(", ")}.

Rules:
- These are school-profile texts on an international school-travel marketplace; translate naturally for parents and teachers.
- "city" is a place name: use the conventional exonym in each language (e.g. Edinburgh → Édimbourg in French, 爱丁堡 in Chinese); keep it unchanged if no conventional form exists.
- Keep month names/ranges natural in each language.
- Do not translate proper nouns of school names or "GSA".
- Reply with ONLY a JSON object of shape {"${TARGETS.join('": {...}, "')}": {...}} where each language maps the SAME keys as the input to their translations. No commentary, no markdown fences.

Input:
${JSON.stringify(source)}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) {
      console.error(`[translate failed] ${res.status}: ${await res.text()}`);
      return null;
    }
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = data.content?.find((c) => c.type === "text")?.text ?? "";
    const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    const parsed = JSON.parse(json) as Record<string, Record<string, string>>;
    // Keep only expected locales/fields — never trust shape blindly.
    const clean: Record<string, Record<string, string>> = {};
    for (const locale of TARGETS) {
      const block = parsed[locale];
      if (!block) continue;
      clean[locale] = {};
      for (const k of TRANSLATED_FIELDS) {
        if (typeof block[k] === "string" && block[k]) clean[locale][k] = block[k];
      }
    }
    return clean;
  } catch (err) {
    console.error("[translate failed]", err);
    return null;
  }
}

// Fetch → translate → store, with the hash marker. `supabase` is whatever
// client the caller holds (admin session or service role) — RLS applies.
// No-ops when the content already matches the stored hash.
export async function translateAndStoreProfile(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  profileId: string
) {
  if (!translationEnabled()) return false;

  const { data: p } = await supabase
    .from("host_profiles")
    .select("id, headline, description, typical_hosting_windows, city, translations")
    .eq("id", profileId)
    .single();
  if (!p) return false;

  const fields: SourceFields = {
    headline: p.headline as string | null,
    description: p.description as string | null,
    typical_hosting_windows: p.typical_hosting_windows as string | null,
    city: p.city as string | null,
  };
  const hash = contentHash(fields);
  const existing = (p.translations as Record<string, unknown> | null) ?? {};
  if (existing["_hash"] === hash) return false; // already current

  const translated = await translateProfileFields(fields);
  if (!translated) return false;

  const { error } = await supabase
    .from("host_profiles")
    .update({ translations: { ...translated, _hash: hash } })
    .eq("id", profileId);
  if (error) {
    console.error("[translate] store failed:", error.message);
    return false;
  }
  return true;
}
