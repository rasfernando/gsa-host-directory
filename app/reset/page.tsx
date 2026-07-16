import { getTranslations } from "next-intl/server";
import { ResetRequestForm } from "@/components/reset-forms";

export default async function ResetPage() {
  const t = await getTranslations("reset");
  return (
    <div className="mx-auto max-w-sm py-16">
      <h1 className="text-3xl font-bold tracking-tight">{t("requestTitle")}</h1>
      <p className="mb-6 mt-2 text-sm text-stone-500">{t("requestBody")}</p>
      <ResetRequestForm
        labels={{
          emailLabel: t("emailLabel"),
          send: t("send"),
          working: t("working"),
          sent: t("sent"),
          backToLogin: t("backToLogin"),
        }}
      />
    </div>
  );
}
