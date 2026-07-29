import { redirect } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "./clinic";

export const STAFF_ROLES: AppRole[] = ["doctor", "nurse", "receptionist", "admin"];

/**
 * Route-level role guard. Runs client-side (the `_authenticated` layout is
 * `ssr: false`), fetches the caller's role from the database — never from
 * client state — and bounces unauthorised users back to the dashboard with a
 * clear message instead of rendering an empty/broken page.
 *
 * This is defence in depth: RLS on the database is still the source of truth.
 */
export async function requireRoles(allowed: AppRole[]) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw redirect({ to: "/auth", search: { mode: "login" } });
  }

  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id);

  if (error) {
    console.error("Role check failed", error);
    toast.error("We could not verify your permissions. Please try again.");
    throw redirect({ to: "/dashboard" });
  }

  const roles = (data ?? []).map((row) => row.role as AppRole);
  if (!roles.some((role) => allowed.includes(role))) {
    toast.error("You don't have access to that area of CareConnect.");
    throw redirect({ to: "/dashboard" });
  }

  return { role: roles[0] };
}
