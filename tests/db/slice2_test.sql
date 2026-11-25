\set ON_ERROR_STOP on
create or replace function pg_temp.expect_error(sql text, code text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'expected error % but call succeeded: %', code, sql;
exception when raise_exception then
  if sqlerrm <> code then raise exception 'expected %, got %', code, sqlerrm; end if;
end $$;

-- Users: 11 = worker, 12 = poster only, 13 = worker not onboarded
insert into auth.users (id, phone) values
  ('00000000-0000-0000-0000-000000000011', '+17245550011'),
  ('00000000-0000-0000-0000-000000000012', '+17245550012'),
  ('00000000-0000-0000-0000-000000000013', '+17245550013');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false);
select public.complete_onboarding('Wade Worker', '1995-05-05', '15601', array['worker'], true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000012', false);
select public.complete_onboarding('Pat Poster', '1980-01-01', '15601', array['poster'], true);

-- Non-workers are blocked
select pg_temp.expect_error($q$select public.save_worker_profile('hi', array['snow_removal'], array['15601'], 4000, null)$q$, 'not_a_worker');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000013', false);
select pg_temp.expect_error($q$select public.save_worker_profile('hi', array['snow_removal'], array['15601'], 4000, null)$q$, 'not_onboarded');

-- Worker validation
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false);
select pg_temp.expect_error($q$select public.set_weekly_availability('[]')$q$, 'profile_missing');
select pg_temp.expect_error($q$select public.save_worker_profile('hi', array[]::text[], array['15601'], 4000, null)$q$, 'no_categories');
select pg_temp.expect_error($q$select public.save_worker_profile('hi', array['rides'], array['15601'], 4000, null)$q$, 'invalid_category');
select pg_temp.expect_error($q$select public.save_worker_profile('hi', array['snow_removal'], array['15222'], 4000, null)$q$, 'outside_service_area');
select pg_temp.expect_error($q$select public.save_worker_profile('hi', array['snow_removal'], array['15601'], 100, null)$q$, 'invalid_rate');
select pg_temp.expect_error($q$select public.save_worker_profile('hi', array['snow_removal'], array['15601'], 4000, 'javascript:alert(1)')$q$, 'invalid_social_url');
select pg_temp.expect_error($q$select public.save_worker_profile(repeat('x', 501), array['snow_removal'], array['15601'], 4000, null)$q$, 'bio_too_long');

select public.save_worker_profile(' Strong back, own shovel. ', array['snow_removal','furniture_moving','snow_removal'], array['15601'], 4000, 'https://facebook.com/wade');
do $$ declare w public.worker_profiles; begin
  select * into w from public.worker_profiles where user_id = auth.uid();
  if w.bio <> 'Strong back, own shovel.' or w.categories <> array['furniture_moving','snow_removal'] then
    raise exception 'profile not saved as expected: %', row_to_json(w);
  end if;
end $$;

-- Not complete yet: no photo, no availability
do $$ begin if public.worker_profile_complete(auth.uid()) then raise exception 'should be incomplete'; end if; end $$;
select pg_temp.expect_error($q$select public.set_available_now(true)$q$, 'profile_incomplete');

-- Photo path must be in own folder
select pg_temp.expect_error($q$select public.set_worker_photo('00000000-0000-0000-0000-000000000012/me.jpg')$q$, 'invalid_photo_path');
select pg_temp.expect_error($q$select public.set_worker_photo('00000000-0000-0000-0000-000000000011/../x.jpg')$q$, 'invalid_photo_path');
select public.set_worker_photo('00000000-0000-0000-0000-000000000011/photo-1.jpg');

-- Availability validation
select pg_temp.expect_error($q$select public.set_weekly_availability('{"dow":1}')$q$, 'invalid_slots');
select pg_temp.expect_error($q$select public.set_weekly_availability('[{"dow":7,"start":"07:00","end":"09:00"}]')$q$, 'invalid_slots');
select pg_temp.expect_error($q$select public.set_weekly_availability('[{"dow":1,"start":"09:00","end":"07:00"}]')$q$, 'invalid_slots');
select pg_temp.expect_error($q$select public.set_weekly_availability('[{"dow":1,"start":"nope","end":"07:00"}]')$q$, 'invalid_slots');
select pg_temp.expect_error($q$select public.set_weekly_availability('[1,2]')$q$, 'invalid_slots');
select pg_temp.expect_error($q$select public.set_weekly_availability('[{"dow":1,"start":"07:00","end":"10:00"},{"dow":1,"start":"09:00","end":"12:00"}]')$q$, 'overlapping_slots');

do $$ begin
  if public.set_weekly_availability('[{"dow":6,"start":"08:00","end":"12:00"},{"dow":1,"start":"17:00","end":"20:00"},{"dow":1,"start":"07:00","end":"09:00"}]') <> 3 then
    raise exception 'expected 3 slots';
  end if;
  -- Replacing works and is idempotent within one transaction
  perform public.set_weekly_availability('[{"dow":1,"start":"07:00","end":"09:00"}]');
  perform public.set_weekly_availability('[{"dow":1,"start":"07:00","end":"09:00"},{"dow":1,"start":"09:00","end":"10:00"}]');
  if (select count(*) from public.availability_slots where worker_id = auth.uid()) <> 2 then
    raise exception 'replace failed';
  end if;
end $$;

-- Now complete; available-now on for ~3h and computed as on
do $$ declare v_until timestamptz; begin
  if not public.worker_profile_complete(auth.uid()) then raise exception 'should be complete'; end if;
  v_until := public.set_available_now(true);
  if v_until < now() + interval '2 hours 59 minutes' or v_until > now() + interval '3 hours 1 minute' then
    raise exception 'unexpected until %', v_until;
  end if;
  if not (select public.worker_available_now(available_now_until) from public.worker_profiles where user_id = auth.uid()) then
    raise exception 'should be available now';
  end if;
  if public.worker_available_now(now() - interval '1 second') then raise exception 'expired should be off'; end if;
  if public.set_available_now(false) is not null then raise exception 'turn off failed'; end if;
end $$;

-- Worker cannot write Stripe fields or other tables directly
do $$ begin
  begin
    update public.worker_profiles set payouts_enabled = true where user_id = auth.uid();
    raise exception 'direct update allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.availability_slots (worker_id, dow, start_time, end_time) values (auth.uid(), 1, '01:00', '02:00');
    raise exception 'direct insert allowed';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Poster can't see worker profile or slots yet (browse views come in slice 3)
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000012', false);
do $$ begin
  if (select count(*) from public.worker_profiles) <> 0 or (select count(*) from public.availability_slots) <> 0 then
    raise exception 'RLS leak to poster';
  end if;
end $$;

-- Storage: own folder only
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false);
insert into storage.objects (bucket_id, name) values ('worker-photos', '00000000-0000-0000-0000-000000000011/a.jpg');
do $$ begin
  begin
    insert into storage.objects (bucket_id, name) values ('worker-photos', '00000000-0000-0000-0000-000000000012/a.jpg');
    raise exception 'uploaded into another user''s folder';
  exception when insufficient_privilege then null;
  end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000012', false);
do $$ begin
  if (select count(*) from storage.objects) <> 0 then raise exception 'storage RLS leak'; end if;
end $$;

-- Suspended worker is locked out
reset role;
update public.profiles set suspended_at = now() where id = '00000000-0000-0000-0000-000000000011';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false);
select pg_temp.expect_error($q$select public.set_available_now(true)$q$, 'suspended');

\echo 'slice2 db tests: PASS'
