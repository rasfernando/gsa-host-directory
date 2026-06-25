// Shared form constants and Tailwind class strings for customer-facing forms.

export const FOCUS_AREAS = [
  "Sustainability",
  "STEM",
  "Inclusion & SEND",
  "Cultural programmes",
  "Digital & AI",
  "Active citizenship",
];

// Common subject strengths offered as quick-picks; the field also accepts
// free additions ("add your own").
export const SUBJECT_SUGGESTIONS = [
  "Art",
  "Music",
  "Languages",
  "STEM",
  "Science",
  "Maths",
  "Engineering",
  "Computer Science",
  "Robotics",
  "Geography",
  "History",
  "Environmental Science",
  "Marine Biology",
  "Design",
  "Sport",
  "Drama",
];

// Contact role dropdown (last option drives a free-text "Other" field).
export const CONTACT_ROLES = [
  "Headteacher / Principal",
  "CEO",
  "Senior Leader",
  "Business Manager / Administrator",
  "Teacher",
  "Support Staff",
  "Other",
];

// Age band is a display label; numeric from/to still drive directory filters.
// `min`/`max` pre-fill the numeric fields when a band is chosen.
export const AGE_BANDS = [
  { value: "Primary", label: "Primary (9–11)", min: 9, max: 11 },
  { value: "Secondary", label: "Secondary (12–16)", min: 12, max: 16 },
  { value: "All-through", label: "All-through (9–16)", min: 9, max: 16 },
  { value: "Higher Education", label: "Higher Education (16–18)", min: 16, max: 18 },
  { value: "Other", label: "Other", min: null, max: null },
] as const;

// Common languages as quick-picks; the field also takes free additions.
export const LANGUAGE_SUGGESTIONS = [
  "English",
  "Spanish",
  "French",
  "German",
  "Italian",
  "Portuguese",
  "Mandarin",
  "Cantonese",
  "Japanese",
  "Arabic",
  "Hindi",
  "Polish",
  "Dutch",
  "Swedish",
  "Vietnamese",
  "Indonesian",
  "Catalan",
  "Welsh",
];

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

// Accept a website without the scheme ("school.org") and normalise to a full
// https:// URL. Returns null for blank input. Leaves http(s):// as-is.
export function normalizeUrl(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v.replace(/^\/+/, "")}`;
}

export const inputCls =
  "mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-brand-600 focus:outline-none";
export const labelCls = "block text-sm font-medium";
