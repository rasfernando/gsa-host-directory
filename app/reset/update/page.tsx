import { getTranslations } from "next-intl/server";
import { ResetUpdateForm } from "@/components/reset-forms";

export default async function ResetUpdatePage() {
  const t = await getTranslations("reset");
  return (
    <div className="mx-auto max-w-sm py-16">
      <h1 className="text-3xl font-bold tracking-tight">{t("updateTitle")}</h1>
      <p className="mb-6 mt-2 text-sm text-stone-500">{t("updateBody")}</p>
      <ResetUpdateForm
        labels={{
          newPasswordLabel: t("newPasswordLabel"),
          update: t("update"),
          working: t("working"),
          updated: t("updated"),
          goToApp: t("goToApp"),
        }}
      />
    </div>
  );
}
