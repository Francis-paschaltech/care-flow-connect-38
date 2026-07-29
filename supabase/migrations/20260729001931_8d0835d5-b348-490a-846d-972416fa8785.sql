
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('patient','doctor','nurse','receptionist','admin');
CREATE TYPE public.appointment_status AS ENUM ('pending','confirmed','checked_in','completed','cancelled','no_show');

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ROLES
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id
    AND role IN ('doctor','nurse','receptionist','admin'));
$$;

CREATE POLICY "profiles_select_own_or_staff" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

CREATE POLICY "user_roles_select_own_or_staff" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

-- DEPARTMENTS
CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.departments TO anon, authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "departments_public_read" ON public.departments FOR SELECT USING (true);
CREATE POLICY "departments_admin_write" ON public.departments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- DOCTORS
CREATE TABLE public.doctors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  specialty text NOT NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  email text,
  phone text,
  bio text,
  years_experience int NOT NULL DEFAULT 5,
  available_days text[] NOT NULL DEFAULT ARRAY['Mon','Tue','Wed','Thu','Fri'],
  start_hour int NOT NULL DEFAULT 9,
  end_hour int NOT NULL DEFAULT 17,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.doctors TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.doctors TO authenticated;
GRANT ALL ON public.doctors TO service_role;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "doctors_public_read" ON public.doctors FOR SELECT USING (true);
CREATE POLICY "doctors_self_update" ON public.doctors FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "doctors_admin_insert" ON public.doctors FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "doctors_admin_delete" ON public.doctors FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- PATIENTS
CREATE TABLE public.patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  patient_code text NOT NULL UNIQUE,
  full_name text NOT NULL,
  gender text NOT NULL DEFAULT 'Female',
  date_of_birth date,
  phone text,
  email text,
  address text,
  emergency_contact text,
  blood_group text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patients TO authenticated;
GRANT ALL ON public.patients TO service_role;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "patients_read" ON public.patients FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "patients_insert" ON public.patients FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "patients_update" ON public.patients FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_staff(auth.uid()));

-- APPOINTMENTS
CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id uuid NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  scheduled_at timestamptz NOT NULL,
  duration_minutes int NOT NULL DEFAULT 30,
  status public.appointment_status NOT NULL DEFAULT 'pending',
  reason text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX appointments_no_double_booking
  ON public.appointments (doctor_id, scheduled_at)
  WHERE status <> 'cancelled';
CREATE INDEX appointments_scheduled_idx ON public.appointments (scheduled_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "appointments_read" ON public.appointments FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid())
    OR EXISTS (SELECT 1 FROM public.patients p WHERE p.id = patient_id AND p.user_id = auth.uid()));
CREATE POLICY "appointments_insert" ON public.appointments FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid())
    OR EXISTS (SELECT 1 FROM public.patients p WHERE p.id = patient_id AND p.user_id = auth.uid()));
CREATE POLICY "appointments_update" ON public.appointments FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())
    OR EXISTS (SELECT 1 FROM public.patients p WHERE p.id = patient_id AND p.user_id = auth.uid()))
  WITH CHECK (public.is_staff(auth.uid())
    OR EXISTS (SELECT 1 FROM public.patients p WHERE p.id = patient_id AND p.user_id = auth.uid()));

-- MEDICAL RECORDS
CREATE TABLE public.medical_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id uuid REFERENCES public.doctors(id) ON DELETE SET NULL,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  diagnosis text NOT NULL,
  notes text,
  prescription text,
  follow_up text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.medical_records TO authenticated;
GRANT ALL ON public.medical_records TO service_role;
ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "records_read" ON public.medical_records FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid())
    OR EXISTS (SELECT 1 FROM public.patients p WHERE p.id = patient_id AND p.user_id = auth.uid()));
CREATE POLICY "records_write" ON public.medical_records FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'doctor') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "records_update" ON public.medical_records FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'doctor') OR public.has_role(auth.uid(),'admin'));

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  audience public.app_role,
  title text NOT NULL,
  message text NOT NULL,
  kind text NOT NULL DEFAULT 'info',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_read" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid()
    OR (user_id IS NULL AND (audience IS NULL OR public.has_role(auth.uid(), audience))));
CREATE POLICY "notifications_insert" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

-- AUDIT LOGS
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor text NOT NULL,
  action text NOT NULL,
  entity text NOT NULL,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_admin_read" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "audit_staff_insert" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

-- NEW USER HANDLER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _role public.app_role;
  _name text;
BEGIN
  _name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1));
  BEGIN
    _role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'patient');
  EXCEPTION WHEN others THEN
    _role := 'patient';
  END;

  INSERT INTO public.profiles (id, full_name, email, phone)
  VALUES (NEW.id, _name, NEW.email, NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role)
  ON CONFLICT DO NOTHING;

  IF _role = 'patient' THEN
    INSERT INTO public.patients (user_id, patient_code, full_name, gender, date_of_birth, phone, email)
    VALUES (NEW.id, 'CC-' || upper(substr(replace(NEW.id::text,'-',''),1,6)), _name,
      COALESCE(NEW.raw_user_meta_data->>'gender','Female'),
      NULLIF(NEW.raw_user_meta_data->>'date_of_birth','')::date,
      NEW.raw_user_meta_data->>'phone', NEW.email);
  END IF;

  IF _role = 'doctor' THEN
    INSERT INTO public.doctors (user_id, full_name, specialty, email, phone, department_id)
    VALUES (NEW.id, 'Dr. ' || _name, 'General Medicine', NEW.email, NEW.raw_user_meta_data->>'phone',
      (SELECT id FROM public.departments WHERE name = 'General Medicine' LIMIT 1));
  END IF;

  INSERT INTO public.notifications (user_id, title, message, kind)
  VALUES (NEW.id, 'Welcome to CareConnect', 'Your account has been created successfully.', 'success');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ SEED DATA ============
INSERT INTO public.departments (name, description) VALUES
 ('Cardiology','Heart and cardiovascular care'),
 ('Dermatology','Skin, hair and nail conditions'),
 ('General Medicine','Primary and preventive care'),
 ('Pediatrics','Care for infants, children and teens'),
 ('Orthopedics','Bones, joints and musculoskeletal care'),
 ('Obstetrics & Gynaecology','Womens health and maternity'),
 ('Ophthalmology','Eye care and vision'),
 ('ENT','Ear, nose and throat care');

WITH d AS (SELECT name, id FROM public.departments)
INSERT INTO public.doctors (full_name, specialty, department_id, email, phone, years_experience, start_hour, end_hour, bio)
SELECT v.full_name, v.dept, (SELECT id FROM d WHERE d.name = v.dept), v.email, v.phone, v.yrs, 9, 17,
       'Consultant in ' || v.dept || ' at CareConnect Clinic.'
FROM (VALUES
 ('Dr. Adaeze Okafor','Cardiology','adaeze.okafor@careconnect.ng','+234 803 111 2201',14),
 ('Dr. Babatunde Okonkwo','Dermatology','babatunde.okonkwo@careconnect.ng','+234 803 111 2202',11),
 ('Dr. Chinedu Ibrahim','General Medicine','chinedu.ibrahim@careconnect.ng','+234 803 111 2203',9),
 ('Dr. Fatima Bello','Pediatrics','fatima.bello@careconnect.ng','+234 803 111 2204',16),
 ('Dr. Emeka Nwosu','Orthopedics','emeka.nwosu@careconnect.ng','+234 803 111 2205',12),
 ('Dr. Halima Yusuf','Obstetrics & Gynaecology','halima.yusuf@careconnect.ng','+234 803 111 2206',18),
 ('Dr. Segun Adeyemi','Ophthalmology','segun.adeyemi@careconnect.ng','+234 803 111 2207',8),
 ('Dr. Ngozi Eze','ENT','ngozi.eze@careconnect.ng','+234 803 111 2208',10),
 ('Dr. Tunde Balogun','Cardiology','tunde.balogun@careconnect.ng','+234 803 111 2209',15),
 ('Dr. Amina Sule','General Medicine','amina.sule@careconnect.ng','+234 803 111 2210',7),
 ('Dr. Kelechi Obi','Pediatrics','kelechi.obi@careconnect.ng','+234 803 111 2211',13),
 ('Dr. Yemi Adesina','Dermatology','yemi.adesina@careconnect.ng','+234 803 111 2212',6),
 ('Dr. Ifeoma Chukwu','Obstetrics & Gynaecology','ifeoma.chukwu@careconnect.ng','+234 803 111 2213',20),
 ('Dr. Musa Danjuma','Orthopedics','musa.danjuma@careconnect.ng','+234 803 111 2214',9),
 ('Dr. Grace Olatunji','General Medicine','grace.olatunji@careconnect.ng','+234 803 111 2215',5)
) AS v(full_name, dept, email, phone, yrs);

INSERT INTO public.patients (patient_code, full_name, gender, date_of_birth, phone, email, address, emergency_contact, blood_group, created_at)
SELECT
  'CC-' || lpad(i::text, 5, '0'),
  (ARRAY['Victoria','John','Ngozi','Samuel','Aisha','Chidi','Blessing','Emeka','Zainab','Tobi','Funmi','Ibrahim','Peace','Daniel','Rita','Kunle','Esther','Uche','Hauwa','Femi'])[1 + (i % 20)]
    || ' ' ||
  (ARRAY['Okoro','Okeke','Bello','Adewale','Mohammed','Nwachukwu','Eze','Abubakar','Ogun','Idris','Chukwu','Lawal','Obi','Ojo','Umeh'])[1 + (i % 15)],
  CASE WHEN i % 2 = 0 THEN 'Female' ELSE 'Male' END,
  (DATE '1955-01-01' + ((i * 271) % 22000))::date,
  '+234 8' || lpad(((i * 7919) % 999999999)::text, 9, '0'),
  'patient' || i || '@example.com',
  (ARRAY['12 Awolowo Road, Ikoyi','5 Marina Street, Lagos Island','48 Adeniran Ogunsanya, Surulere','7 Gana Street, Maitama','21 Aba Road, Port Harcourt','3 Zoo Road, Kano'])[1 + (i % 6)] || ', Nigeria',
  (ARRAY['Mrs. A. Okoro +234 805 222 1100','Mr. B. Eze +234 805 222 1101','Mrs. C. Bello +234 805 222 1102','Mr. D. Musa +234 805 222 1103'])[1 + (i % 4)],
  (ARRAY['O+','A+','B+','AB+','O-','A-'])[1 + (i % 6)],
  now() - ((i % 400) || ' days')::interval
FROM generate_series(1,100) AS i;

WITH doc AS (SELECT id, department_id, row_number() OVER (ORDER BY created_at, full_name) - 1 AS rn FROM public.doctors),
     pat AS (SELECT id, row_number() OVER (ORDER BY patient_code) - 1 AS rn FROM public.patients),
     seq AS (SELECT s AS n, ((s-1)/12) - 30 AS day_offset, (s-1) % 12 AS k FROM generate_series(1,500) AS s)
INSERT INTO public.appointments (patient_id, doctor_id, department_id, scheduled_at, duration_minutes, status, reason, created_at)
SELECT
  pat.id,
  doc.id,
  doc.department_id,
  (date_trunc('day', now()) + (seq.day_offset || ' days')::interval
     + ((9 + (seq.k / 4) * 2) || ' hours')::interval
     + (CASE WHEN seq.k % 2 = 0 THEN 0 ELSE 30 END || ' minutes')::interval),
  30,
  CASE
    WHEN seq.day_offset < 0 THEN
      (ARRAY['completed','completed','completed','completed','completed','completed','completed','no_show','cancelled','completed']::public.appointment_status[])[1 + (seq.n % 10)]
    WHEN seq.day_offset = 0 THEN
      (ARRAY['confirmed','confirmed','checked_in','completed','confirmed','pending']::public.appointment_status[])[1 + (seq.n % 6)]
    ELSE
      (ARRAY['confirmed','confirmed','pending','confirmed']::public.appointment_status[])[1 + (seq.n % 4)]
  END,
  (ARRAY['Routine checkup','Follow-up consultation','New patient assessment','Chest pain review','Skin rash','Antenatal visit','Vaccination','Blood pressure review','Eye examination','Post-surgery review'])[1 + (seq.n % 10)],
  now() - ((seq.n % 60) || ' days')::interval
FROM seq
JOIN doc ON doc.rn = ((seq.k % 4) + (seq.day_offset + 30)) % 15
JOIN pat ON pat.rn = (seq.n * 7) % 100
ON CONFLICT DO NOTHING;

WITH completed AS (
  SELECT a.id, a.patient_id, a.doctor_id, a.scheduled_at,
         row_number() OVER (ORDER BY a.scheduled_at DESC) AS rn
  FROM public.appointments a WHERE a.status = 'completed'
)
INSERT INTO public.medical_records (patient_id, doctor_id, appointment_id, diagnosis, notes, prescription, follow_up, created_at)
SELECT patient_id, doctor_id, id,
  (ARRAY['Hypertension (Stage 1)','Type 2 Diabetes Mellitus','Acute Upper Respiratory Infection','Malaria (uncomplicated)','Atopic Dermatitis','Iron Deficiency Anaemia','Lower Back Strain','Allergic Rhinitis','Gastritis','Migraine'])[1 + (rn % 10)],
  (ARRAY['Patient reports gradual improvement since last visit. Vitals stable.','Symptoms persist intermittently; advised lifestyle modification.','No acute distress. Examination largely unremarkable.','Responded well to prior therapy. Continue current plan.'])[1 + (rn % 4)],
  (ARRAY['Amlodipine 5mg once daily x 30 days','Metformin 500mg twice daily x 30 days','Amoxicillin 500mg TDS x 5 days','Artemether/Lumefantrine per weight x 3 days','Hydrocortisone 1% cream BD x 7 days','Ferrous sulphate 200mg daily x 30 days'])[1 + (rn % 6)],
  (ARRAY['Review in 4 weeks','Review in 2 weeks with lab results','Return if symptoms worsen','Routine follow-up in 3 months'])[1 + (rn % 4)],
  scheduled_at + interval '45 minutes'
FROM completed WHERE rn <= 300;

INSERT INTO public.notifications (audience, title, message, kind, created_at)
VALUES
 ('receptionist','Lab result flagged for review','A lab result requires clinician review before the next consultation.','alert', now() - interval '2 hours'),
 ('receptionist','Doctor unavailable','Dr. Babatunde Okonkwo is out sick — 3 appointments need reassignment.','warning', now() - interval '4 hours'),
 ('admin','Utilization report ready','This week''s doctor utilization report has been generated.','info', now() - interval '1 day'),
 ('doctor','Schedule updated','Your Thursday clinic now starts at 08:30.','info', now() - interval '6 hours'),
 ('nurse','Waiting queue busy','5 patients are currently waiting to be checked in.','warning', now() - interval '30 minutes');

INSERT INTO public.audit_logs (actor, action, entity, detail, created_at)
SELECT
  (ARRAY['reception@careconnect.ng','admin@careconnect.ng','dr.okafor@careconnect.ng','nurse.ada@careconnect.ng'])[1 + (i % 4)],
  (ARRAY['CREATE','UPDATE','DELETE','LOGIN','EXPORT'])[1 + (i % 5)],
  (ARRAY['appointment','patient','medical_record','user','report'])[1 + (i % 5)],
  (ARRAY['Appointment rescheduled to a later slot','Patient contact details updated','Consultation notes added','Password changed','Attendance report exported as CSV'])[1 + (i % 5)],
  now() - ((i * 47) || ' minutes')::interval
FROM generate_series(1,40) AS i;
