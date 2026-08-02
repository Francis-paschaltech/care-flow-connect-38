import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/app/app-shell";

export const Route = createFileRoute("/auth_/callback")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Completing sign-in — WellCare" },
      {
        name: "description",
        content: "Finishing your WellCare sign-in and returning you to your dashboard.",
      },
      { property: "og:title", content: "Completing sign-in — WellCare" },
      {
        property: "og:description",
        content: "Finishing your WellCare sign-in securely.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthCallback,
});

/**
 * Public OAuth landing route. Supabase redirects here after Google sign-in;
 * we wait for the session to hydrate and only then move the user into the
 * protected area (redirecting straight to /dashboard can race the session
 * and bounce back to /auth).
 */
function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const providerError =
      params.get("error_description") ??
      new URLSearchParams(window.location.search).get("error_description");
    if (providerError) {
      setError(providerError);
      return;
    }

    const finish = async () => {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (cancelled) return;
      if (sessionError) {
        setError("We could not complete the sign-in. Please try again.");
        return;
      }
      if (data.session) {
        navigate({ to: "/dashboard", replace: true });
      }
    };

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && !cancelled) navigate({ to: "/dashboard", replace: true });
    });

    void finish();
    const timeout = window.setTimeout(() => {
      if (!cancelled) setError("Sign-in timed out. Please try again.");
    }, 8000);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      subscription.subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <BrandMark className="text-foreground" />
      {error ? (
        <>
          <h1 className="text-xl font-bold">Sign-in could not be completed</h1>
          <p role="alert" className="max-w-md text-sm text-muted-foreground">
            {error}
          </p>
          <Button onClick={() => navigate({ to: "/auth", search: { mode: "login" } })}>
            Back to sign in
          </Button>
        </>
      ) : (
        <>
          <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
          <p className="text-sm text-muted-foreground">Completing your sign-in…</p>
        </>
      )}
    </div>
  );
}
