ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS actor_id uuid,
  ADD COLUMN IF NOT EXISTS target_user_id uuid,
  ADD COLUMN IF NOT EXISTS previous_role public.app_role,
  ADD COLUMN IF NOT EXISTS new_role public.app_role,
  ADD COLUMN IF NOT EXISTS success boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_target_user_idx ON public.audit_logs (target_user_id);