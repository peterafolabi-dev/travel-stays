\set ON_ERROR_STOP on
insert into auth.users (email, raw_user_meta_data)
select 'guest' || i || '@test.dev', '{"role":"traveler"}' from generate_series(1, 8) i;
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000aa', 'racehost@test.dev', '{"role":"host"}');
insert into public.listings (title, city, price_per_night, max_guests, host_id, status, booking_mode)
values ('Race listing', 'Abuja', 30000, 2, '00000000-0000-0000-0000-0000000000aa', 'active', 'instant');
