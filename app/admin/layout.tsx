import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Guards everything under /admin: GSA admins only.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "gsa_admin") {
    return (
      <div className="py-16 text-center text-gray-500">
        <p>This area is for the GSA team.</p>
        <p className="mt-1 text-sm">
          Signed in as {user.email} — not an admin account.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
