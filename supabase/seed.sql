-- supabase/seed.sql
-- Demo data for local development. Run AFTER migrations applied.
-- Demo users are seeded via direct auth.users inserts with bcrypt hashes
-- that match GoTrue's verifier ($2a$10$ prefix, 60-char total).
-- instance_id is set to the canonical zero UUID so GoTrue recognizes them.

-- Clean any existing demo users (idempotent)
DELETE FROM auth.users WHERE email IN (
    'admin@clinica.local',
    'doctor@clinica.local',
    'employee@clinica.local',
    'patient@clinica.local'
);

-- Insert demo users with matching profile records.
-- Onboarding in raw_user_meta_data will trigger handle_new_user to create
-- public.profiles rows. But since we set confirmed_at and already created
-- profiles via SQL earlier, do it here directly with explicit profile data.

INSERT INTO auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token,
    email_change, email_change_token_new, recovery_token
) VALUES
    ('00000000-0000-0000-0000-000000000000',
     '00000000-0000-0000-0000-000000000001',
     'authenticated', 'authenticated',
     'admin@clinica.local',
     crypt('admin123456', gen_salt('bf', 10)),
     now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"name":"Admin","cpf":"00000000000","role":"admin"}'::jsonb,
     now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000',
     '00000000-0000-0000-0000-000000000002',
     'authenticated', 'authenticated',
     'doctor@clinica.local',
     crypt('doctor123456', gen_salt('bf', 10)),
     now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"name":"Dr. João Silva","cpf":"22222222222","role":"doctor","crm":"CRM/SP 123456"}'::jsonb,
     now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000',
     '00000000-0000-0000-0000-000000000003',
     'authenticated', 'authenticated',
     'employee@clinica.local',
     crypt('employee123456', gen_salt('bf', 10)),
     now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"name":"Maria Recepção","cpf":"33333333333","role":"employee"}'::jsonb,
     now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000',
     '00000000-0000-0000-0000-000000000004',
     'authenticated', 'authenticated',
     'patient@clinica.local',
     crypt('patient123456', gen_salt('bf', 10)),
     now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"name":"José Paciente","cpf":"44444444444","phone":"11999999999","role":"patient"}'::jsonb,
     now(), now(), '', '', '', '')
ON CONFLICT (email) WHERE is_sso_user = false DO UPDATE SET
    encrypted_password = EXCLUDED.encrypted_password,
    instance_id = EXCLUDED.instance_id,
    raw_user_meta_data = EXCLUDED.raw_user_meta_data,
    updated_at = now();

-- Ensure profiles exist for the demo users (handle_new_user trigger
-- cannot create them retroactively if raw_user_meta_data was set after
-- the user row was inserted outside the trigger path).
INSERT INTO public.profiles (id, name, cpf, email, role, is_active)
SELECT id, raw_user_meta_data->>'name', raw_user_meta_data->>'cpf', email,
       (raw_user_meta_data->>'role')::public.user_role, true
FROM auth.users
WHERE email IN (
    'admin@clinica.local',
    'doctor@clinica.local',
    'employee@clinica.local',
    'patient@clinica.local'
)
ON CONFLICT (id) DO NOTHING;

-- Link the demo patient to a patients row.
INSERT INTO public.patients (profile_id, date_of_birth, gender, address, city, state, zip_code, blood_type, allergies)
SELECT id, '1990-01-01'::date, 'other'::public.gender,
       'Rua Demo, 100', 'São Paulo', 'SP', '00000000',
       'O+'::public.blood_type, NULL
FROM auth.users
WHERE email = 'patient@clinica.local'
ON CONFLICT (profile_id) DO NOTHING;

-- Link the demo doctor to a doctors row (profile must be role='doctor').
INSERT INTO public.doctors (profile_id, crm, bio, consultation_price)
SELECT id, raw_user_meta_data->>'crm', 'Médico de demonstração', 250.00
FROM auth.users
WHERE email = 'doctor@clinica.local'
ON CONFLICT (profile_id) DO NOTHING;

-- Demo clinic + specialty + schedule + health plan.
INSERT INTO public.clinics (name, address, phone)
SELECT 'Clínica Demo', 'Rua Demo, 100', '11000000000'
WHERE NOT EXISTS (SELECT 1 FROM public.clinics WHERE name = 'Clínica Demo');

INSERT INTO public.specialties (name, description)
VALUES ('Clínica Geral', 'Atendimento médico geral')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.health_plans (name, description, coverage_percentage, monthly_price)
SELECT 'Plano Demo', 'Plano de demonstração', 100.00, 0.00
WHERE NOT EXISTS (SELECT 1 FROM public.health_plans WHERE name = 'Plano Demo');
