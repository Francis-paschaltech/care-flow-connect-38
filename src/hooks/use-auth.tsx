import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/clinic";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      setLoading(false);
      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        queryClient.invalidateQueries();
      }
      if (event === "SIGNED_OUT") {
        queryClient.clear();
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [queryClient]);

  return { session, user: session?.user ?? null, loading };
}

export type CurrentUser = {
  userId: string;
  email: string;
  fullName: string;
  role: AppRole;
  patientId: string | null;
  doctorId: string | null;
  doctorName: string | null;
};

export function useCurrentUser() {
  const { user, loading } = useSession();

  const query = useQuery({
    queryKey: ["current-user", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<CurrentUser> => {
      const uid = user!.id;
      const [profileRes, rolesRes, patientRes, doctorRes] = await Promise.all([
        supabase.from("profiles").select("full_name, email").eq("id", uid).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", uid),
        supabase.from("patients").select("id").eq("user_id", uid).maybeSingle(),
        supabase.from("doctors").select("id, full_name").eq("user_id", uid).maybeSingle(),
      ]);

      const role = (rolesRes.data?.[0]?.role ?? "patient") as AppRole;
      return {
        userId: uid,
        email: profileRes.data?.email ?? user!.email ?? "",
        fullName:
          profileRes.data?.full_name || (user!.user_metadata?.full_name as string) || "Member",
        role,
        patientId: patientRes.data?.id ?? null,
        doctorId: doctorRes.data?.id ?? null,
        doctorName: doctorRes.data?.full_name ?? null,
      };
    },
  });

  return { ...query, loading: loading || query.isLoading, user };
}

export function isStaffRole(role: AppRole | undefined) {
  return role === "doctor" || role === "nurse" || role === "receptionist" || role === "admin";
}
