import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandMark } from "@/components/app/app-shell";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — CareConnect" },
      {
        name: "description",
        content: "Request a secure password reset link for your CareConnect clinic account.",
      },
      { property: "og:title", content: "Reset your password — CareConnect" },
      {
        property: "og:description",
        content: "Request a secure password reset link for your CareConnect account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
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
            const parsed = z.string().trim().email().safeParse(email);
            if (!parsed.success) {
              setError("Enter a valid email address");
              return;
            }
            setLoading(true);
            await supabase.auth.resetPasswordForEmail(parsed.data, {
              redirectTo: `${window.location.origin}/reset-password`,
            });
            setLoading(false);
            setSent(true);
            toast.success("If that email exists, a reset link is on its way.");
          }}
        >
          <h1 className="text-xl font-bold">Forgot password</h1>
          <p className="text-sm text-muted-foreground">
            Enter the email registered with the clinic and we'll send a secure reset link.
          </p>
          <div className="space-y-2">
            <Label htmlFor="fp-email">Email</Label>
            <Input
              id="fp-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          {error ? (
            <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          {sent ? (
            <p className="rounded-md bg-success-soft px-3 py-2 text-sm text-success">
              Check your inbox for the reset link.
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={loading}>
            Send reset link
          </Button>
          <Link to="/auth" className="block text-center text-sm text-primary hover:underline">
            Back to sign in
          </Link>
        </form>
      </div>
    </main>
  );
}
