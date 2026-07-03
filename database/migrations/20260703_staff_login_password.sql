alter table public.staff add column if not exists login_password text;

notify pgrst, 'reload schema';
