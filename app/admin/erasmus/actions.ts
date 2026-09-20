"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assessDraft } from "@/lib/erasmus/assess";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "gsa_admin") throw new Error("Not an admin");
  return { supabase, user };
}

export async function runAssessment(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const schoolName = String(formData.get("school_name") || "").trim();
  const projectTitle = String(formData.get("project_title") || "").trim() || null;
  const draft = String(formData.get("draft") || "").trim();

  if (!schoolName) throw new Error("School name is required");
  if (draft.length < 200) throw new Error("Paste at least a full section of the draft (200+ characters)");
  if (draft.length > 60000) throw new Error("Draft is too long — paste up to ~60,000 characters at a time");

  const { data: row, error } = await supabase
    .from("erasmus_assessments")
    .insert({
      created_by: user.id,
      school_name: schoolName,
      project_title: projectTitle,
      draft,
      status: "pending",
    })
    .select("id")
    .single();
  if (error || !row) throw new Error(error?.message ?? "Could not save the draft");

  try {
    const { assessment, model, durationMs } = await assessDraft({ schoolName, projectTitle, draft });
    await supabase
      .from("erasmus_assessments")
      .update({ status: "complete", result: assessment, model, duration_ms: durationMs })
      .eq("id", row.id);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await supabase
      .from("erasmus_assessments")
      .update({ status: "failed", error: message })
      .eq("id", row.id);
  }

  revalidatePath("/admin/erasmus");
  redirect(`/admin/erasmus/${row.id}`);
}

export async function deleteAssessment(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id"));
  await supabase.from("erasmus_assessments").delete().eq("id", id);
  revalidatePath("/admin/erasmus");
  redirect("/admin/erasmus");
}
