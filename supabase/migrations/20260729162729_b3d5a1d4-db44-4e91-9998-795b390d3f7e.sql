-- 1) Notification preferences on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_reminders boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sms_reminders boolean NOT NULL DEFAULT false;

-- 2) handle_new_user: NEVER trust client-supplied role. Always 'patient'.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _name text;
BEGIN
  _name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1));

  INSERT INTO public.profiles (id, full_name, email, phone)
  VALUES (NEW.id, _name, NEW.email, NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;

  -- Public self-registration is ALWAYS a patient. Staff roles are granted
  -- exclusively through the admin-only staff provisioning workflow.
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'patient')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.patients (user_id, patient_code, full_name, gender, date_of_birth, phone, email)
  VALUES (NEW.id, 'CC-' || upper(substr(replace(NEW.id::text,'-',''),1,6)), _name,
    COALESCE(NEW.raw_user_meta_data->>'gender','Female'),
    NULLIF(NEW.raw_user_meta_data->>'date_of_birth','')::date,
    NEW.raw_user_meta_data->>'phone', NEW.email)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.notifications (user_id, title, message, kind)
  VALUES (NEW.id, 'Welcome to CareConnect', 'Your account has been created successfully.', 'success');

  RETURN NEW;
END;
$function$;

-- Ensure the trigger exists (it is required for profile/role creation)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3) Admin-only staff role assignment helper (callable by admins only)
CREATE OR REPLACE FUNCTION public.admin_set_user_role(_user_id uuid, _role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can assign roles';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _role);
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_set_user_role(uuid, app_role) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, app_role) TO service_role;