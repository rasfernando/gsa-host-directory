"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { LOCALES, LOCALE_COOKIE } from "@/i18n/request";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

// Whole-site language switch (cookie-based, covers deep pages too).
export async function setLocale(formData: FormData) {
  const locale = String(formData.get("locale"));
  if ((LOCALES as readonly string[]).includes(locale)) {
    const store = await cookies();
    store.set(LOCALE_COOKIE, locale, { maxAge: 60 * 60 * 24 * 365, path: "/" });
  }
  revalidatePath("/", "layout");
  const { headers } = await import("next/headers");
  const referer = (await headers()).get("referer");
  redirect(referer ?? "/");
}
