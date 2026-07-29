import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    // Protected clinic data requires a verified email address. Accounts created
    // by an administrator are confirmed at creation time.
    if (!data.user.email_confirmed_at && !data.user.confirmed_at) {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth", search: { mode: "login" } });
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});
