UPDATE public.notifications SET title = replace(title, 'CareConnect', 'WellCare') WHERE title ILIKE '%careconnect%';
UPDATE public.notifications SET message = replace(message, 'CareConnect', 'WellCare') WHERE message ILIKE '%careconnect%';
UPDATE public.doctors SET email = replace(email, 'careconnect.health', 'wellcare.health') WHERE email ILIKE '%careconnect%';