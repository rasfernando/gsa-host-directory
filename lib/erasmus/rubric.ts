// Erasmus+ KA122-SCH (short-term mobility project, school education) assessor rubric.
//
// Sources: Erasmus+ Programme Guide (award criteria + thresholds for KA122-SCH),
// the EC 2026 KA122-SCH application form structure, and GSA's own KA122
// Application Support Guide ("golden thread": NEED → OBJECTIVE → ACTIVITY →
// MEASURE → LEGACY). This is the yardstick the model scores against — keep it
// boring, explicit and in one place so Toni can argue with it line by line.

export const ACTION_TYPE = "KA122-SCH";

export const CRITERIA = [
  {
    key: "relevance",
    label: "Relevance",
    max: 20,
    description:
      "The applicant's profile, experience, activities and learners are relevant to school education; the proposal is relevant to the objectives of the action; it respects and promotes shared EU values (dignity, freedom, democracy, equality, rule of law, human rights, non-discrimination); and it is relevant to the specific priorities: supporting newcomers / less experienced organisations, long-term pupil mobility, and participants with fewer opportunities.",
  },
  {
    key: "design",
    label: "Quality of project design",
    max: 50,
    description:
      "Objectives address the needs of the organisation, its staff and learners in a clear and concrete way; activities are appropriate for achieving the objectives; there is a clear work plan for each activity; the project incorporates environmentally sustainable and responsible practices; the project uses digital tools and learning methods (eTwinning etc.) to complement physical mobility and improve cooperation with hosts.",
  },
  {
    key: "followup",
    label: "Quality of follow-up actions",
    max: 30,
    description:
      "Tasks and responsibilities for delivering activities are clearly defined in line with the Erasmus quality standards; there are concrete, logical steps to integrate the results of mobility into the organisation's regular work; there is an appropriate way of evaluating project outcomes; there are concrete, effective steps to share results inside the organisation, with other organisations and the public, and to acknowledge EU funding.",
  },
] as const;

export const THRESHOLDS = {
  total: 60, // out of 100
  perCriterionFraction: 0.5, // at least half of the max in each of the three
};

// The official KA122-SCH form, grouped the way an assessor reads it.
export const SECTIONS = [
  { key: "summary", label: "Project summary (background · objectives · results)" },
  { key: "organisation", label: "Organisation: activities, school-education role, learners incl. fewer opportunities, experience & numbers" },
  { key: "needs", label: "Needs and challenges — and how Erasmus+ mobility helps" },
  { key: "objectives", label: "Objectives (1–3): title · explanation (which need) · how success is measured" },
  { key: "topics", label: "Topics / priorities the project works on" },
  { key: "activities", label: "Planned activities: type, participants, days, accompanying persons, fewer opportunities, green travel — content, methods, learning outcomes" },
  { key: "selection_inclusion", label: "Participant selection and inclusion of participants with fewer opportunities" },
  { key: "preparation_support", label: "Preparation before mobility; support and monitoring during mobility" },
  { key: "learning_outcomes", label: "Learning outcomes: defined, evaluated, recognised and shared" },
  { key: "quality_standards", label: "Erasmus quality standards, supporting organisations and school ownership of core tasks" },
  { key: "evaluation", label: "Follow-up: evaluating whether objectives were achieved" },
  { key: "integration", label: "Follow-up: integrating results into the school's regular work" },
  { key: "dissemination", label: "Follow-up: sharing results internally, externally and acknowledging EU funding" },
] as const;

// GSA's golden thread + the things assessors reliably penalise.
export const GOLDEN_THREAD = [
  { key: "need_evidenced", label: "Needs are specific to this school and backed by evidence (not a generic wish to travel)" },
  { key: "objectives_from_needs", label: "Each objective responds to a stated need and is an outcome, not an activity" },
  { key: "activities_deliver_objectives", label: "Activities are learning programmes that plausibly cause the objectives (not an itinerary)" },
  { key: "measures_exist", label: "Each objective has realistic indicators / a way to measure success (baseline, threshold, evidence)" },
  { key: "legacy_defined", label: "Legacy: concrete changes to normal school practice after the mobility, with owners and timeframe" },
  { key: "inclusion_practical", label: "Inclusion is practical (barriers named, support planned), selection is fair and not ability-to-pay" },
  { key: "green_digital", label: "Environmental responsibility and digital cooperation are built into delivery" },
  { key: "school_ownership", label: "School retains ownership of core tasks; any supporting organisation's role is limited and practical" },
  { key: "consistency", label: "Numbers, cohort, destination, duration and story are consistent throughout" },
  { key: "clarity", label: "Clear and succinct for an assessor — no padding, no unexplained jargon" },
] as const;

export type Severity = "high" | "medium" | "low";
export type ThreadStatus = "strong" | "weak" | "missing";

export type Assessment = {
  overall: {
    score: number;
    pass: boolean;
    verdict: string;
  };
  criteria: {
    key: (typeof CRITERIA)[number]["key"];
    score: number;
    pass: boolean;
    rationale: string;
    strengths: string[];
    weaknesses: string[];
  }[];
  golden_thread: {
    key: (typeof GOLDEN_THREAD)[number]["key"];
    status: ThreadStatus;
    note: string;
  }[];
  sections: {
    key: (typeof SECTIONS)[number]["key"];
    present: boolean;
    quality: 1 | 2 | 3 | 4 | 5;
    issues: { severity: Severity; issue: string; fix: string; quote?: string }[];
    example_rewrite?: string;
  }[];
  top_actions: string[];
  missing_information: string[];
  expert_spot_checks: string[];
};

export function criterionMax(key: string) {
  return CRITERIA.find((c) => c.key === key)?.max ?? 0;
}
