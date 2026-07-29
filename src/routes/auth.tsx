import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BrandMark } from "@/components/app/app-shell";
import { roleLabels, type AppRole } from "@/lib/clinic";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => ({
    mode: search.mode === "register" ? ("register" as const) : ("login" as const),
  }),
  head: () => ({
    meta: [
      { title: "Sign in or register — CareConnect" },
      {
        name: "description",
        content:
          "Sign in to CareConnect or register as a patient to book clinic appointments and view your medical history.",
      },
      { property: "og:title", content: "Sign in or register — CareConnect" },
      {
        property: "og:description",
        content: "Access your CareConnect clinic account to manage appointments and records.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email("Enter a valid email address").max(255);
const phoneSchema = z
  .string()
  .trim()
  .regex(/^[+]?[\d\s-]{7,20}$/, "Enter a valid phone number");

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Include at least one uppercase letter")
  .regex(/[a-z]/, "Include at least one lowercase letter")
  .regex(/\d/, "Include at least one number");

function passwordScore(value: string) {
  let score = 0;
  if (value.length >= 8) score++;
  if (/[A-Z]/.test(value)) score++;
  if (/\d/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value)) score++;
  return score;
}

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <Link to="/">
          <BrandMark />
        </Link>
        <div>
          <h2 className="max-w-md text-3xl font-extrabold leading-tight text-sidebar-foreground">
            One connected record for every appointment, visit and prescription.
          </h2>
          <p className="mt-4 max-w-md text-sm text-sidebar-foreground/75">
            CareConnect keeps patients, clinicians and front-desk staff working from the same
            schedule — with role-based access protecting every patient file.
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/60">
          Encrypted credentials · Role-based permissions · Audit-logged activity
        </p>
      </div>

      <div className="flex items-center justify-center bg-background px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-6 lg:hidden">
            <Link to="/">
              <BrandMark className="text-foreground" />
            </Link>
          </div>
          <Tabs
            value={mode}
            onValueChange={(value) =>
              navigate({ to: "/auth", search: { mode: value === "register" ? "register" : "login" } })
            }
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <LoginForm />
            </TabsContent>
            <TabsContent value="register">
              <RegisterForm />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function GoogleButton() {
  const [loading, setLoading] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        const result = await lovable.auth.signInWithOAuth("google", {
          redirect_uri: window.location.origin,
        });
        if (result.error) {
          setLoading(false);
          toast.error("Google sign-in failed. Please try again.");
          return;
        }
        if (result.redirected) return;
        window.location.href = "/dashboard";
      }}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : null}
      Continue with Google
    </Button>
  );
}

function LoginForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <form
      className="surface-panel mt-4 space-y-4 p-6"
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        setError(null);
        const parsed = emailSchema.safeParse(email);
        if (!parsed.success) {
          setError(parsed.error.issues[0].message);
          return;
        }
        setLoading(true);
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: parsed.data,
          password,
        });
        setLoading(false);
        if (signInError) {
          setError("Invalid email or password. Please try again.");
          return;
        }
        toast.success("Welcome back to CareConnect");
        navigate({ to: "/dashboard" });
      }}
    >
      <div>
        <h1 className="text-xl font-bold">Sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Access your dashboard, appointments and records.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="login-email">Email</Label>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="login-password">Password</Label>
        <Input
          id="login-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>

      {error ? (
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? <Loader2 className="size-4 animate-spin" /> : null}
        Sign in
      </Button>
      <GoogleButton />
      <div className="flex justify-between text-sm">
        <Link to="/forgot-password" className="text-primary hover:underline">
          Forgot password?
        </Link>
        <Link to="/auth" search={{ mode: "register" }} className="text-muted-foreground hover:text-primary">
          Create an account
        </Link>
      </div>
    </form>
  );
}

const ROLE_OPTIONS: AppRole[] = ["patient", "doctor", "nurse", "receptionist", "admin"];

function RegisterForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    dateOfBirth: "",
    gender: "Female",
    role: "patient" as AppRole,
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const score = passwordScore(form.password);

  const update = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <form
      className="surface-panel mt-4 space-y-4 p-6"
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        setError(null);
        const schema = z.object({
          fullName: z.string().trim().min(2, "Enter your full name").max(120),
          email: emailSchema,
          phone: phoneSchema,
          password: passwordSchema,
        });
        const parsed = schema.safeParse(form);
        if (!parsed.success) {
          setError(parsed.error.issues[0].message);
          return;
        }
        setLoading(true);
        const { error: signUpError } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: {
              full_name: parsed.data.fullName,
              phone: parsed.data.phone,
              gender: form.gender,
              date_of_birth: form.dateOfBirth,
              role: form.role,
            },
          },
        });
        setLoading(false);
        if (signUpError) {
          setError(
            signUpError.message.includes("already")
              ? "An account with this email already exists. Try signing in."
              : signUpError.message,
          );
          return;
        }
        toast.success("Account created — welcome to CareConnect");
        navigate({ to: "/dashboard" });
      }}
    >
      <div>
        <h1 className="text-xl font-bold">Create your account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Fields marked <span className="text-destructive">*</span> are required. Your information is
          only visible to your care team.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="reg-name">
          Full name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="reg-name"
          required
          value={form.fullName}
          onChange={(event) => update("fullName", event.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="reg-email">
            Email <span className="text-destructive">*</span>
          </Label>
          <Input
            id="reg-email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(event) => update("email", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reg-phone">
            Phone number <span className="text-destructive">*</span>
          </Label>
          <Input
            id="reg-phone"
            type="tel"
            required
            placeholder="0803 201 4477"
            value={form.phone}
            onChange={(event) => update("phone", event.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="reg-dob">Date of birth</Label>
          <Input
            id="reg-dob"
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            value={form.dateOfBirth}
            onChange={(event) => update("dateOfBirth", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reg-gender">Gender</Label>
          <Select value={form.gender} onValueChange={(value) => update("gender", value)}>
            <SelectTrigger id="reg-gender">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["Female", "Male", "Other"].map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="reg-role">Account type</Label>
        <Select value={form.role} onValueChange={(value) => update("role", value)}>
          <SelectTrigger id="reg-role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {roleLabels[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Staff account types are open in this demonstration deployment so every role can be
          reviewed.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="reg-password">
          Password <span className="text-destructive">*</span>
        </Label>
        <Input
          id="reg-password"
          type="password"
          autoComplete="new-password"
          required
          value={form.password}
          onChange={(event) => update("password", event.target.value)}
        />
        <div className="flex gap-1" aria-hidden>
          {[0, 1, 2, 3].map((index) => (
            <span
              key={index}
              className={`h-1.5 flex-1 rounded-full ${
                index < score ? (score >= 3 ? "bg-success" : "bg-warning") : "bg-muted"
              }`}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Minimum 8 characters with an uppercase letter, a lowercase letter and a number.
        </p>
      </div>

      {error ? (
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? <Loader2 className="size-4 animate-spin" /> : null}
        Create account
      </Button>
      <GoogleButton />
    </form>
  );
}
