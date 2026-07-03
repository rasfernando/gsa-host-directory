import { getTranslations } from "next-intl/server";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next: rawNext } = await searchParams;
  // Same-origin relative paths only — don't let ?next= carry an off-site URL
  // into the post-login redirect (defence-in-depth; /auth/confirm re-checks).
  const raw = rawNext ?? "/apply";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/apply";

  const t = await getTranslations("login");

  return (
    <div className="mx-auto max-w-sm py-16">
      <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
      <p className="mb-6 mt-2 text-sm text-stone-500">{t("subtitle")}</p>
      <LoginForm
        next={next}
        labels={{
          emailLabel: t("emailLabel"),
          emailPlaceholder: t("emailPlaceholder"),
          sending: t("sending"),
          submit: t("submit"),
          sentToTemplate: t("sentTo", { email: "{{EMAIL}}" }),
        }}
      />
    </div>
  );
}
