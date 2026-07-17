// Verification checklist for host school accreditation.
// PLACEHOLDER STANDARD — to be finalised with GSA (see scope doc, open question 1).
// Stored per-application in verification_checks keyed by `key`.
export const VERIFICATION_CHECKS = [
  {
    key: "safeguarding_policy",
    label: "Safeguarding policy reviewed",
    description: "School has provided a current child protection / safeguarding policy.",
  },
  {
    key: "child_protection_lead",
    label: "Designated safeguarding lead confirmed",
    description: "Named lead with contact details verified.",
  },
  {
    key: "health_safety",
    label: "Health & safety policies reviewed",
    description: "Current H&S policy and risk assessments provided.",
  },
  {
    key: "identity_registration",
    label: "School identity & registration verified",
    description: "Evidence the school is legally registered (URN / national ID / certificate) and the applicant represents it.",
  },
  {
    key: "insurance",
    label: "Public liability insurance confirmed",
    description: "Policy number and certificate covering visiting groups.",
  },
  {
    key: "virtual_meeting",
    label: "Virtual meeting completed",
    description: "GSA has met school leadership via video call and viewed facilities.",
  },
] as const;

export type CheckKey = (typeof VERIFICATION_CHECKS)[number]["key"];

// Verification checklist for tourism / in-country suppliers.
// Placeholder standard — expand with GSA as the supplier programme firms up.
export const SUPPLIER_CHECKS = [
  {
    key: "company_identity",
    label: "Company identity verified",
    description: "Evidence the business is legally registered and the contact represents it.",
  },
  {
    key: "terms_conditions",
    label: "Terms & conditions reviewed",
    description: "Supplier's current terms & conditions on file.",
  },
  {
    key: "insurance",
    label: "Insurance confirmed",
    description: "Valid insurance certificate covering the services provided.",
  },
  {
    key: "certification",
    label: "Certifications / licences verified",
    description: "Relevant certifications, licences or safety accreditations provided.",
  },
  {
    key: "intro_call",
    label: "Intro call completed",
    description: "GSA has met the supplier and understands their offering.",
  },
] as const;

// Document categories a supplier uploads (logo is stored separately).
export const SUPPLIER_DOC_CATEGORIES: { key: string; label: string; hint: string }[] = [
  { key: "terms_conditions", label: "Terms & conditions", hint: "Your current T&Cs." },
  { key: "insurance", label: "Insurance certificate", hint: "Valid cover for the services you provide." },
  { key: "certification", label: "Certifications / licences", hint: "Safety accreditations, operating licences, etc." },
  { key: "other", label: "Other supporting documents", hint: "Anything else relevant to verification." },
];
