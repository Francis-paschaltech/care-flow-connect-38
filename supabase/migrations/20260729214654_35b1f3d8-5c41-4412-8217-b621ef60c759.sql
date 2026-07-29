-- 1) Restore the missing new-user trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2) Backfill existing auth users
INSERT INTO public.profiles (id, full_name, email, phone)
SELECT u.id, COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email,'@',1)), u.email, u.raw_user_meta_data->>'phone'
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'patient'::public.app_role FROM auth.users u
ON CONFLICT DO NOTHING;

INSERT INTO public.patients (user_id, patient_code, full_name, gender, date_of_birth, phone, email)
SELECT u.id, 'CC-' || upper(substr(replace(u.id::text,'-',''),1,6)),
       COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email,'@',1)),
       COALESCE(u.raw_user_meta_data->>'gender','Female'),
       NULLIF(u.raw_user_meta_data->>'date_of_birth','')::date,
       u.raw_user_meta_data->>'phone', u.email
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.patients p WHERE p.user_id = u.id)
ON CONFLICT DO NOTHING;

-- 3) Make the first (owner) account an administrator
DELETE FROM public.user_roles
WHERE user_id = (SELECT id FROM auth.users ORDER BY created_at LIMIT 1);
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users ORDER BY created_at LIMIT 1
ON CONFLICT DO NOTHING;

-- 4) Seed clinic data
INSERT INTO public.departments (id, name, description) VALUES
  ('11111111-1111-4111-8111-000000000001','General Medicine','Primary care, routine checks and referrals'),
  ('11111111-1111-4111-8111-000000000002','Cardiology','Heart and vascular care'),
  ('11111111-1111-4111-8111-000000000003','Paediatrics','Care for infants, children and adolescents'),
  ('11111111-1111-4111-8111-000000000004','Dermatology','Skin, hair and nail conditions')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.doctors (id, full_name, specialty, department_id, email, phone, bio, years_experience, available_days, start_hour, end_hour, is_active) VALUES
  ('22222222-2222-4222-8222-000000000001','Dr. Amara Okeke','General Practitioner','11111111-1111-4111-8111-000000000001','amara.okeke@careconnect.health','+234 801 111 2222','Family medicine with a focus on preventive care.',12,ARRAY['Mon','Tue','Wed','Thu','Fri'],9,17,true),
  ('22222222-2222-4222-8222-000000000002','Dr. Tunde Bello','Cardiologist','11111111-1111-4111-8111-000000000002','tunde.bello@careconnect.health','+234 802 333 4444','Interventional cardiology and hypertension management.',18,ARRAY['Mon','Wed','Fri'],10,16,true),
  ('22222222-2222-4222-8222-000000000003','Dr. Ngozi Eze','Paediatrician','11111111-1111-4111-8111-000000000003','ngozi.eze@careconnect.health','+234 803 555 6666','Child health, immunisation and growth monitoring.',9,ARRAY['Tue','Thu','Sat'],8,14,true),
  ('22222222-2222-4222-8222-000000000004','Dr. Samuel Idris','Dermatologist','11111111-1111-4111-8111-000000000004','samuel.idris@careconnect.health','+234 804 777 8888','Medical and cosmetic dermatology.',7,ARRAY['Mon','Tue','Thu'],11,18,true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.patients (id, patient_code, full_name, gender, date_of_birth, phone, email, address, emergency_contact, blood_group) VALUES
  ('33333333-3333-4333-8333-000000000001','CC-100001','Grace Adeyemi','Female','1991-03-14','+234 810 111 0001','grace.adeyemi@example.com','12 Marina Road, Lagos','Femi Adeyemi · +234 810 111 0011','O+'),
  ('33333333-3333-4333-8333-000000000002','CC-100002','Chinedu Obi','Male','1984-11-02','+234 810 111 0002','chinedu.obi@example.com','5 Aba Street, Enugu','Ada Obi · +234 810 111 0012','A+'),
  ('33333333-3333-4333-8333-000000000003','CC-100003','Fatima Yusuf','Female','2016-06-21','+234 810 111 0003','fatima.guardian@example.com','21 Ahmadu Bello Way, Abuja','Hauwa Yusuf · +234 810 111 0013','B+'),
  ('33333333-3333-4333-8333-000000000004','CC-100004','Peter Nwankwo','Male','1972-01-30','+234 810 111 0004','peter.nwankwo@example.com','9 Awolowo Road, Ibadan','Joy Nwankwo · +234 810 111 0014','AB-'),
  ('33333333-3333-4333-8333-000000000005','CC-100005','Blessing Etim','Female','1998-09-09','+234 810 111 0005','blessing.etim@example.com','3 Calabar Close, Uyo','Mercy Etim · +234 810 111 0015','O-')
ON CONFLICT (patient_code) DO NOTHING;

INSERT INTO public.appointments (id, patient_id, doctor_id, department_id, scheduled_at, duration_minutes, status, reason) VALUES
  ('44444444-4444-4444-8444-000000000001','33333333-3333-4333-8333-000000000001','22222222-2222-4222-8222-000000000001','11111111-1111-4111-8111-000000000001', date_trunc('day', now()) + interval '9 hours', 30,'confirmed','Persistent headaches'),
  ('44444444-4444-4444-8444-000000000002','33333333-3333-4333-8333-000000000002','22222222-2222-4222-8222-000000000002','11111111-1111-4111-8111-000000000002', date_trunc('day', now()) + interval '10 hours 30 minutes', 30,'checked_in','Blood pressure review'),
  ('44444444-4444-4444-8444-000000000003','33333333-3333-4333-8333-000000000003','22222222-2222-4222-8222-000000000003','11111111-1111-4111-8111-000000000003', date_trunc('day', now()) + interval '12 hours', 30,'pending','Routine immunisation'),
  ('44444444-4444-4444-8444-000000000004','33333333-3333-4333-8333-000000000004','22222222-2222-4222-8222-000000000001','11111111-1111-4111-8111-000000000001', date_trunc('day', now()) + interval '1 day 9 hours 30 minutes', 30,'confirmed','Diabetes follow-up'),
  ('44444444-4444-4444-8444-000000000005','33333333-3333-4333-8333-000000000005','22222222-2222-4222-8222-000000000004','11111111-1111-4111-8111-000000000004', date_trunc('day', now()) + interval '2 days 11 hours', 30,'pending','Skin rash assessment'),
  ('44444444-4444-4444-8444-000000000006','33333333-3333-4333-8333-000000000001','22222222-2222-4222-8222-000000000002','11111111-1111-4111-8111-000000000002', date_trunc('day', now()) - interval '5 days' + interval '10 hours', 30,'completed','Chest tightness'),
  ('44444444-4444-4444-8444-000000000007','33333333-3333-4333-8333-000000000002','22222222-2222-4222-8222-000000000001','11111111-1111-4111-8111-000000000001', date_trunc('day', now()) - interval '9 days' + interval '14 hours', 30,'completed','General checkup'),
  ('44444444-4444-4444-8444-000000000008','33333333-3333-4333-8333-000000000004','22222222-2222-4222-8222-000000000004','11111111-1111-4111-8111-000000000004', date_trunc('day', now()) - interval '12 days' + interval '15 hours', 30,'no_show','Eczema review'),
  ('44444444-4444-4444-8444-000000000009','33333333-3333-4333-8333-000000000005','22222222-2222-4222-8222-000000000003','11111111-1111-4111-8111-000000000003', date_trunc('day', now()) - interval '15 days' + interval '9 hours', 30,'cancelled','Consultation'),
  ('44444444-4444-4444-8444-000000000010','33333333-3333-4333-8333-000000000003','22222222-2222-4222-8222-000000000001','11111111-1111-4111-8111-000000000001', date_trunc('day', now()) - interval '20 days' + interval '11 hours', 30,'completed','Fever and cough')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.medical_records (id, patient_id, doctor_id, appointment_id, diagnosis, notes, prescription, follow_up) VALUES
  ('55555555-5555-4555-8555-000000000001','33333333-3333-4333-8333-000000000001','22222222-2222-4222-8222-000000000002','44444444-4444-4444-8444-000000000006','Mild hypertension','Patient reports occasional chest tightness after exertion. ECG normal.','Amlodipine 5mg once daily','Review in 4 weeks'),
  ('55555555-5555-4555-8555-000000000002','33333333-3333-4333-8333-000000000002','22222222-2222-4222-8222-000000000001','44444444-4444-4444-8444-000000000007','Routine health check — normal','All vitals within range. Advised on diet and exercise.','None','Annual checkup'),
  ('55555555-5555-4555-8555-000000000003','33333333-3333-4333-8333-000000000003','22222222-2222-4222-8222-000000000001','44444444-4444-4444-8444-000000000010','Upper respiratory tract infection','Fever resolved after 3 days. Chest clear on examination.','Paracetamol syrup 5ml three times daily','Return if symptoms persist')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.notifications (audience, title, message, kind) VALUES
  ('admin','Daily clinic summary','10 appointments recorded across 4 departments today.','info'),
  ('admin','New patient registrations','5 patients were added to the directory.','success'),
  (NULL,'Scheduled maintenance','The clinic portal will be briefly unavailable this weekend.','warning')
ON CONFLICT DO NOTHING;

INSERT INTO public.audit_logs (actor, action, entity, detail) VALUES
  ('system','SEED','database','Demo clinic data created'),
  ('system','CREATE','doctors','4 doctors added'),
  ('system','CREATE','patients','5 patients added'),
  ('system','CREATE','appointments','10 appointments added');