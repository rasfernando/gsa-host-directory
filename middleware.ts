import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase auth session on every request,
// and guards /admin and /apply behind login.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[]
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const needsAuth =
    path.startsWith("/admin") ||
    path.startsWith("/apply") ||
    path.startsWith("/your-school");

  if (needsAuth && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  // ── Soft-launch gate (Workstream C) ───────────────────────────────────────
  // Only anonymous visitors are ever gated; any signed-in user (host, agent,
  // admin) passes. Mode lives in app_settings (admin-flippable), with an
  // optional LAUNCH_MODE env override for emergencies.
  if (!user) {
    let mode = process.env.LAUNCH_MODE ?? "";
    let showcase = "";
    if (mode !== "public") {
      const { data: settings } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["launch_mode", "showcase_slug"]);
      const map = new Map((settings ?? []).map((s) => [s.key, s.value ?? ""]));
      if (!mode) mode = map.get("launch_mode") ?? "public";
      showcase = map.get("showcase_slug") ?? "";
    }

    if (mode === "onboarding") {
      const allowed =
        path === "/coming-soon" ||
        path.startsWith("/login") ||
        path.startsWith("/auth") ||
        path.startsWith("/onboard") ||
        path.startsWith("/api") ||
        path.startsWith("/pay") ||
        path === "/accreditation" ||
        path === "/privacy" ||
        path === "/terms" ||
        (showcase !== "" && path === `/directory/${showcase}`) ||
        (showcase !== "" && path.startsWith(`/directory/${showcase}/`));

      if (!allowed) {
        const url = request.nextUrl.clone();
        url.pathname = "/coming-soon";
        url.search = "";
        return NextResponse.redirect(url);
      }
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
