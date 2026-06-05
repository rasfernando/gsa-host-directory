import Link from "next/link";
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

  return (
    <div>
      <nav className="mb-8 flex gap-4 border-b border-gray-100 pb-3 text-sm">
        <Link href="/admin" className="font-medium text-gray-700 hover:text-gray-900">
          Review queue
        </Link>
        <Link href="/admin/profiles" className="font-medium text-gray-700 hover:text-gray-900">
          Profiles
        </Link>
        <Link href="/admin/enquiries" className="font-medium text-gray-700 hover:text-gray-900">
          Enquiries
        </Link>
        <Link href="/admin/metrics" className="font-medium text-gray-700 hover:text-gray-900">
          Metrics
        </Link>
      </nav>
      {children}
    </div>
  );
}
