import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";

// The repeatable "Host School Profile" GSA sends to agents, in the shape of
// Heather's existing template (Co-op Academy Bebington, Oct 2026): location,
// website, age range, type, Ofsted, prospectus, then overview, student body
// and culture, curriculum, enrichment, what stands out. Printable to PDF.
//
// Fields marked V1 come from migration 20261027_directory_v1.sql; before it
// is applied they are simply blank and the page still renders.

type Profile = Record<string, any> & { schools: Record<string, any> | Record<string, any>[] | null };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7 break-inside-avoid">
      <h2 className="text-base font-bold text-stone-900">{title}</h2>
      <div className="mt-2 text-[15px] leading-relaxed text-stone-800">{children}</div>
    </section>
  );
}

function Para({ text, fallback }: { text?: string | null; fallback?: string }) {
  const body = (text ?? "").trim() || (fallback ?? "");
  if (!body) return <p className="italic text-stone-400 print:hidden">Not written yet — add it on the edit page.</p>;
  return (
    <div className="space-y-2">
      {body.split(/\n{2,}/).map((p, i) => (
        <p key={i} className="whitespace-pre-line">{p}</p>
      ))}
    </div>
  );
}

export default async function CataloguePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("host_profiles").select("*, schools(*)").eq("id", id).maybeSingle();
  if (!data) redirect("/admin/profiles");
  const p = data as Profile;
  const school = Array.isArray(p.schools) ? p.schools[0] : p.schools;

  const location = [p.city, p.state, p.postcode, p.country].filter(Boolean).join(", ");
  const ages =
    p.age_range_min != null || p.age_range_max != null
      ? `${p.age_range_min ?? "?"}–${p.age_range_max ?? "?"} years`
      : p.age_band
        ? String(p.age_band)
        : "";
  const website: string | undefined = school?.website || undefined;
  const subjects: string[] = Array.isArray(p.subject_strengths) ? p.subject_strengths : [];
  const languages: string[] = Array.isArray(p.languages) ? p.languages : [];
  const months: string[] = Array.isArray(p.host_months) ? p.host_months : [];
  const cover = Array.isArray(p.media) && p.media[0]?.url ? String(p.media[0].url) : null;

  return (
    <div className="max-w-3xl">
      <style>{`@media print { body > header, body > footer { display: none !important; } main { padding: 0 !important; } @page { margin: 16mm; } }`}</style>

      <div className="flex items-center justify-between print:hidden">
        <Link href={`/admin/profiles/${id}/edit`} className="text-sm text-gray-500 hover:text-gray-900">
          ← Back to profile
        </Link>
        <PrintButton />
      </div>

      <article className="mt-6 rounded-2xl border border-stone-200/70 bg-white p-10 shadow-sm print:border-0 print:p-0 print:shadow-none">
        {/* Masthead */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-700 text-sm font-bold text-white">G</span>
            <span className="text-sm font-semibold tracking-tight text-stone-900">
              Global School Alliance <span className="font-normal text-stone-500">· Host Schools</span>
            </span>
          </div>
          <span className="text-xs uppercase tracking-wide text-stone-400">Host School Profile</span>
        </div>

        <h1 className="mt-8 text-center text-3xl font-bold tracking-tight text-stone-900">
          {p.name}
        </h1>
        <div
          aria-hidden
          className="mt-4 h-2 w-full rounded-full"
          style={{ background: "linear-gradient(90deg,#4caf50,#1b7f3b,#2196f3,#1a4fa0,#e53935,#ff8f00,#fdd835)" }}
        />

        {cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className="mt-6 h-56 w-full rounded-xl object-cover print:h-48" />
        )}

        {/* Key facts */}
        <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-2 text-[15px] sm:grid-cols-[auto_1fr]">
          {location && (<><dt className="font-semibold text-stone-900">Location:</dt><dd>{location}</dd></>)}
          {website && (
            <>
              <dt className="font-semibold text-stone-900">Website:</dt>
              <dd><a href={website} className="text-blue-700 underline break-all">{website.replace(/^https?:\/\//, "")}</a></dd>
            </>
          )}
          {ages && (<><dt className="font-semibold text-stone-900">Age Range:</dt><dd>{ages}</dd></>)}
          {p.school_type && (<><dt className="font-semibold text-stone-900">Type of School:</dt><dd>{p.school_type}</dd></>)}
          {p.ofsted_rating && (<><dt className="font-semibold text-stone-900">Ofsted Rating:</dt><dd>{p.ofsted_rating}</dd></>)}
          {p.prospectus_url && (
            <>
              <dt className="font-semibold text-stone-900">Prospectus:</dt>
              <dd><a href={p.prospectus_url} className="text-blue-700 underline">Available here</a></dd>
            </>
          )}
          {languages.length > 0 && (<><dt className="font-semibold text-stone-900">Languages:</dt><dd>{languages.join(", ")}</dd></>)}
          {p.capacity != null && (<><dt className="font-semibold text-stone-900">Group size:</dt><dd>Up to {p.capacity}</dd></>)}
          {(p.boarding || p.homestay) && (
            <>
              <dt className="font-semibold text-stone-900">Accommodation:</dt>
              <dd>{[p.boarding && "Boarding", p.homestay && "Homestay"].filter(Boolean).join(", ")}</dd>
            </>
          )}
          {months.length > 0 && (<><dt className="font-semibold text-stone-900">Hosting months:</dt><dd>{months.join(", ")}</dd></>)}
        </dl>

        <Section title="Overview">
          <Para text={p.overview} fallback={[p.description, p.headline].filter(Boolean).join("\n\n")} />
        </Section>

        <Section title="Student Body & Culture">
          <Para text={p.culture} />
        </Section>

        <Section title="Curriculum & Subjects">
          {p.curriculum ? (
            <Para text={p.curriculum} />
          ) : subjects.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5">
              {subjects.map((s) => (<li key={s}>{s}</li>))}
            </ul>
          ) : (
            <Para text={null} />
          )}
        </Section>

        <Section title="Enrichment & Extracurricular Activities">
          <Para text={p.enrichment} />
        </Section>

        <Section title={`What Makes ${p.name} Stand Out`}>
          <Para text={p.standout} fallback={p.why_host ?? ""} />
        </Section>

        <div className="mt-10 flex items-center justify-between border-t border-stone-200 pt-4 text-xs text-stone-500">
          <span>Global School Alliance · verified host school directory</span>
          <span>globalschoolalliance.com</span>
        </div>
      </article>
    </div>
  );
}
