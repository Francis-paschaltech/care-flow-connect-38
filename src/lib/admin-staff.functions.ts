import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const staffRoles = ["doctor", "nurse", "receptionist", "admin"] as const;
const allRoles = ["patient", ...staffRoles] as const;

type AnyRole = (typeof allRoles)[number];

const staffSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/)
    .regex(/[a-z]/)
    .regex(/\d/),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  role: z.enum(staffRoles),
  specialty: z.string().trim().max(120).optional().or(z.literal("")),
  departmentId: z.string().uuid().optional().or(z.literal("")),
});

export type CreateStaffInput = z.infer<typeof staffSchema>;

/** Throws unless the caller is a signed-in administrator (verified in the DB). */
async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error("Could not verify administrator permissions.");
  if (!isAdmin) throw new Error("Forbidden: administrator access is required.");
}

type AuditEntry = {
  actorId: string;
  action: string;
  entity: string;
  detail?: string;
  targetUserId?: string | null;
  previousRole?: AnyRole | null;
  newRole?: AnyRole | null;
  success: boolean;
};

async function writeAudit(admin: any, entry: AuditEntry) {
  const { error } = await admin.from("audit_logs").insert({
    actor: entry.actorId,
    actor_id: entry.actorId,
    action: entry.action,
    entity: entry.entity,
    detail: entry.detail ?? null,
    target_user_id: entry.targetUserId ?? null,
    previous_role: entry.previousRole ?? null,
    new_role: entry.newRole ?? null,
    success: entry.success,
  });
  if (error) console.error("audit log write failed", error);
}

/**
 * Admin-only staff provisioning. The caller must be signed in AND hold the
 * `admin` role — verified server-side against the database, never from the
 * request body. Public self-registration can only ever create patients.
 *
 * Creates auth.users → profiles → user_roles → doctors (for doctors) and
 * rolls the auth user back if any dependent step fails, so no half-created
 * staff accounts are ever left behind.
 */
export const createStaffAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => staffSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.toLowerCase();

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, phone: data.phone || null },
    });
    if (createError || !created.user) {
      await writeAudit(supabaseAdmin, {
        actorId: context.userId,
        action: "create_staff_account",
        entity: "auth.users",
        detail: `Failed to create ${data.role} account for ${email}: ${createError?.message ?? "unknown error"}`,
        newRole: data.role,
        success: false,
      });
      throw new Error(createError?.message ?? "Could not create the staff account.");
    }

    const userId = created.user.id;

    const rollback = async (message: string) => {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      await writeAudit(supabaseAdmin, {
        actorId: context.userId,
        action: "create_staff_account",
        entity: "auth.users",
        detail: `Rolled back ${data.role} account for ${email}: ${message}`,
        targetUserId: userId,
        newRole: data.role,
        success: false,
      });
      throw new Error(`${message} The account was rolled back.`);
    };

    // profiles — the sign-up trigger creates it; make sure it exists and is correct.
    const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
      {
        id: userId,
        full_name: data.fullName,
        email,
        phone: data.phone || null,
      },
      { onConflict: "id" },
    );
    if (profileError) await rollback("Could not save the staff profile.");

    // user_roles — the trigger provisions `patient`; replace it under an
    // authorised admin rather than from user input.
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    const { error: insertRoleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: data.role });
    if (insertRoleError) await rollback("Could not assign the staff role.");

    // Staff are not patients — drop the auto-created patient row.
    const { error: patientCleanupError } = await supabaseAdmin
      .from("patients")
      .delete()
      .eq("user_id", userId);
    if (patientCleanupError) console.error("patient row cleanup failed", patientCleanupError);

    if (data.role === "doctor") {
      const { error: doctorError } = await supabaseAdmin.from("doctors").insert({
        user_id: userId,
        full_name: data.fullName.startsWith("Dr.") ? data.fullName : `Dr. ${data.fullName}`,
        specialty: data.specialty || "General Medicine",
        department_id: data.departmentId || null,
        email,
        phone: data.phone || null,
      });
      if (doctorError) await rollback("Could not save the doctor profile.");
    }

    await supabaseAdmin.from("notifications").insert({
      user_id: userId,
      title: "Welcome to WellCare",
      message: "An administrator created your staff account.",
      kind: "success",
    });

    await writeAudit(supabaseAdmin, {
      actorId: context.userId,
      action: "create_staff_account",
      entity: "auth.users",
      detail: `Created ${data.role} account for ${email}`,
      targetUserId: userId,
      previousRole: "patient",
      newRole: data.role,
      success: true,
    });

    return { userId, role: data.role };
  });

/** Admin-only directory of every account with its role and status. */
export const listStaffAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: profiles }, { data: roles }, { data: users }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name, email"),
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 }),
    ]);

    const roleByUser = new Map<string, AnyRole>();
    (roles ?? []).forEach((row: any) => roleByUser.set(row.user_id, row.role));

    return (users?.users ?? []).map((user) => {
      const profile = (profiles ?? []).find((p: any) => p.id === user.id);
      return {
        id: user.id,
        email: user.email ?? profile?.email ?? "",
        fullName: profile?.full_name ?? (user.user_metadata?.full_name as string) ?? "",
        role: (roleByUser.get(user.id) ?? "patient") as AnyRole,
        emailConfirmed: Boolean(user.email_confirmed_at),
        deactivated: Boolean((user as any).banned_until),
        createdAt: user.created_at,
      };
    });
  });

/** Admin-only role change. Writes a full before/after audit entry. */
export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid(), role: z.enum(allRoles) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) {
      throw new Error("You cannot change your own role.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.userId)
      .maybeSingle();
    const previousRole = (existing?.role ?? null) as AnyRole | null;

    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.userId, role: data.role });

    await writeAudit(supabaseAdmin, {
      actorId: context.userId,
      action: "set_user_role",
      entity: "user_roles",
      detail: error ? `Role change failed: ${error.message}` : `Role changed to ${data.role}`,
      targetUserId: data.userId,
      previousRole,
      newRole: data.role,
      success: !error,
    });

    if (error) throw new Error("Could not update the role.");
    return { ok: true };
  });

/** Admin-only activation toggle: bans/unbans the account and flips doctor availability. */
export const setAccountActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid(), active: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) {
      throw new Error("You cannot deactivate your own account.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.active ? "none" : "876000h",
    });

    if (!error) {
      await supabaseAdmin
        .from("doctors")
        .update({ is_active: data.active })
        .eq("user_id", data.userId);
    }

    await writeAudit(supabaseAdmin, {
      actorId: context.userId,
      action: data.active ? "reactivate_account" : "deactivate_account",
      entity: "auth.users",
      detail: error ? `Failed: ${error.message}` : data.active ? "Account reactivated" : "Account deactivated",
      targetUserId: data.userId,
      success: !error,
    });

    if (error) throw new Error("Could not update the account status.");
    return { ok: true };
  });

/** Admin-only password reset email. */
export const sendPasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ email: z.string().trim().email().max(255), redirectTo: z.string().url() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(data.email.toLowerCase(), {
      redirectTo: data.redirectTo,
    });

    await writeAudit(supabaseAdmin, {
      actorId: context.userId,
      action: "send_password_reset",
      entity: "auth.users",
      detail: error ? `Failed for ${data.email}: ${error.message}` : `Reset email sent to ${data.email}`,
      success: !error,
    });

    if (error) throw new Error("Could not send the password reset email.");
    return { ok: true };
  });
