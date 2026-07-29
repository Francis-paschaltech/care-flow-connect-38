import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const notificationSchema = z.object({
  recipients: z.array(z.string().uuid()).min(1).max(20),
  title: z.string().trim().min(2).max(160),
  message: z.string().trim().min(2).max(500),
  kind: z.enum(["info", "success", "warning", "error"]).default("info"),
});

/**
 * Server-side notification creation.
 *
 * Runs with the caller's own Supabase session (RLS still applies), so a
 * patient can only notify themselves while staff may notify the people they
 * are allowed to see. No RLS weakening, no service-role usage.
 */
export const createNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => notificationSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isStaff } = await context.supabase.rpc("is_staff", {
      _user_id: context.userId,
    });

    // A non-staff user may only ever address themselves.
    const recipients = isStaff
      ? Array.from(new Set(data.recipients))
      : Array.from(new Set(data.recipients)).filter((id) => id === context.userId);

    if (recipients.length === 0) return { created: 0 };

    const { error } = await context.supabase.from("notifications").insert(
      recipients.map((userId) => ({
        user_id: userId,
        title: data.title,
        message: data.message,
        kind: data.kind,
      })),
    );
    if (error) throw new Error(error.message);

    return { created: recipients.length };
  });
