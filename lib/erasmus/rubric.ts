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
  // Which ruleset this result was scored against. Stamped by assess.ts so
  // every stored assessment records the rules of its day (see RULESET_VERSION).
  ruleset_version?: string;
};

// ── Shared ruleset ──────────────────────────────────────────────────────────
//
// The Assessor and the Project Builder must score against ONE definition or
// they drift — and the failure is a school being told "Strong" by one tool
// and "would not pass" by the other. This block is that definition. It is
// served as JSON at /api/erasmus/ruleset so a Builder on a different backend
// (Heather's team may build it separately) reads the same rules rather than
// a copy in a Word document.
//
// Version follows the Builder spec's §37 convention. "UK" marks where UK
// National Agency overrides will go once the NA publishes; for now there are
// none, so this is the EC 2026 Programme Guide as-is.
export const RULESET_VERSION = "KA122_SCH_2026_UK_v1";

export type RuleConsumer = "assessor" | "builder";

// The Builder spec's §32 rules, normalised: its Rules 6 and 12 (post-mobility
// activity / learning continues after travel) are one rule here, and school
// ownership of core tasks is added because it is an Erasmus quality standard
// the Assessor already enforces. `golden_thread` is the Assessor check that
// enforces the rule today, if any; `strength_area` is the Builder's §31 row
// it feeds, so the Strength Check is derived from this list, not maintained
// separately. `enforced_by` is the CURRENT state: three rules are Builder-only
// until the Assessor's prompt is extended, which waits on Toni signing off
// the present calibration (changing the prompt now would move the baseline
// she is judging).
export const RULES = [
  {
    key: "need_required",
    statement: "No project can be generated, or scored as credible, without a stated school need backed by evidence.",
    golden_thread: "need_evidenced",
    strength_area: "Needs analysis",
    enforced_by: ["assessor", "builder"],
  },
  {
    key: "not_destination_led",
    statement: "No project can be destination-led: country, trip and itinerary follow from the need and objective, never precede them.",
    golden_thread: "activities_deliver_objectives",
    strength_area: "Erasmus alignment",
    enforced_by: ["assessor", "builder"],
  },
  {
    key: "inclusion_embedded",
    statement: "Every project embeds practical Inclusion & Diversity: barriers named, support planned, selection fair and never ability-to-pay.",
    golden_thread: "inclusion_practical",
    strength_area: "Inclusion",
    enforced_by: ["assessor", "builder"],
  },
  {
    key: "measurable_outcomes",
    statement: "Every objective has a realistic way to measure success: a baseline, an indicator and a target or evidence.",
    golden_thread: "measures_exist",
    strength_area: "Impact measurement",
    enforced_by: ["assessor", "builder"],
  },
  {
    key: "pre_mobility_activity",
    statement: "Every project contains pre-mobility activity that prepares participants and establishes a baseline before anyone travels.",
    golden_thread: "activities_deliver_objectives",
    strength_area: "Pre-mobility planning",
    enforced_by: ["assessor", "builder"],
  },
  {
    key: "mobility_serves_objective",
    statement: "Every mobility activity connects to a stated objective; sightseeing, free time and tours count only when tied to a learning outcome.",
    golden_thread: "activities_deliver_objectives",
    strength_area: "Mobility learning",
    enforced_by: ["assessor", "builder"],
  },
  {
    key: "post_mobility_activity",
    statement: "Every project describes how learning continues after travel: concrete follow-up with named owners and timeframes.",
    golden_thread: "legacy_defined",
    strength_area: "Integration",
    enforced_by: ["assessor", "builder"],
  },
  {
    key: "evaluation_method",
    statement: "Every project contains an evaluation method that mirrors its objectives.",
    golden_thread: "measures_exist",
    strength_area: "Impact measurement",
    enforced_by: ["assessor", "builder"],
  },
  {
    key: "school_owns_core_tasks",
    statement: "The school retains ownership of core tasks (selection, learning outcomes, finance, NA contact); any supporting organisation's role is limited and practical.",
    golden_thread: "school_ownership",
    strength_area: "Erasmus alignment",
    enforced_by: ["assessor", "builder"],
  },
  {
    key: "partner_educational_reason",
    statement: "Every partner has an educational reason for being selected — never tourism, landmarks, popularity, weather or cost.",
    golden_thread: null,
    strength_area: "Partner rationale",
    enforced_by: ["builder"],
  },
  {
    key: "international_added_value",
    statement: "Every project explains what each school contributes and why the collaboration produces something neither could alone.",
    golden_thread: null,
    strength_area: "International added value",
    enforced_by: ["builder"],
  },
  {
    key: "dissemination_planned",
    statement: "Every project plans to share results internally and externally and to acknowledge EU funding — beyond photographs.",
    golden_thread: null,
    strength_area: "Dissemination",
    enforced_by: ["builder"],
  },
] as const satisfies readonly {
  key: string;
  statement: string;
  golden_thread: (typeof GOLDEN_THREAD)[number]["key"] | null;
  strength_area: string;
  enforced_by: readonly RuleConsumer[];
}[];

// The Builder's §31 Strength Check rows, derived from RULES so they cannot
// drift from it. "Integration" is not in the spec's §31 list — the spec has no
// legacy/follow-up area at all, despite follow-up being 30 of the 100 marks.
export const STRENGTH_AREAS = [...new Set(RULES.map((r) => r.strength_area))];

// Everything a consumer needs, JSON-serialisable, in one object.
export function ruleset() {
  return {
    version: RULESET_VERSION,
    action_type: ACTION_TYPE,
    criteria: CRITERIA,
    thresholds: THRESHOLDS,
    sections: SECTIONS,
    golden_thread: GOLDEN_THREAD,
    rules: RULES,
    strength_areas: STRENGTH_AREAS,
  };
}

export function criterionMax(key: string) {
  return CRITERIA.find((c) => c.key === key)?.max ?? 0;
}
