-- Slice 1: service area, profiles, onboarding gate.
-- All writes to profiles go through security-definer functions so the
-- 18+ and service-area rules cannot be skipped from the browser.

-- ---------------------------------------------------------------------------
-- Service area (POC: Greensburg, PA). Add zips with an INSERT, no deploy.
-- ---------------------------------------------------------------------------
create table public.service_zips (
  zip        text primary key check (zip ~ '^[0-9]{5}$'),
  town       text not null,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.service_zips (zip, town) values ('15601', 'Greensburg, PA');

alter table public.service_zips enable row level security;

create policy "service zips readable by everyone"
  on public.service_zips for select
  using (true);

-- ---------------------------------------------------------------------------
-- Profiles: one row per auth user, created on signup.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  phone              text,
  full_name          text check (char_length(full_name) between 1 and 80),
  dob                date,
  adult_confirmed_at timestamptz,
  zip                text references public.service_zips (zip),
  roles              text[] not null default '{}'
                     check (roles <@ array['poster', 'worker']::text[]),
  is_admin           boolean not null default false,
  suspended_at       timestamptz,
  onboarded_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Users read their own row; admins read all. No direct insert/update/delete.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

create policy "read own profile"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

revoke insert, update, delete on public.profiles from anon, authenticated;

-- Create the profile when Supabase Auth creates a user (phone sign-in).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, phone)
  values (new.id, new.phone)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep phone in sync if a user changes number.
create or replace function public.handle_user_phone_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set phone = new.phone, updated_at = now()
  where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_phone_changed
  after update of phone on auth.users
  for each row when (old.phone is distinct from new.phone)
  execute function public.handle_user_phone_change();

-- ---------------------------------------------------------------------------
-- Onboarding. Ages are computed in Greensburg's time zone.
-- Error codes (SQLSTATE P0001, message is the code) are mapped to copy in the app.
-- ---------------------------------------------------------------------------
create or replace function public.complete_onboarding(
  p_full_name text,
  p_dob date,
  p_zip text,
  p_roles text[],
  p_confirm_adult boolean
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'America/New_York')::date;
  v_name text := btrim(coalesce(p_full_name, ''));
  v_row public.profiles;
begin
  if v_uid is null then
    raise exception 'not_signed_in';
  end if;

  if exists (select 1 from public.profiles where id = v_uid and suspended_at is not null) then
    raise exception 'suspended';
  end if;

  if char_length(v_name) < 1 or char_length(v_name) > 80 then
    raise exception 'invalid_name';
  end if;

  if p_dob is null or p_dob > v_today or p_dob < (v_today - interval '120 years')::date then
    raise exception 'invalid_dob';
  end if;

  if p_dob > (v_today - interval '18 years')::date then
    raise exception 'under_18';
  end if;

  if not coalesce(p_confirm_adult, false) then
    raise exception 'adult_not_confirmed';
  end if;

  if not exists (select 1 from public.service_zips z where z.zip = p_zip and z.active) then
    raise exception 'outside_service_area';
  end if;

  if p_roles is null
     or cardinality(p_roles) = 0
     or not (p_roles <@ array['poster', 'worker']::text[]) then
    raise exception 'invalid_roles';
  end if;

  update public.profiles
     set full_name          = v_name,
         dob                = p_dob,
         adult_confirmed_at = coalesce(adult_confirmed_at, now()),
         zip                = p_zip,
         roles              = (select array_agg(distinct r order by r) from unnest(p_roles) r),
         onboarded_at       = coalesce(onboarded_at, now()),
         updated_at         = now()
   where id = v_uid
  returning * into v_row;

  if v_row.id is null then
    raise exception 'profile_missing';
  end if;

  return v_row;
end;
$$;

revoke execute on function public.complete_onboarding(text, date, text, text[], boolean) from public, anon;
grant execute on function public.complete_onboarding(text, date, text, text[], boolean) to authenticated;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_user_phone_change() from public, anon, authenticated;
