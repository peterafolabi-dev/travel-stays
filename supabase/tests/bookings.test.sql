\set ON_ERROR_STOP on
-- Database behaviour tests. Every check raises an exception on failure.

create function pg_temp.fails_with(q text, expected_state text) returns void language plpgsql as $f$
begin
  execute q;
exception when others then
  if sqlstate <> expected_state then
    raise exception 'expected SQLSTATE %, got % (%) for: %', expected_state, sqlstate, sqlerrm, q;
  end if;
  return;
end $f$;

create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $f$
begin
  if ok is not true then raise exception 'ASSERTION FAILED: %', msg; end if;
end $f$;

create function pg_temp.as_user(u uuid) returns void language sql as
  $$ select set_config('request.jwt.claim.sub', u::text, false) $$;

-- fixtures ------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'host@test.dev',  '{"role":"host","full_name":"Host"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.dev',     '{"role":"traveler","full_name":"B"}'),
  ('00000000-0000-0000-0000-00000000000c', 'c@test.dev',     '{"role":"traveler","full_name":"C"}');

insert into public.listings (id, title, city, price_per_night, max_guests, host_id, status, booking_mode)
values ('11111111-1111-1111-1111-111111111111', 'Test flat', 'Lagos', 50000, 4,
        '00000000-0000-0000-0000-00000000000a', 'active', 'request');

create function pg_temp.mk(ci int, co int, st text, pay text, age interval default '0') returns uuid language sql as $$
  insert into public.bookings (listing_id, traveler_id, host_id, check_in, check_out, guests, status, payment_status,
                               nights, price_per_night, cleaning_fee, service_fee, total, created_at)
  values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000b',
          '00000000-0000-0000-0000-00000000000a', current_date + ci, current_date + co, 1, st, pay,
          co - ci, 50000, 0, 0, (co - ci) * 50000, now() - age)
  returning id $$;

-- 1. the exclusion constraint ------------------------------------------------
select pg_temp.mk(10, 13, 'pending', 'unpaid');
select pg_temp.fails_with(format('select pg_temp.mk(12, 15, %L, %L)', 'confirmed', 'unpaid'), '23P01');   -- overlapping nights
select pg_temp.fails_with(format('select pg_temp.mk(10, 13, %L, %L)', 'pending', 'unpaid'), '23P01');     -- identical dates
select pg_temp.mk(13, 16, 'confirmed', 'unpaid');                                                          -- check-out day is free for the next guest ('[)')
update public.bookings set status = 'cancelled' where check_in = current_date + 10;
select pg_temp.assert(pg_temp.mk(10, 13, 'pending', 'unpaid') is not null, 'cancelled booking still blocks dates');
delete from public.bookings;

-- 2. create_booking: price comes from the server, clashes are refused ------------
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
create temp table made as select * from public.create_booking('11111111-1111-1111-1111-111111111111', current_date + 20, current_date + 22, 2);
grant all on made to public;
do $$
declare b record;
begin
  select * into b from made;
  if b.nights <> 2 or b.price_per_night <> 50000 or b.service_fee <> 10000 or b.total <> 110000 then
    raise exception 'server-side price wrong: % nights, fee %, total %', b.nights, b.service_fee, b.total;
  end if;
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
do $$
begin
  perform public.create_booking('11111111-1111-1111-1111-111111111111', current_date + 21, current_date + 23, 1);
  raise exception 'second traveller was allowed to double book';
exception when others then
  if sqlerrm not like '%just booked%' then raise exception 'unexpected error: %', sqlerrm; end if;
end $$;

-- 3. row-level security -------------------------------------------------------
do $$ begin
  if (select count(*) from public.bookings) <> 0 then raise exception 'C can see someone else''s booking'; end if;
end $$;
select pg_temp.fails_with($q$insert into public.bookings (listing_id, traveler_id, check_in, check_out, guests, nights, price_per_night, service_fee, total)
  values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000c', current_date + 40, current_date + 41, 1, 1, 1, 0, 1)$q$, '42501');
select pg_temp.fails_with($q$insert into public.payments (booking_id, traveler_id, reference, amount) values (gen_random_uuid(), '00000000-0000-0000-0000-00000000000c', 'x', 1)$q$, '42501');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
do $$ begin
  if (select count(*) from public.bookings) <> 1 then raise exception 'B should see exactly their own booking'; end if;
  begin
    update public.bookings set status = 'confirmed', payment_status = 'paid', total = 1;
    if exists (select 1 from public.bookings where payment_status = 'paid' or total = 1) then raise exception 'B changed their own booking directly'; end if;
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- 4. expiry of unpaid holds --------------------------------------------------------
delete from public.bookings;
create temp table ids (name text primary key, id uuid, n integer);
grant all on ids to public;
insert into ids values ('stale', pg_temp.mk(40, 43, 'pending',   'unpaid', interval '5 days'), null);
insert into ids values ('paid',  pg_temp.mk(50, 53, 'confirmed', 'paid',   interval '5 days'), null);
insert into ids values ('fresh', pg_temp.mk(60, 63, 'pending',   'unpaid', interval '1 hour'), null);
insert into ids values ('paying', pg_temp.mk(70, 73, 'confirmed', 'unpaid', interval '5 days'), null);
insert into public.payments (booking_id, traveler_id, reference, amount)
  values ((select id from ids where name = 'paying'), '00000000-0000-0000-0000-00000000000b', 'ref_paying_now', 1000);
select pg_temp.fails_with($q$select pg_temp.mk(41, 42, 'pending', 'unpaid')$q$, '23P01');   -- the stale hold blocks dates until it expires
update ids set n = public.expire_stale_bookings(72) where name = 'stale';
select pg_temp.assert((select n from ids where name = 'stale') = 1, 'expected exactly 1 booking to expire');
select pg_temp.assert((select status from public.bookings where id = (select id from ids where name = 'stale')) = 'cancelled', 'stale booking not cancelled');
select pg_temp.assert((select status from public.bookings where id = (select id from ids where name = 'paid'))  = 'confirmed', 'paid booking was touched');
select pg_temp.assert((select status from public.bookings where id = (select id from ids where name = 'fresh')) = 'pending',   'fresh booking was touched');
select pg_temp.assert((select status from public.bookings where id = (select id from ids where name = 'paying')) = 'confirmed', 'booking with a payment in progress was cancelled');
select pg_temp.assert(pg_temp.mk(41, 42, 'pending', 'unpaid') is not null, 'dates not freed after expiry');
set role authenticated;
select pg_temp.fails_with('select public.expire_stale_bookings()', '42501');                -- a browser cannot run it
reset role;

\echo all SQL tests passed
