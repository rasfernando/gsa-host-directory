// All money on the platform is integer pennies, GBP. Never floats.

export const DEPOSIT_PENNIES = 100_000; // £1,000 refundable deposit
export const PLAN_ADJUST_RATE = 0.1; // pay upfront: -10%; payment plan: +10%

export function formatPounds(pennies: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: pennies % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(pennies / 100);
}

// ±10% adjustment, rounded to the nearest penny (mirrors the DB function).
export function adjustment(basePennies: number): number {
  return Math.round(basePennies * PLAN_ADJUST_RATE);
}

export function upfrontTotal(basePennies: number): number {
  return basePennies - adjustment(basePennies);
}

export function planTotal(basePennies: number): number {
  return basePennies + adjustment(basePennies);
}

// Split a total across n payers so the parts always sum exactly to the total:
// the first `remainder` payers carry one extra penny (same rule as the DB).
export function splitPennies(totalPennies: number, n: number): number[] {
  const share = Math.floor(totalPennies / n);
  const remainder = totalPennies - share * n;
  return Array.from({ length: n }, (_, i) => share + (i < remainder ? 1 : 0));
}
