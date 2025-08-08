-- Create a helper function to add or upgrade an admin by email
-- Behavior:
-- 1) If an auth user with the email exists, upsert into profiles with role='admin'
-- 2) If no auth user exists, create a pending record in imported_profiles_staging (role='admin')
--
-- Usage: select admin_add_admin_user('person@example.com', 'Full Name');

create or replace function admin_add_admin_user(p_email text, p_full_name text default '')
returns void as $$
declare
  v_user auth.users%rowtype;
begin
  -- Look for an auth user by email
  select * into v_user from auth.users where lower(email) = lower(p_email) limit 1;

  if found then
    -- Upsert profile as admin
    insert into public.profiles (id, email, full_name, role, created_at, updated_at)
    values (v_user.id, v_user.email, coalesce(p_full_name, v_user.raw_user_meta_data->>'full_name', ''), 'admin', now(), now())
    on conflict (id) do update set role = 'admin', full_name = excluded.full_name, updated_at = now();
  else
    -- No auth user yet; create pending admin record
    perform import_legacy_profile(p_email := p_email, p_full_name := p_full_name, p_role := 'admin');
  end if;
end;
$$ language plpgsql security definer;

-- Grant execute to authenticated users (RLS & super-user checks handled at app level)
grant execute on function admin_add_admin_user(text, text) to authenticated;
