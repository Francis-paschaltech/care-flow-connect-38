import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { BrandMark } from "@/components/app/app-shell";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Choose a new password — CareConnect" },
      {
        name: "description",
        content: "Set a new password for your CareConnect clinic account.",
      },
      { property: "og:title", content: "Choose a new password — CareConnect" },
      {
        property: "og:description",
        content: "Set a new password for your CareConnect clinic account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResetPassword,
});

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Include at least one uppercase letter")
  .regex(/[a-z]/, "Include at least one lowercase letter")
  .regex(/\d/, "Include at least one number");

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // A valid reset link puts Supabase into a recovery session. Without one the
  // update call would always fail, so block the form instead.
  const [sessionState, setSessionState] = useState<"checking" | "ready" | "invalid">("checking");

  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || session) setSessionState("ready");
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSessionState((prev) => (data.session ? "ready" : prev === "ready" ? prev : "invalid"));
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 inline-block">
          <BrandMark className="text-foreground" />
        </Link>
        <form
          className="surface-panel space-y-4 p-6"
          noValidate
          onSubmit={async (event) => {
            event.preventDefault();
            setError(null);
            if (sessionState !== "ready") {
              setError("This reset link is invalid or has expired. Request a new one.");
              return;
            }
            const parsed = passwordSchema.safeParse(password);
            if (!parsed.success) {
              setError(parsed.error.issues[0].message);
              return;
            }
            if (password !== confirm) {
              setError("Passwords do not match");
              return;
            }
            setLoading(true);
            const { error: updateError } = await supabase.auth.updateUser({ password });
            setLoading(false);
            if (updateError) {
              setError("This reset link is invalid or has expired. Request a new one.");
              return;
            }
            toast.success("Password updated");
            navigate({ to: "/dashboard" });
          }}
        >
          <h1 className="text-xl font-bold">Choose a new password</h1>
          {sessionState === "invalid" ? (
            <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-destructive">
              This reset link is invalid or has expired.{" "}
              <Link to="/forgot-password" className="underline">
                Request a new one
              </Link>
              .
            </p>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="rp-password">New password</Label>
            <PasswordInput
              id="rp-password"
              autoComplete="new-password"
              required
              disabled={sessionState !== "ready"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rp-confirm">Confirm password</Label>
            <PasswordInput
              id="rp-confirm"
              autoComplete="new-password"
              required
              disabled={sessionState !== "ready"}
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
            />
          </div>
          {error ? (
            <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={loading || sessionState !== "ready"}>
            Update password
          </Button>
        </form>
      </div>
    </main>
  );
}
