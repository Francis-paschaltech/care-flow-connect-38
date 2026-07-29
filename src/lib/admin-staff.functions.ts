import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const staffRoles = ["doctor", "nurse", "receptionist", "admin"] as const;

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

/**
 * Admin-only staff provisioning. The caller must be signed in AND hold the
 * `admin` role — verified server-side against the database, never from the
 * request body. Public self-registration can only ever create patients.
 */
export const createStaffAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => staffSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError) throw new Error("Could not verify administrator permissions.");
    if (!isAdmin) throw new Error("Forbidden: only administrators can create staff accounts.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email.toLowerCase(),
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, phone: data.phone || null },
    });
    if (createError || !created.user) {
      throw new Error(createError?.message ?? "Could not create the staff account.");
    }

    const userId = created.user.id;

    // The sign-up trigger always provisions a patient. Staff accounts are
    // corrected here, under an authorised admin, rather than from user input.
    const { error: roleWriteError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", userId);
    if (roleWriteError) console.error("staff role cleanup failed", roleWriteError);

    const { error: insertRoleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: data.role });
    if (insertRoleError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error("Could not assign the staff role. The account was rolled back.");
    }

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
        email: data.email.toLowerCase(),
        phone: data.phone || null,
      });
      if (doctorError) {
        console.error("doctor row creation failed", doctorError);
        throw new Error("Account created, but the doctor profile could not be saved.");
      }
    }

    await supabaseAdmin.from("notifications").insert({
      user_id: userId,
      title: "Welcome to CareConnect",
      message: "An administrator created your staff account.",
      kind: "success",
    });

    await supabaseAdmin.from("audit_logs").insert({
      actor: context.userId,
      action: "create_staff_account",
      entity: "auth.users",
      detail: `Created ${data.role} account for ${data.email.toLowerCase()}`,
    });

    return { userId, role: data.role };
  });
