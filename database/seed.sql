alter table public.staff add column if not exists login_password text;

delete from public.staff
where email in ('admin123@gmail.com', 'staff123@gmail.com');

delete from public.users_profile
where id in (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002'
);

delete from auth.identities
where user_id in (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002'
)
or provider_id in (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002'
);

delete from auth.users
where id in (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002'
)
or email in ('admin123@gmail.com', 'staff123@gmail.com');

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change,
  email_change_token_new,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'admin123@gmail.com',
    crypt('admin123', gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Admin User","role":"Admin"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'staff123@gmail.com',
    crypt('staff123', gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Staff User","role":"Staff"}'::jsonb,
    now(),
    now()
  );

insert into auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '{"sub":"00000000-0000-0000-0000-000000000001","email":"admin123@gmail.com","email_verified":true,"phone_verified":false}'::jsonb,
    'email',
    now(),
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000102',
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002',
    '{"sub":"00000000-0000-0000-0000-000000000002","email":"staff123@gmail.com","email_verified":true,"phone_verified":false}'::jsonb,
    'email',
    now(),
    now(),
    now()
  );

insert into public.users_profile (id, full_name, role, avatar_url)
values
  ('00000000-0000-0000-0000-000000000001', 'Admin User', 'Admin', null),
  ('00000000-0000-0000-0000-000000000002', 'Staff User', 'Staff', null)
on conflict (id) do update
set
  full_name = excluded.full_name,
  role = excluded.role,
  avatar_url = excluded.avatar_url;

insert into public.staff (
  full_name,
  email,
  auth_user_id,
  phone,
  department,
  position,
  shift,
  login_password,
  status
)
values
  (
    'Admin User',
    'admin123@gmail.com',
    '00000000-0000-0000-0000-000000000001',
    null,
    'Management',
    'Administrator',
    'Day',
    'admin123',
    'Active'
  ),
  (
    'Staff User',
    'staff123@gmail.com',
    '00000000-0000-0000-0000-000000000002',
    null,
    'Front Office',
    'Staff',
    'Day',
    'staff123',
    'Active'
  )
on conflict (email) do update
set
  full_name = excluded.full_name,
  auth_user_id = excluded.auth_user_id,
  phone = excluded.phone,
  department = excluded.department,
  position = excluded.position,
  shift = excluded.shift,
  login_password = excluded.login_password,
  status = excluded.status;
