import Link from "next/link";
import { runAssessment } from "../actions";
import {
  EXAMPLE_DRAFT,
  EXAMPLE_SCHOOL,
  EXAMPLE_TITLE,
  WEAK_DRAFT,
  WEAK_TITLE,
} from "@/lib/erasmus/example";
import { SubmitButton } from "./submit-button";

// The assessor call takes 30–90s; give the server action room on Vercel.
export const maxDuration = 300;

export default async function NewAssessment({
  searchParams,
}: {
  searchParams: Promise<{ example?: string }>;
}) {
  const { example } = await searchParams;
  const prefill =
    example === "strong"
      ? { school: EXAMPLE_SCHOOL, title: EXAMPLE_TITLE, draft: EXAMPLE_DRAFT }
      : example === "weak"
        ? { school: EXAMPLE_SCHOOL, title: WEAK_TITLE, draft: WEAK_DRAFT }
        : { school: "", title: "", draft: "" };

  return (
    <div className="max-w-3xl">
      <Link href="/admin/erasmus" className="text-sm text-gray-500 hover:text-gray-900">
        ← All assessments
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">New assessment</h1>
      <p className="mt-1 text-sm text-gray-600">
        Paste the school&apos;s draft answers as plain text. A whole application gives the most
        useful result; a single section works too (the overall score is then provisional).
        Nothing is sent to the school — this is for the GSA expert reviewing the draft.
      </p>
      <p className="mt-2 text-xs text-gray-500">
        Try it:{" "}
        <Link href="/admin/erasmus/new?example=strong" className="underline">
          load the strong worked example
        </Link>{" "}
        ·{" "}
        <Link href="/admin/erasmus/new?example=weak" className="underline">
          load a weak first draft
        </Link>
      </p>

      <form action={runAssessment} className="mt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium">School</span>
            <input
              name="school_name"
              required
              defaultValue={prefill.school}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              placeholder="e.g. Oakfield Academy"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Project title</span>
            <input
              name="project_title"
              defaultValue={prefill.title}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              placeholder="optional"
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="font-medium">Draft application text</span>
          <textarea
            name="draft"
            required
            minLength={200}
            rows={24}
            defaultValue={prefill.draft}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs leading-relaxed"
            placeholder={
              "Paste the answers in the order of the form, with the question headings, e.g.\n\nWhat are the most important needs and challenges your organisation is facing? How can Erasmus+ help?\n..."
            }
          />
        </label>
        <div className="flex items-center gap-3">
          <SubmitButton />
          <span className="text-xs text-gray-500">Takes about a minute.</span>
        </div>
      </form>
    </div>
  );
}
