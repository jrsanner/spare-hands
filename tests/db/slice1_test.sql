-- Slice 1 database tests. Each failing check raises and stops the run.
\set ON_ERROR_STOP on
create or replace function pg_temp.expect_error(sql text, code text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'expected error % but call succeeded: %', code, sql;
exception when raise_exception then
  if sqlerrm <> code then raise exception 'expected %, got %', code, sqlerrm; end if;
end $$;

insert into auth.users (id, phone) values
  ('00000000-0000-0000-0000-000000000001', '+17245550001'),
  ('00000000-0000-0000-0000-000000000002', '+17245550002');

-- Trigger created profiles with phone
do $$ begin
  if (select count(*) from public.profiles where phone like '+1724555000%') <> 2 then
    raise exception 'profiles not created by trigger';
  end if;
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);

-- Gate rules
select pg_temp.expect_error($q$select public.complete_onboarding('Ann', (current_date - interval '17 years')::date, '15601', array['worker'], true)$q$, 'under_18');
select pg_temp.expect_error($q$select public.complete_onboarding('Ann', ((now() at time zone 'America/New_York')::date - interval '18 years' + interval '1 day')::date, '15601', array['worker'], true)$q$, 'under_18');
select pg_temp.expect_error($q$select public.complete_onboarding('Ann', '1990-01-01', '15222', array['worker'], true)$q$, 'outside_service_area');
select pg_temp.expect_error($q$select public.complete_onboarding('Ann', '1990-01-01', '15601', array['admin'], true)$q$, 'invalid_roles');
select pg_temp.expect_error($q$select public.complete_onboarding('Ann', '1990-01-01', '15601', array[]::text[], true)$q$, 'invalid_roles');
select pg_temp.expect_error($q$select public.complete_onboarding('Ann', '1990-01-01', '15601', array['worker'], false)$q$, 'adult_not_confirmed');
select pg_temp.expect_error($q$select public.complete_onboarding('  ', '1990-01-01', '15601', array['worker'], true)$q$, 'invalid_name');
select pg_temp.expect_error($q$select public.complete_onboarding('Ann', '1890-01-01', '15601', array['worker'], true)$q$, 'invalid_dob');
select pg_temp.expect_error($q$select public.complete_onboarding('Ann', (current_date + 1), '15601', array['worker'], true)$q$, 'invalid_dob');

-- Exactly 18 today (Eastern) passes
select public.complete_onboarding(' Ann Lee ', ((now() at time zone 'America/New_York')::date - interval '18 years')::date, '15601', array['worker','poster','worker'], true);
do $$ declare r public.profiles; begin
  select * into r from public.profiles where id = auth.uid();
  if r.full_name <> 'Ann Lee' or r.roles <> array['poster','worker'] or r.onboarded_at is null or r.adult_confirmed_at is null then
    raise exception 'onboarding did not save correctly: %', row_to_json(r);
  end if;
end $$;

-- RLS: cannot see other user's profile, cannot write directly
do $$ begin
  if (select count(*) from public.profiles) <> 1 then raise exception 'RLS leak: saw other profiles'; end if;
end $$;
do $$ begin
  begin
    update public.profiles set is_admin = true where id = auth.uid();
    raise exception 'direct update allowed';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Anonymous cannot onboard
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  begin
    perform public.complete_onboarding('X', '1990-01-01', '15601', array['worker'], true);
    raise exception 'anon could call complete_onboarding';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Suspended user cannot onboard; admin sees everyone
reset role;
update public.profiles set suspended_at = now() where id = '00000000-0000-0000-0000-000000000002';
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-000000000001';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
select pg_temp.expect_error($q$select public.complete_onboarding('Bo', '1990-01-01', '15601', array['poster'], true)$q$, 'suspended');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
do $$ begin
  if (select count(*) from public.profiles) <> 2 then raise exception 'admin should see all profiles'; end if;
end $$;

-- Phone change syncs
reset role;
update auth.users set phone = '+17245559999' where id = '00000000-0000-0000-0000-000000000002';
do $$ begin
  if (select phone from public.profiles where id = '00000000-0000-0000-0000-000000000002') <> '+17245559999' then
    raise exception 'phone not synced';
  end if;
end $$;

\echo 'slice1 db tests: PASS'
