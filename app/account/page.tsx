import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { ChangePasswordForm } from "@/components/change-password-form";
import { changePassword } from "./actions";

export const dynamic = "force-dynamic";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ pw?: string }>;
}) {
  const { pw } = await searchParams;
  const t = await getTranslations("account");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account");

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
      <p className="mt-2 text-sm text-stone-500">
        {t("signedInAs")} <strong>{user.email}</strong>
      </p>

      <section className="mt-6 rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-bold tracking-tight">{t("passwordTitle")}</h2>
        <p className="mt-1 text-sm text-stone-500">{t("passwordBody")}</p>

        {pw === "changed" && (
          <p className="mt-3 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
            {t("changed")}
          </p>
        )}
        {pw === "short" && (
          <p className="mt-3 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">
            {t("short")}
          </p>
        )}
        {pw === "mismatch" && (
          <p className="mt-3 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">
            {t("mismatch")}
          </p>
        )}
        {pw === "error" && (
          <p className="mt-3 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">
            {t("error")}
          </p>
        )}

        <ChangePasswordForm
          action={changePassword}
          labels={{
            newPassword: t("newPassword"),
            confirmPassword: t("confirmPassword"),
            update: t("update"),
            mismatch: t("mismatch"),
          }}
        />
      </section>
    </div>
  );
}
