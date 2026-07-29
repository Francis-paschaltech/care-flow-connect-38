import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandMark } from "@/components/app/app-shell";

export const Route = createFileRoute("/reset-password")({
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
          <div className="space-y-2">
            <Label htmlFor="rp-password">New password</Label>
            <Input
              id="rp-password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rp-confirm">Confirm password</Label>
            <Input
              id="rp-confirm"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
            />
          </div>
          {error ? (
            <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={loading}>
            Update password
          </Button>
        </form>
      </div>
    </main>
  );
}
