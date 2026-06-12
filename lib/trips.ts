// Shared display helpers for the trip/booking flow.

export const TRIP_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  reserved: "Reserved",
  deposit_paid: "Deposit paid",
  invoiced: "Invoiced",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  completed: "Completed",
};

// Emerald is reserved for accreditation; payment states use brand/warm/stone.
export const TRIP_STATUS_CHIP: Record<string, string> = {
  draft: "bg-stone-100 text-stone-600",
  reserved: "bg-brand-50 text-brand-700",
  deposit_paid: "bg-brand-100 text-brand-800",
  invoiced: "bg-warm-50 text-warm-700",
  confirmed: "bg-brand-700 text-white",
  cancelled: "bg-stone-200 text-stone-500",
  completed: "bg-stone-900 text-white",
};

export const IMPACT_OBJECTIVES = [
  "Cultural immersion",
  "Language confidence",
  "Global citizenship",
  "Curriculum enrichment",
  "Student leadership",
  "Community connection",
] as const;

export const CATEGORY_LABELS: Record<string, string> = {
  immersion_camp: "Immersion / Camp",
  flight: "Flights",
  attraction: "Attractions",
  accommodation: "Accommodation",
  other: "Other",
};

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function daysUntil(d: string | Date | null | undefined): number | null {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000);
}
