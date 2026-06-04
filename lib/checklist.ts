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
    key: "identity_registration",
    label: "School identity & registration verified",
    description: "School exists, is registered with its national education authority, and the applicant represents it.",
  },
  {
    key: "references",
    label: "References checked",
    description: "At least two references from partner schools or education bodies.",
  },
  {
    key: "insurance",
    label: "Insurance confirmed",
    description: "Public liability insurance covering visiting groups.",
  },
  {
    key: "virtual_meeting",
    label: "Virtual meeting completed",
    description: "GSA has met school leadership via video call and viewed facilities.",
  },
] as const;

export type CheckKey = (typeof VERIFICATION_CHECKS)[number]["key"];
