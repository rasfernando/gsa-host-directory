// Which product modules are switched on.
//
// V1 (per Tom, Oct 2026) is a host-school registration and onboarding tool for
// Heather, so anything outside that journey is off by default. Nothing is
// deleted — set GSA_MODULES to turn things back on:
//
//   GSA_MODULES=all              everything, i.e. how the app behaved before
//   GSA_MODULES=trips,metrics    the V1 set plus those two
//
// Unset means the V1 set below.
//
// Always on, because they are the host journey itself: /list-your-school,
// /apply, /onboard, /your-school, /admin (review queue), /admin/profiles and
// /admin/supply. Note /admin/supply is misleadingly named — it holds GSA-led
// onboarding, direct school creation, verification cohorts and the
// soft-launch visibility switch, all of which Heather needs.

export const MODULES = [
  "directory",
  "erasmus",
  "trips",
  "suppliers",
  "products",
  "credits",
  "enquiries",
  "metrics",
  "agent",
] as const;

export type Module = (typeof MODULES)[number];

// Erasmus is a separate live product Toni is already using. The public
// directory ("browse host schools") is OFF for V1: Heather (29 Oct 2026) wants
// schools to see "join the hosting network", not a shop window, so / sends
// visitors to /list-your-school and /directory is admin-only (middleware.ts).
// GSA_MODULES=directory,erasmus brings the public directory back.
const V1: Module[] = ["erasmus"];

// Route prefixes each module owns, so a disabled module loses access rather
// than just losing its nav link.
const ROUTES: Record<Module, string[]> = {
  directory: ["/directory"],
  erasmus: ["/admin/erasmus"],
  trips: ["/trips", "/admin/trips"],
  suppliers: ["/suppliers", "/for-suppliers", "/admin/suppliers"],
  products: ["/admin/products"],
  credits: ["/admin/credits"],
  enquiries: ["/admin/enquiries"],
  metrics: ["/admin/metrics"],
  agent: ["/agent"],
};

export function enabledModules(): Set<Module> {
  const raw = (process.env.GSA_MODULES ?? "").trim();
  if (!raw) return new Set(V1);
  if (raw.toLowerCase() === "all") return new Set(MODULES);
  const named = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return new Set(MODULES.filter((m) => named.includes(m)));
}

export function isEnabled(module: Module): boolean {
  return enabledModules().has(module);
}

// The module a path belongs to, but only when that module is switched off.
// Returns null for every path that should be served normally.
export function disabledModuleFor(path: string): Module | null {
  const on = enabledModules();
  for (const module of MODULES) {
    if (on.has(module)) continue;
    const owned = ROUTES[module].some(
      (prefix) => path === prefix || path.startsWith(`${prefix}/`)
    );
    if (owned) return module;
  }
  return null;
}
