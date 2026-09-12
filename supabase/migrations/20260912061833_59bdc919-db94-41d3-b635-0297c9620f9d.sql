CREATE UNIQUE INDEX IF NOT EXISTS patients_user_id_key ON public.patients(user_id) WHERE user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_name text;
  v_phone text;
BEGIN
  v_name := COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1));
  v_phone := NEW.raw_user_meta_data ->> 'phone';

  BEGIN
    INSERT INTO public.profiles (id, full_name, email, phone)
    VALUES (NEW.id, v_name, NEW.email, v_phone)
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user profiles failed: %', SQLERRM;
  END;

  BEGIN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'patient')
    ON CONFLICT (user_id, role) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user user_roles failed: %', SQLERRM;
  END;

  BEGIN
    INSERT INTO public.patients (user_id, patient_code, full_name, gender, date_of_birth, email, phone)
    VALUES (
      NEW.id,
      'WC-' || upper(substr(replace(NEW.id::text, '-', ''), 1, 6)),
      v_name,
      COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'gender', ''), 'Female'),
      NULLIF(NEW.raw_user_meta_data ->> 'date_of_birth', '')::date,
      NEW.email,
      v_phone
    )
    ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user patients failed: %', SQLERRM;
  END;

  BEGIN
    INSERT INTO public.notifications (user_id, title, message, kind)
    VALUES (NEW.id, 'Welcome to WellCare', 'Your account has been created successfully.', 'success');
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user notifications failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$function$;