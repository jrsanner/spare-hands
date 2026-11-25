-- Slice 2: worker profile, weekly availability, "available now", payout status, photos.
-- As in slice 1, the browser never writes these tables directly; it calls the
-- security-definer functions below. Stripe status is written only by the server
-- (secret key), which bypasses RLS.

-- ---------------------------------------------------------------------------
-- Job categories (POC: two). Text keys so later categories need only an INSERT.
-- ---------------------------------------------------------------------------
create table public.categories (
  key        text primary key check (key ~ '^[a-z_]{2,40}$'),
  label      text not null,
  sort_order int not null default 0,
  active     boolean not null default true
);

insert into public.categories (key, label, sort_order) values
  ('snow_removal', 'Snow removal', 1),
  ('furniture_moving', 'Furniture loading & moving', 2);

alter table public.categories enable row level security;
create policy "categories readable by everyone" on public.categories for select using (true);

-- ---------------------------------------------------------------------------
-- Worker profiles
-- ---------------------------------------------------------------------------
create table public.worker_profiles (
  user_id               uuid primary key references public.profiles (id) on delete cascade,
  bio                   text check (char_length(bio) <= 500),
  photo_path            text,
  categories            text[] not null default '{}',
  service_zips          text[] not null default '{}',
  typical_rate_cents    int check (typical_rate_cents between 500 and 30000),
  social_url            text check (social_url ~ '^https://[^\s]+$' and char_length(social_url) <= 300),
  available_now_until   timestamptz,
  -- Slice 3 uses these for invites; defined now so the table shape is stable.
  ignored_invite_streak int not null default 0,
  hidden_at             timestamptz,
  reliability_noshows   int not null default 0,
  rating_avg            numeric(3, 2),
  rating_count          int not null default 0,
  -- Stripe Connect (written by the server only)
  stripe_account_id     text unique,
  stripe_details_submitted boolean not null default false,
  payouts_enabled       boolean not null default false,
  -- null = Stripe hasn't shared a date of birth with us yet. Transfers (slice 3)
  -- require this to be true, since Stripe Express allows 13+ with a guardian.
  stripe_individual_is_adult boolean,
  stripe_synced_at      timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.worker_profiles enable row level security;

-- Slice 2: owner and admins only. Slice 3 adds the limited/full browse views for posters.
create policy "read own worker profile"
  on public.worker_profiles for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

revoke insert, update, delete on public.worker_profiles from anon, authenticated;

-- Weekly template in Greensburg local wall-clock time. dow: 0 = Sunday ... 6 = Saturday.
create table public.availability_slots (
  id         bigint generated always as identity primary key,
  worker_id  uuid not null references public.worker_profiles (user_id) on delete cascade,
  dow        smallint not null check (dow between 0 and 6),
  start_time time not null,
  end_time   time not null,
  check (start_time < end_time)
);

create index availability_slots_worker_idx on public.availability_slots (worker_id);
create index availability_slots_dow_idx on public.availability_slots (dow, start_time, end_time);

alter table public.availability_slots enable row level security;

create policy "read own availability"
  on public.availability_slots for select
  to authenticated
  using (worker_id = auth.uid() or public.is_admin());

revoke insert, update, delete on public.availability_slots from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Raises unless the caller is a signed-in, onboarded, unsuspended worker.
create or replace function public.assert_active_worker()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_p public.profiles;
begin
  if v_uid is null then raise exception 'not_signed_in'; end if;
  select * into v_p from public.profiles where id = v_uid;
  if v_p.id is null or v_p.onboarded_at is null then raise exception 'not_onboarded'; end if;
  if v_p.suspended_at is not null then raise exception 'suspended'; end if;
  if not ('worker' = any (v_p.roles)) then raise exception 'not_a_worker'; end if;
  return v_uid;
end;
$$;

-- "Complete" = can apply to jobs and accept invites (spec section 5).
create or replace function public.worker_profile_complete(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select w.photo_path is not null
       and cardinality(w.categories) > 0
       and cardinality(w.service_zips) > 0
       and exists (select 1 from public.availability_slots s where s.worker_id = w.user_id)
      from public.worker_profiles w
     where w.user_id = p_user_id
  ), false);
$$;

-- Computed, so "available now" turns itself off with no cron job.
create or replace function public.worker_available_now(p_until timestamptz)
returns boolean
language sql
stable
as $$ select p_until is not null and p_until > now(); $$;

-- ---------------------------------------------------------------------------
-- Worker actions
-- ---------------------------------------------------------------------------
create or replace function public.save_worker_profile(
  p_bio text,
  p_categories text[],
  p_service_zips text[],
  p_typical_rate_cents int,
  p_social_url text
)
returns public.worker_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_active_worker();
  v_bio text := nullif(btrim(coalesce(p_bio, '')), '');
  v_social text := nullif(btrim(coalesce(p_social_url, '')), '');
  v_cats text[];
  v_zips text[];
  v_row public.worker_profiles;
begin
  select coalesce(array_agg(distinct c order by c), '{}') into v_cats from unnest(coalesce(p_categories, '{}')) c;
  select coalesce(array_agg(distinct z order by z), '{}') into v_zips from unnest(coalesce(p_service_zips, '{}')) z;

  if cardinality(v_cats) = 0 then raise exception 'no_categories'; end if;
  if exists (select 1 from unnest(v_cats) c
             where not exists (select 1 from public.categories k where k.key = c and k.active)) then
    raise exception 'invalid_category';
  end if;

  if cardinality(v_zips) = 0 then raise exception 'no_service_zips'; end if;
  if exists (select 1 from unnest(v_zips) z
             where not exists (select 1 from public.service_zips s where s.zip = z and s.active)) then
    raise exception 'outside_service_area';
  end if;

  if v_bio is not null and char_length(v_bio) > 500 then raise exception 'bio_too_long'; end if;
  if p_typical_rate_cents is not null and (p_typical_rate_cents < 500 or p_typical_rate_cents > 30000) then
    raise exception 'invalid_rate';
  end if;
  if v_social is not null and (v_social !~ '^https://[^\s]+$' or char_length(v_social) > 300) then
    raise exception 'invalid_social_url';
  end if;

  insert into public.worker_profiles (user_id, bio, categories, service_zips, typical_rate_cents, social_url)
  values (v_uid, v_bio, v_cats, v_zips, p_typical_rate_cents, v_social)
  on conflict (user_id) do update
     set bio = excluded.bio,
         categories = excluded.categories,
         service_zips = excluded.service_zips,
         typical_rate_cents = excluded.typical_rate_cents,
         social_url = excluded.social_url,
         updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

-- The browser uploads to Storage under "<user id>/...", then records the path here.
create or replace function public.set_worker_photo(p_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_active_worker();
begin
  if p_path is null or p_path !~ ('^' || v_uid::text || '/[A-Za-z0-9._-]{1,100}$') then
    raise exception 'invalid_photo_path';
  end if;
  if not exists (select 1 from public.worker_profiles where user_id = v_uid) then
    raise exception 'profile_missing';
  end if;
  update public.worker_profiles set photo_path = p_path, updated_at = now() where user_id = v_uid;
end;
$$;

-- Replaces the whole weekly template. p_slots: [{"dow":1,"start":"07:00","end":"11:00"}, ...]
create or replace function public.set_weekly_availability(p_slots jsonb)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_active_worker();
  v_count int;
begin
  if not exists (select 1 from public.worker_profiles where user_id = v_uid) then
    raise exception 'profile_missing';
  end if;
  if p_slots is null or jsonb_typeof(p_slots) <> 'array' then raise exception 'invalid_slots'; end if;
  if jsonb_array_length(p_slots) > 28 then raise exception 'too_many_slots'; end if;

  if exists (select 1 from jsonb_array_elements(p_slots) e where jsonb_typeof(e) <> 'object') then
    raise exception 'invalid_slots';
  end if;

  if exists (select 1 from jsonb_to_recordset(p_slots) as x(dow smallint, "start" time, "end" time)
              where x.dow is null or x.dow not between 0 and 6
                 or x."start" is null or x."end" is null or x."start" >= x."end") then
    raise exception 'invalid_slots';
  end if;

  if exists (select 1
               from rows from (jsonb_to_recordset(p_slots) as (dow smallint, "start" time, "end" time)) with ordinality as a(dow, "start", "end", n)
               join rows from (jsonb_to_recordset(p_slots) as (dow smallint, "start" time, "end" time)) with ordinality as b(dow, "start", "end", n)
                 on a.dow = b.dow and a.n < b.n and a."start" < b."end" and b."start" < a."end") then
    raise exception 'overlapping_slots';
  end if;

  delete from public.availability_slots where worker_id = v_uid;
  insert into public.availability_slots (worker_id, dow, start_time, end_time)
  select v_uid, x.dow, x."start", x."end"
    from jsonb_to_recordset(p_slots) as x(dow smallint, "start" time, "end" time)
   order by x.dow, x."start";
  get diagnostics v_count = row_count;

  update public.worker_profiles set updated_at = now() where user_id = v_uid;
  return v_count;
exception
  when invalid_datetime_format or datetime_field_overflow or invalid_text_representation
    or numeric_value_out_of_range then
    raise exception 'invalid_slots';
end;
$$;

-- "Available now" lasts 3 hours, then turns itself off. Requires a complete profile.
create or replace function public.set_available_now(p_on boolean)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_active_worker();
  v_until timestamptz;
begin
  if coalesce(p_on, false) then
    if not public.worker_profile_complete(v_uid) then raise exception 'profile_incomplete'; end if;
    v_until := now() + interval '3 hours';
  end if;
  update public.worker_profiles
     set available_now_until = v_until,
         hidden_at = case when v_until is not null then null else hidden_at end,
         ignored_invite_streak = case when v_until is not null then 0 else ignored_invite_streak end,
         updated_at = now()
   where user_id = v_uid;
  return v_until;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke execute on function public.assert_active_worker() from public, anon;
revoke execute on function public.save_worker_profile(text, text[], text[], int, text) from public, anon;
revoke execute on function public.set_worker_photo(text) from public, anon;
revoke execute on function public.set_weekly_availability(jsonb) from public, anon;
revoke execute on function public.set_available_now(boolean) from public, anon;
grant execute on function public.assert_active_worker() to authenticated;
grant execute on function public.save_worker_profile(text, text[], text[], int, text) to authenticated;
grant execute on function public.set_worker_photo(text) to authenticated;
grant execute on function public.set_weekly_availability(jsonb) to authenticated;
grant execute on function public.set_available_now(boolean) to authenticated;
grant execute on function public.worker_profile_complete(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Photo storage: private bucket. Owners manage files in their own folder.
-- Posters will get short-lived signed URLs from the server in slice 3.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('worker-photos', 'worker-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "workers read own photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'worker-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "workers upload own photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'worker-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "workers replace own photos"
  on storage.objects for update to authenticated
  using (bucket_id = 'worker-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "workers delete own photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'worker-photos' and (storage.foldername(name))[1] = auth.uid()::text);
