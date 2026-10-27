-- Travel & Stays â€” database schema (Supabase / Postgres)
--
-- This file records how the database is set up so it lives with the code.
-- It was reconstructed from the app and the live `listings` table; compare it
-- with the Supabase dashboard (Table Editor / SQL Editor) and keep it in sync
-- whenever you change a table.

-- ---------------------------------------------------------------------------
-- profiles: one row per user, linked to Supabase Auth
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  role        text not null default 'traveler'
              check (role in ('traveler', 'host', 'guide', 'admin')),
  created_at  timestamptz not null default now()
);

-- When someone signs up, copy the name and role they chose (sent from
-- Signup.jsx as user metadata) into `profiles`.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    coalesce(new.raw_user_meta_data ->> 'role', 'traveler')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

create policy "Users can read their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- listings: accommodation listed by hosts
-- ---------------------------------------------------------------------------
create table if not exists public.listings (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  description      text,
  city             text not null,
  price_per_night  integer not null check (price_per_night >= 0), -- in naira
  max_guests       integer not null check (max_guests > 0),
  created_at       timestamptz not null default now()
);

alter table public.listings enable row level security;

-- Anyone (even logged-out visitors) can browse listings.
create policy "Listings are public"
  on public.listings for select
  using (true);



-- 002 â€” Hosts can create and manage their own listings, with photos.
-- Run once in Supabase â†’ SQL Editor. Safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. New listing columns
-- ---------------------------------------------------------------------------
alter table public.listings
  add column if not exists host_id uuid references auth.users (id) on delete cascade,
  add column if not exists property_type text not null default 'apartment',
  add column if not exists bedrooms integer not null default 1,
  add column if not exists address text,
  add column if not exists photos text[] not null default '{}',
  add column if not exists status text not null default 'active',
  add column if not exists booking_mode text not null default 'request',
  add column if not exists host_verified boolean not null default false,
  add column if not exists rating numeric(2, 1),
  add column if not exists review_count integer not null default 0;

alter table public.listings drop constraint if exists listings_booking_mode_check;
alter table public.listings add constraint listings_booking_mode_check
  check (booking_mode in ('instant', 'request'));

alter table public.listings drop constraint if exists listings_property_type_check;
alter table public.listings add constraint listings_property_type_check
  check (property_type in ('apartment', 'guesthouse', 'hotel_room', 'house'));

alter table public.listings drop constraint if exists listings_bedrooms_check;
alter table public.listings add constraint listings_bedrooms_check check (bedrooms >= 0);

alter table public.listings drop constraint if exists listings_status_check;
alter table public.listings add constraint listings_status_check
  check (status in ('active', 'paused'));

create index if not exists listings_host_id_idx on public.listings (host_id);

-- ---------------------------------------------------------------------------
-- 2. Who can do what with listings (row-level security)
-- ---------------------------------------------------------------------------
-- Checks the caller's role without being blocked by the profiles table's own
-- security rules.
create or replace function public.is_host()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'host');
$$;

alter table public.listings enable row level security;

drop policy if exists "Listings are public" on public.listings;
create policy "Listings are public"
  on public.listings for select
  using (status = 'active' or host_id = auth.uid());

drop policy if exists "Hosts create their own listings" on public.listings;
create policy "Hosts create their own listings"
  on public.listings for insert to authenticated
  with check (host_id = auth.uid() and public.is_host());

drop policy if exists "Hosts update their own listings" on public.listings;
create policy "Hosts update their own listings"
  on public.listings for update to authenticated
  using (host_id = auth.uid())
  with check (host_id = auth.uid());

drop policy if exists "Hosts delete their own listings" on public.listings;
create policy "Hosts delete their own listings"
  on public.listings for delete to authenticated
  using (host_id = auth.uid());

-- Hosts may only write the columns they own. `host_verified` is set by an
-- admin after checking documents, and `rating` / `review_count` are filled
-- in from reviews â€” a host can't give themselves a badge or a 5-star rating.
revoke insert, update on public.listings from authenticated;
grant insert (host_id, title, description, city, address, property_type, bedrooms,
              max_guests, price_per_night, photos, status, booking_mode)
  on public.listings to authenticated;
grant update (title, description, city, address, property_type, bedrooms,
              max_guests, price_per_night, photos, status, booking_mode)
  on public.listings to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Photo storage
-- ---------------------------------------------------------------------------
-- Public bucket: anyone can view photos; files are stored as <host id>/<file>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-photos', 'listing-photos', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "Hosts upload listing photos" on storage.objects;
create policy "Hosts upload listing photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_host()
  );

drop policy if exists "Hosts delete their listing photos" on storage.objects;
create policy "Hosts delete their listing photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );



-- 003 â€” Bookings with double-booking protection.
-- Run once in Supabase â†’ SQL Editor, after 002. Safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. Optional cleaning fee on listings
-- ---------------------------------------------------------------------------
alter table public.listings
  add column if not exists cleaning_fee integer not null default 0;

alter table public.listings drop constraint if exists listings_cleaning_fee_check;
alter table public.listings add constraint listings_cleaning_fee_check check (cleaning_fee >= 0);

grant insert (cleaning_fee), update (cleaning_fee) on public.listings to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Bookings table
-- ---------------------------------------------------------------------------
-- Needed so the exclusion constraint below can combine "same listing" (=)
-- with "overlapping dates" (&&).
create extension if not exists btree_gist;

create table if not exists public.bookings (
  id              uuid primary key default gen_random_uuid(),
  listing_id      uuid not null references public.listings (id) on delete cascade,
  traveler_id     uuid not null references auth.users (id) on delete cascade,
  host_id         uuid references auth.users (id) on delete set null,
  check_in        date not null,
  check_out       date not null,
  guests          integer not null check (guests > 0),
  status          text not null default 'pending'
                  check (status in ('pending', 'confirmed', 'declined', 'cancelled', 'completed')),
  -- Price snapshot at booking time (naira), so later price changes don't
  -- affect existing bookings.
  nights          integer not null,
  price_per_night integer not null,
  cleaning_fee    integer not null default 0,
  service_fee     integer not null,
  total           integer not null,
  created_at      timestamptz not null default now(),

  constraint bookings_dates_check check (check_out > check_in),

  -- DOUBLE-BOOKING PROTECTION. Postgres itself refuses any new pending or
  -- confirmed booking whose nights overlap another one on the same listing.
  -- '[)' means the check-out day is free, so one guest can leave the same
  -- morning the next one arrives. Because the database enforces this, two
  -- people clicking "Book" at the same instant can never both succeed.
  constraint bookings_no_overlap exclude using gist (
    listing_id with =,
    daterange(check_in, check_out, '[)') with &&
  ) where (status in ('pending', 'confirmed'))
);

create index if not exists bookings_traveler_idx on public.bookings (traveler_id);
create index if not exists bookings_host_idx on public.bookings (host_id);

-- Travellers see their own bookings; hosts see bookings for their listings.
-- Nobody writes to the table directly â€” only through the functions below.
alter table public.bookings enable row level security;

drop policy if exists "Travellers and hosts see their bookings" on public.bookings;
create policy "Travellers and hosts see their bookings"
  on public.bookings for select to authenticated
  using (traveler_id = auth.uid() or host_id = auth.uid());

revoke all on public.bookings from anon, authenticated;
grant select on public.bookings to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Create a booking
-- ---------------------------------------------------------------------------
-- The price is worked out here on the server, never trusted from the
-- browser. Instant Book listings are confirmed straight away; others wait
-- for the host (status 'pending'), which still holds the dates.
create or replace function public.create_booking(
  p_listing_id uuid,
  p_check_in date,
  p_check_out date,
  p_guests integer
)
returns public.bookings
language plpgsql
security definer set search_path = public
as $$
declare
  l public.listings;
  n integer;
  subtotal integer;
  fee integer;
  b public.bookings;
begin
  if auth.uid() is null then
    raise exception 'Please log in to book.';
  end if;

  select * into l from public.listings where id = p_listing_id and status = 'active';
  if not found then
    raise exception 'This listing is not available for booking.';
  end if;
  if l.host_id = auth.uid() then
    raise exception 'You can''t book your own listing.';
  end if;
  if p_check_in < current_date then
    raise exception 'Check-in can''t be in the past.';
  end if;
  if p_check_out <= p_check_in then
    raise exception 'Check-out must be after check-in.';
  end if;

  n := p_check_out - p_check_in;
  if n > 30 then
    raise exception 'Stays are limited to 30 nights.';
  end if;
  if p_guests < 1 or p_guests > l.max_guests then
    raise exception 'This place fits up to % guests.', l.max_guests;
  end if;

  subtotal := n * l.price_per_night;
  fee := round((subtotal + l.cleaning_fee) * 0.10); -- 10% service fee; keep in sync with lib/bookings.js

  insert into public.bookings (
    listing_id, traveler_id, host_id, check_in, check_out, guests, status,
    nights, price_per_night, cleaning_fee, service_fee, total
  ) values (
    l.id, auth.uid(), l.host_id, p_check_in, p_check_out, p_guests,
    case when l.booking_mode = 'instant' then 'confirmed' else 'pending' end,
    n, l.price_per_night, l.cleaning_fee, fee, subtotal + l.cleaning_fee + fee
  )
  returning * into b;

  return b;
exception
  when exclusion_violation then
    raise exception 'Sorry, those dates were just booked by someone else. Please pick different dates.';
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Host accepts / declines a request, traveller cancels
-- ---------------------------------------------------------------------------
create or replace function public.respond_to_booking(p_booking_id uuid, p_accept boolean)
returns public.bookings
language plpgsql
security definer set search_path = public
as $$
declare
  b public.bookings;
begin
  update public.bookings
     set status = case when p_accept then 'confirmed' else 'declined' end
   where id = p_booking_id and host_id = auth.uid() and status = 'pending'
  returning * into b;

  if not found then
    raise exception 'This request can no longer be changed.';
  end if;
  return b;
end;
$$;

create or replace function public.cancel_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer set search_path = public
as $$
declare
  b public.bookings;
begin
  update public.bookings
     set status = 'cancelled'
   where id = p_booking_id
     and traveler_id = auth.uid()
     and status in ('pending', 'confirmed')
     and check_in > current_date
  returning * into b;

  if not found then
    raise exception 'This booking can no longer be cancelled.';
  end if;
  return b;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Booked dates for the calendar
-- ---------------------------------------------------------------------------
-- Lets anyone see which nights are taken on a listing â€” dates only, never who
-- booked them.
create or replace function public.listing_booked_ranges(p_listing_id uuid)
returns table (check_in date, check_out date)
language sql
stable
security definer set search_path = public
as $$
  select b.check_in, b.check_out
    from public.bookings b
   where b.listing_id = p_listing_id
     and b.status in ('pending', 'confirmed')
     and b.check_out > current_date
   order by b.check_in;
$$;

revoke execute on function public.create_booking(uuid, date, date, integer) from public, anon;
revoke execute on function public.respond_to_booking(uuid, boolean) from public, anon;
revoke execute on function public.cancel_booking(uuid) from public, anon;
grant execute on function public.create_booking(uuid, date, date, integer) to authenticated;
grant execute on function public.respond_to_booking(uuid, boolean) to authenticated;
grant execute on function public.cancel_booking(uuid) to authenticated;
grant execute on function public.listing_booked_ranges(uuid) to anon, authenticated;



-- 004 â€” Hosts can see the names of guests who booked with them.
-- Run once in Supabase â†’ SQL Editor, after 003. Safe to re-run.

-- Only the profile of a traveller who has a booking with this host â€” not
-- every user in the system.
drop policy if exists "Hosts see their guests' profiles" on public.profiles;
create policy "Hosts see their guests' profiles"
  on public.profiles for select to authenticated
  using (
    exists (
      select 1 from public.bookings b
       where b.traveler_id = profiles.id
         and b.host_id = auth.uid()
    )
  );



-- 005 â€” Profile details (phone, bio) that users can edit themselves.
-- Run once in Supabase â†’ SQL Editor, after 004. Safe to re-run.

alter table public.profiles
  add column if not exists phone text,
  add column if not exists bio text,
  add column if not exists created_at timestamptz not null default now();

alter table public.profiles drop constraint if exists profiles_phone_check;
alter table public.profiles add constraint profiles_phone_check
  check (phone is null or phone ~ '^[0-9+() -]{7,20}$');

alter table public.profiles drop constraint if exists profiles_bio_check;
alter table public.profiles add constraint profiles_bio_check
  check (bio is null or char_length(bio) <= 500);

-- Each user reads and edits only their own profile. (Hosts can also read the
-- profile of guests who booked with them â€” see 004.)
alter table public.profiles enable row level security;

drop policy if exists "Users read their own profile" on public.profiles;
create policy "Users read their own profile"
  on public.profiles for select to authenticated
  using (id = auth.uid());

drop policy if exists "Users update their own profile" on public.profiles;
create policy "Users update their own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Users may change their name, phone and bio â€” but never their own role.
revoke update on public.profiles from authenticated;
grant update (full_name, phone, bio) on public.profiles to authenticated;



-- 006 â€” Amenities, house rules, cancellation policy, and saved listings (wishlist).
-- Run once in Supabase â†’ SQL Editor, after 005. Safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. Listing details
-- ---------------------------------------------------------------------------
alter table public.listings
  add column if not exists amenities text[] not null default '{}',
  add column if not exists house_rules text[] not null default '{}',
  add column if not exists extra_rules text,
  add column if not exists check_in_time text not null default '14:00',
  add column if not exists check_out_time text not null default '11:00',
  add column if not exists cancellation_policy text not null default 'moderate';

alter table public.listings drop constraint if exists listings_cancellation_policy_check;
alter table public.listings add constraint listings_cancellation_policy_check
  check (cancellation_policy in ('flexible', 'moderate', 'strict'));

alter table public.listings drop constraint if exists listings_times_check;
alter table public.listings add constraint listings_times_check
  check (check_in_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
     and check_out_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

alter table public.listings drop constraint if exists listings_extra_rules_check;
alter table public.listings add constraint listings_extra_rules_check
  check (extra_rules is null or char_length(extra_rules) <= 500);

grant insert (amenities, house_rules, extra_rules, check_in_time, check_out_time, cancellation_policy),
      update (amenities, house_rules, extra_rules, check_in_time, check_out_time, cancellation_policy)
  on public.listings to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Saved listings (wishlist)
-- ---------------------------------------------------------------------------
create table if not exists public.saved_listings (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

-- Each user sees and changes only their own saved list.
alter table public.saved_listings enable row level security;

drop policy if exists "Users read their saved listings" on public.saved_listings;
create policy "Users read their saved listings"
  on public.saved_listings for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users save listings" on public.saved_listings;
create policy "Users save listings"
  on public.saved_listings for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users unsave listings" on public.saved_listings;
create policy "Users unsave listings"
  on public.saved_listings for delete to authenticated
  using (user_id = auth.uid());

revoke all on public.saved_listings from anon, authenticated;
grant select, insert, delete on public.saved_listings to authenticated;



-- 007 â€” Paystack payments.
-- Run once in Supabase â†’ SQL Editor, after 006. Safe to re-run.
--
-- Flow: the app calls start_payment() â†’ opens the Paystack popup with the
-- returned reference and amount â†’ the verify-payment Edge Function asks
-- Paystack whether that reference really succeeded for the right amount, and
-- only then marks the booking as paid.

-- ---------------------------------------------------------------------------
-- 1. Payment status on bookings
-- ---------------------------------------------------------------------------
alter table public.bookings
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists paid_at timestamptz,
  add column if not exists payment_reference text;

alter table public.bookings drop constraint if exists bookings_payment_status_check;
alter table public.bookings add constraint bookings_payment_status_check
  check (payment_status in ('unpaid', 'paid', 'refunded'));

-- ---------------------------------------------------------------------------
-- 2. One row per payment attempt
-- ---------------------------------------------------------------------------
create table if not exists public.payments (
  id               uuid primary key default gen_random_uuid(),
  booking_id       uuid not null references public.bookings (id) on delete cascade,
  traveler_id      uuid not null references auth.users (id) on delete cascade,
  reference        text not null unique,
  amount           integer not null check (amount > 0), -- in kobo (â‚¦1 = 100 kobo)
  status           text not null default 'pending'
                   check (status in ('pending', 'success', 'failed', 'abandoned')),
  channel          text,            -- card, bank_transfer, ussdâ€¦ (from Paystack)
  gateway_response text,            -- Paystack's message, for support
  created_at       timestamptz not null default now(),
  verified_at      timestamptz
);

create index if not exists payments_booking_idx on public.payments (booking_id);

-- Travellers see their own payments; hosts see payments for their bookings.
-- Only the server (start_payment and the Edge Function) writes payments.
alter table public.payments enable row level security;

drop policy if exists "Travellers and hosts see payments" on public.payments;
create policy "Travellers and hosts see payments"
  on public.payments for select to authenticated
  using (
    traveler_id = auth.uid()
    or exists (select 1 from public.bookings b where b.id = booking_id and b.host_id = auth.uid())
  );

revoke all on public.payments from anon, authenticated;
grant select on public.payments to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Start a payment
-- ---------------------------------------------------------------------------
-- Works out the amount on the server from the booking itself, so the price
-- can't be changed in the browser. Only confirmed, unpaid bookings can be paid.
create or replace function public.start_payment(p_booking_id uuid)
returns table (reference text, amount integer, email text)
language plpgsql
security definer set search_path = public
as $$
declare
  b public.bookings;
  ref text;
begin
  select * into b from public.bookings where id = p_booking_id and traveler_id = auth.uid();
  if not found then
    raise exception 'Booking not found.';
  end if;
  if b.status <> 'confirmed' then
    raise exception 'You can pay once your booking is confirmed by the host.';
  end if;
  if b.payment_status = 'paid' then
    raise exception 'This booking has already been paid.';
  end if;

  ref := 'TS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16));

  insert into public.payments (booking_id, traveler_id, reference, amount)
  values (b.id, auth.uid(), ref, b.total * 100);

  return query select ref, b.total * 100, (auth.jwt() ->> 'email')::text;
end;
$$;

revoke execute on function public.start_payment(uuid) from public, anon;
grant execute on function public.start_payment(uuid) to authenticated;



-- 008 â€” Hosts can block dates on their listings.
-- Run once in Supabase â†’ SQL Editor, after 007. Safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. Blocked date ranges
-- ---------------------------------------------------------------------------
create table if not exists public.listing_blocks (
  id         uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  start_date date not null,
  end_date   date not null, -- the first night that is free again (like check_out)
  note       text check (note is null or char_length(note) <= 100),
  created_at timestamptz not null default now(),
  constraint listing_blocks_dates_check check (end_date > start_date)
);

create index if not exists listing_blocks_listing_idx on public.listing_blocks (listing_id);

-- Only the listing's host can see, add or remove its blocks. Guests only see
-- that the dates are taken (through listing_booked_ranges below).
alter table public.listing_blocks enable row level security;

drop policy if exists "Hosts manage their listing blocks" on public.listing_blocks;
create policy "Hosts manage their listing blocks"
  on public.listing_blocks for all to authenticated
  using (exists (select 1 from public.listings l where l.id = listing_id and l.host_id = auth.uid()))
  with check (exists (select 1 from public.listings l where l.id = listing_id and l.host_id = auth.uid()));

revoke all on public.listing_blocks from anon, authenticated;
grant select, insert, delete on public.listing_blocks to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Bookings can't land on blocked dates
-- ---------------------------------------------------------------------------
-- Same as in 003, plus: the listing row is locked while booking (so a host
-- can't block dates at the same instant a guest books them) and blocked
-- nights are refused.
create or replace function public.create_booking(
  p_listing_id uuid,
  p_check_in date,
  p_check_out date,
  p_guests integer
)
returns public.bookings
language plpgsql
security definer set search_path = public
as $$
declare
  l public.listings;
  n integer;
  subtotal integer;
  fee integer;
  b public.bookings;
begin
  if auth.uid() is null then
    raise exception 'Please log in to book.';
  end if;

  select * into l from public.listings where id = p_listing_id and status = 'active' for update;
  if not found then
    raise exception 'This listing is not available for booking.';
  end if;
  if l.host_id = auth.uid() then
    raise exception 'You can''t book your own listing.';
  end if;
  if p_check_in < current_date then
    raise exception 'Check-in can''t be in the past.';
  end if;
  if p_check_out <= p_check_in then
    raise exception 'Check-out must be after check-in.';
  end if;

  n := p_check_out - p_check_in;
  if n > 30 then
    raise exception 'Stays are limited to 30 nights.';
  end if;
  if p_guests < 1 or p_guests > l.max_guests then
    raise exception 'This place fits up to % guests.', l.max_guests;
  end if;

  if exists (
    select 1 from public.listing_blocks k
     where k.listing_id = l.id
       and daterange(k.start_date, k.end_date, '[)') && daterange(p_check_in, p_check_out, '[)')
  ) then
    raise exception 'The host isn''t available on some of these dates. Please pick different dates.';
  end if;

  subtotal := n * l.price_per_night;
  fee := round((subtotal + l.cleaning_fee) * 0.10); -- 10% service fee; keep in sync with lib/bookings.js

  insert into public.bookings (
    listing_id, traveler_id, host_id, check_in, check_out, guests, status,
    nights, price_per_night, cleaning_fee, service_fee, total
  ) values (
    l.id, auth.uid(), l.host_id, p_check_in, p_check_out, p_guests,
    case when l.booking_mode = 'instant' then 'confirmed' else 'pending' end,
    n, l.price_per_night, l.cleaning_fee, fee, subtotal + l.cleaning_fee + fee
  )
  returning * into b;

  return b;
exception
  when exclusion_violation then
    raise exception 'Sorry, those dates were just booked by someone else. Please pick different dates.';
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Guests' calendars also grey out blocked dates
-- ---------------------------------------------------------------------------
create or replace function public.listing_booked_ranges(p_listing_id uuid)
returns table (check_in date, check_out date)
language sql
stable
security definer set search_path = public
as $$
  select b.check_in, b.check_out
    from public.bookings b
   where b.listing_id = p_listing_id
     and b.status in ('pending', 'confirmed')
     and b.check_out > current_date
  union all
  select k.start_date, k.end_date
    from public.listing_blocks k
   where k.listing_id = p_listing_id
     and k.end_date > current_date
  order by 1;
$$;



-- 009 â€” Reviews: only guests who actually stayed can review, once per booking.
-- Run once in Supabase â†’ SQL Editor, after 008. Safe to re-run.

create table if not exists public.reviews (
  id              uuid primary key default gen_random_uuid(),
  booking_id      uuid not null unique references public.bookings (id) on delete cascade, -- one review per stay
  listing_id      uuid not null references public.listings (id) on delete cascade,
  author_id       uuid not null references auth.users (id) on delete cascade,
  host_id         uuid references auth.users (id) on delete set null,
  author_name     text not null,               -- first name only, so profiles stay private
  rating          integer not null check (rating between 1 and 5),
  comment         text not null check (char_length(comment) between 10 and 1000),
  host_reply      text check (host_reply is null or char_length(host_reply) <= 1000),
  host_replied_at timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists reviews_listing_idx on public.reviews (listing_id, created_at desc);

-- Anyone can read reviews. Nobody writes to the table directly â€” only
-- through the two functions below, which check who is allowed.
alter table public.reviews enable row level security;

drop policy if exists "Reviews are public" on public.reviews;
create policy "Reviews are public" on public.reviews for select using (true);

revoke all on public.reviews from anon, authenticated;
grant select on public.reviews to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Leave a review
-- ---------------------------------------------------------------------------
-- Only the guest on the booking, only after check-out, only once. Then the
-- listing's average rating and review count are recalculated.
create or replace function public.submit_review(p_booking_id uuid, p_rating integer, p_comment text)
returns public.reviews
language plpgsql
security definer set search_path = public
as $$
declare
  b public.bookings;
  first_name text;
  r public.reviews;
begin
  select * into b from public.bookings where id = p_booking_id and traveler_id = auth.uid();
  if not found then
    raise exception 'Booking not found.';
  end if;
  if b.status not in ('confirmed', 'completed') then
    raise exception 'Only confirmed stays can be reviewed.';
  end if;
  if b.check_out > current_date then
    raise exception 'You can leave a review after your stay ends.';
  end if;
  if exists (select 1 from public.reviews where booking_id = b.id) then
    raise exception 'You have already reviewed this stay.';
  end if;
  if p_rating < 1 or p_rating > 5 then
    raise exception 'Please choose between 1 and 5 stars.';
  end if;
  if char_length(trim(coalesce(p_comment, ''))) < 10 then
    raise exception 'Please write at least a few words (10+ characters).';
  end if;

  select split_part(coalesce(nullif(trim(full_name), ''), 'Guest'), ' ', 1) into first_name
    from public.profiles where id = auth.uid();

  insert into public.reviews (booking_id, listing_id, author_id, host_id, author_name, rating, comment)
  values (b.id, b.listing_id, auth.uid(), b.host_id, coalesce(first_name, 'Guest'), p_rating, trim(p_comment))
  returning * into r;

  update public.bookings set status = 'completed' where id = b.id and status = 'confirmed';

  update public.listings l
     set rating = s.avg_rating, review_count = s.n
    from (select round(avg(rating)::numeric, 1) as avg_rating, count(*)::integer as n
            from public.reviews where listing_id = b.listing_id) s
   where l.id = b.listing_id;

  return r;
end;
$$;

-- ---------------------------------------------------------------------------
-- Host replies to a review on their listing (once)
-- ---------------------------------------------------------------------------
create or replace function public.reply_to_review(p_review_id uuid, p_reply text)
returns public.reviews
language plpgsql
security definer set search_path = public
as $$
declare
  r public.reviews;
begin
  if char_length(trim(coalesce(p_reply, ''))) < 2 then
    raise exception 'Please write a reply.';
  end if;

  update public.reviews
     set host_reply = trim(p_reply), host_replied_at = now()
   where id = p_review_id and host_id = auth.uid() and host_reply is null
  returning * into r;

  if not found then
    raise exception 'You can only reply once to reviews of your own listings.';
  end if;
  return r;
end;
$$;

revoke execute on function public.submit_review(uuid, integer, text) from public, anon;
revoke execute on function public.reply_to_review(uuid, text) from public, anon;
grant execute on function public.submit_review(uuid, integer, text) to authenticated;
grant execute on function public.reply_to_review(uuid, text) to authenticated;



-- 010 â€” Admin dashboard (users, activity, platform stats) + Google sign-in role.
-- Run once in Supabase â†’ SQL Editor, after 009. Safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. "Last seen" â€” updated by the app every few minutes while someone uses it
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists last_seen_at timestamptz;

create or replace function public.touch_last_seen()
returns void
language sql
security definer set search_path = public
as $$
  update public.profiles set last_seen_at = now() where id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- 2. Who is an admin?
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------------------------------------------------------------------------
-- 3. Platform numbers for the dashboard (admins only)
-- ---------------------------------------------------------------------------
create or replace function public.admin_stats()
returns json
language plpgsql
stable
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only.';
  end if;

  return json_build_object(
    'users',            (select count(*) from public.profiles),
    'travelers',        (select count(*) from public.profiles where role = 'traveler'),
    'hosts',            (select count(*) from public.profiles where role = 'host'),
    'guides',           (select count(*) from public.profiles where role = 'guide'),
    'admins',           (select count(*) from public.profiles where role = 'admin'),
    'new_users_7d',     (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'active_24h',       (select count(*) from public.profiles where last_seen_at > now() - interval '24 hours'),
    'active_7d',        (select count(*) from public.profiles where last_seen_at > now() - interval '7 days'),
    'listings',         (select count(*) from public.listings),
    'active_listings',  (select count(*) from public.listings where status = 'active'),
    'bookings',         (select count(*) from public.bookings),
    'pending_bookings', (select count(*) from public.bookings where status = 'pending'),
    'paid_bookings',    (select count(*) from public.bookings where payment_status = 'paid'),
    'revenue',          (select coalesce(sum(total), 0) from public.bookings where payment_status = 'paid'),
    'platform_fees',    (select coalesce(sum(service_fee), 0) from public.bookings where payment_status = 'paid'),
    'reviews',          (select count(*) from public.reviews),
    'avg_rating',       (select round(avg(rating)::numeric, 1) from public.reviews),
    'signups_14d', (
      select json_agg(json_build_object('day', d::date, 'count', (
        select count(*) from public.profiles p where p.created_at::date = d::date
      )) order by d)
      from generate_series(current_date - 13, current_date, interval '1 day') d
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. User list for the dashboard (admins only) â€” includes email from auth
-- ---------------------------------------------------------------------------
create or replace function public.admin_users()
returns table (
  id uuid,
  full_name text,
  email text,
  role text,
  created_at timestamptz,
  last_seen_at timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql
stable
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only.';
  end if;

  return query
    select p.id, p.full_name, u.email::text, p.role, p.created_at, p.last_seen_at, u.last_sign_in_at
      from public.profiles p
      join auth.users u on u.id = p.id
     order by coalesce(p.last_seen_at, p.created_at) desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Google sign-up: pick your role once
-- ---------------------------------------------------------------------------
-- Google doesn't know whether someone is a traveller, host or guide, so new
-- Google users start as travellers. Right after their first sign-in the app
-- applies the role they picked on the sign-up page â€” allowed only for brand
-- new accounts (first 15 minutes) that are still travellers.
create or replace function public.set_initial_role(p_role text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if p_role not in ('traveler', 'host', 'guide') then
    raise exception 'Choose traveller, host or guide.';
  end if;

  update public.profiles
     set role = p_role
   where id = auth.uid()
     and role = 'traveler'
     and created_at > now() - interval '15 minutes';
end;
$$;

revoke execute on function public.touch_last_seen() from public, anon;
revoke execute on function public.admin_stats() from public, anon;
revoke execute on function public.admin_users() from public, anon;
revoke execute on function public.set_initial_role(text) from public, anon;
grant execute on function public.touch_last_seen() to authenticated;
grant execute on function public.admin_stats() to authenticated;
grant execute on function public.admin_users() to authenticated;
grant execute on function public.set_initial_role(text) to authenticated;



-- 011 â€” Tours & experiences (PRD phase 2): guides list tours, travellers book
-- a date and a number of people, guides accept or decline.
-- Run once in Supabase â†’ SQL Editor, after 010. Safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. Who is a guide? (same idea as is_host() in 002)
-- ---------------------------------------------------------------------------
create or replace function public.is_guide()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'guide');
$$;

-- ---------------------------------------------------------------------------
-- 2. Tours
-- ---------------------------------------------------------------------------
create table if not exists public.tours (
  id               uuid primary key default gen_random_uuid(),
  guide_id         uuid not null references auth.users (id) on delete cascade,
  title            text not null check (char_length(title) between 5 and 100),
  description      text check (description is null or char_length(description) <= 2000),
  city             text not null,
  category         text not null default 'culture' check (category in ('food', 'adventure', 'culture', 'nature')),
  duration_hours   numeric(3, 1) not null check (duration_hours > 0 and duration_hours <= 24),
  start_time       text not null default '09:00' check (start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  meeting_point    text,
  max_group        integer not null check (max_group between 1 and 50),
  price_per_person integer not null check (price_per_person >= 0), -- in naira
  itinerary        text check (itinerary is null or char_length(itinerary) <= 2000), -- one stop per line
  included         text[] not null default '{}',
  languages        text not null default 'English',
  days             text[] not null default '{mon,tue,wed,thu,fri,sat,sun}'
                   check (days <@ array['mon','tue','wed','thu','fri','sat','sun'] and cardinality(days) > 0),
  photos           text[] not null default '{}',
  status           text not null default 'active' check (status in ('active', 'paused')),
  created_at       timestamptz not null default now()
);

create index if not exists tours_city_idx on public.tours (city);
create index if not exists tours_guide_idx on public.tours (guide_id);

alter table public.tours enable row level security;

drop policy if exists "Active tours are public" on public.tours;
create policy "Active tours are public"
  on public.tours for select
  using (status = 'active' or guide_id = auth.uid());

drop policy if exists "Guides add their own tours" on public.tours;
create policy "Guides add their own tours"
  on public.tours for insert to authenticated
  with check (guide_id = auth.uid() and public.is_guide());

drop policy if exists "Guides edit their own tours" on public.tours;
create policy "Guides edit their own tours"
  on public.tours for update to authenticated
  using (guide_id = auth.uid())
  with check (guide_id = auth.uid());

drop policy if exists "Guides delete their own tours" on public.tours;
create policy "Guides delete their own tours"
  on public.tours for delete to authenticated
  using (guide_id = auth.uid());

grant select on public.tours to anon, authenticated;
grant insert, update, delete on public.tours to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Tour bookings â€” created and changed only through the functions below
-- ---------------------------------------------------------------------------
create table if not exists public.tour_bookings (
  id               uuid primary key default gen_random_uuid(),
  tour_id          uuid not null references public.tours (id) on delete cascade,
  traveler_id      uuid not null references auth.users (id) on delete cascade,
  guide_id         uuid not null references auth.users (id) on delete cascade,
  tour_date        date not null,
  people           integer not null check (people > 0),
  price_per_person integer not null,
  service_fee      integer not null,
  total            integer not null,
  status           text not null default 'pending'
                   check (status in ('pending', 'confirmed', 'declined', 'cancelled', 'completed')),
  created_at       timestamptz not null default now()
);

create index if not exists tour_bookings_tour_date_idx on public.tour_bookings (tour_id, tour_date);

alter table public.tour_bookings enable row level security;

drop policy if exists "Travellers and guides see their tour bookings" on public.tour_bookings;
create policy "Travellers and guides see their tour bookings"
  on public.tour_bookings for select to authenticated
  using (traveler_id = auth.uid() or guide_id = auth.uid());

revoke all on public.tour_bookings from anon, authenticated;
grant select on public.tour_bookings to authenticated;

-- A guide's public card on a tour page: first name and bio only (profiles
-- themselves stay private).
create or replace function public.guide_profile(p_guide_id uuid)
returns table (first_name text, bio text)
language sql
stable
security definer set search_path = public
as $$
  select split_part(coalesce(p.full_name, ''), ' ', 1), p.bio
    from public.profiles p
   where p.id = p_guide_id and p.role = 'guide';
$$;

grant execute on function public.guide_profile(uuid) to anon, authenticated;

-- Places still free on a date (anyone may ask â€” it reveals no personal data).
create or replace function public.tour_spots_left(p_tour_id uuid, p_date date)
returns integer
language sql
stable
security definer set search_path = public
as $$
  select greatest(t.max_group - coalesce((
           select sum(b.people) from public.tour_bookings b
            where b.tour_id = t.id and b.tour_date = p_date and b.status in ('pending', 'confirmed')
         ), 0), 0)::integer
    from public.tours t
   where t.id = p_tour_id;
$$;

-- Book a tour. The price is worked out here, never trusted from the browser.
-- Locking the tour row makes two people booking the last places at the same
-- moment safe: the second waits, then sees the updated count.
create or replace function public.create_tour_booking(p_tour_id uuid, p_date date, p_people integer)
returns public.tour_bookings
language plpgsql
security definer set search_path = public
as $$
declare
  t public.tours;
  taken integer;
  subtotal integer;
  fee integer;
  b public.tour_bookings;
begin
  if auth.uid() is null then
    raise exception 'Please log in to book.';
  end if;

  select * into t from public.tours where id = p_tour_id and status = 'active' for update;
  if not found then
    raise exception 'This tour is not available for booking.';
  end if;
  if t.guide_id = auth.uid() then
    raise exception 'You can''t book your own tour.';
  end if;
  if p_date < current_date then
    raise exception 'Pick a date from today onwards.';
  end if;
  if p_date > current_date + 180 then
    raise exception 'Tours can be booked up to 6 months ahead.';
  end if;
  if not (lower(to_char(p_date, 'Dy')) = any (t.days)) then
    raise exception 'This tour doesn''t run on that day of the week.';
  end if;
  if p_people < 1 or p_people > t.max_group then
    raise exception 'This tour takes up to % people.', t.max_group;
  end if;

  select coalesce(sum(people), 0) into taken
    from public.tour_bookings
   where tour_id = t.id and tour_date = p_date and status in ('pending', 'confirmed');
  if taken + p_people > t.max_group then
    raise exception 'Only % places left on that date.', greatest(t.max_group - taken, 0);
  end if;

  subtotal := p_people * t.price_per_person;
  fee := round(subtotal * 0.10); -- 10% service fee, same as stays

  insert into public.tour_bookings (
    tour_id, traveler_id, guide_id, tour_date, people, price_per_person, service_fee, total
  ) values (
    t.id, auth.uid(), t.guide_id, p_date, p_people, t.price_per_person, fee, subtotal + fee
  )
  returning * into b;

  return b;
end;
$$;

-- Guide accepts or declines a pending request.
create or replace function public.respond_tour_booking(p_booking_id uuid, p_accept boolean)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.tour_bookings
     set status = case when p_accept then 'confirmed' else 'declined' end
   where id = p_booking_id and guide_id = auth.uid() and status = 'pending';
  if not found then
    raise exception 'This request can no longer be changed.';
  end if;
end;
$$;

-- Traveller cancels a booking that hasn't happened yet.
create or replace function public.cancel_tour_booking(p_booking_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.tour_bookings
     set status = 'cancelled'
   where id = p_booking_id and traveler_id = auth.uid()
     and status in ('pending', 'confirmed') and tour_date >= current_date;
  if not found then
    raise exception 'This booking can no longer be cancelled.';
  end if;
end;
$$;

revoke execute on function public.create_tour_booking(uuid, date, integer) from public, anon;
revoke execute on function public.respond_tour_booking(uuid, boolean) from public, anon;
revoke execute on function public.cancel_tour_booking(uuid) from public, anon;
grant execute on function public.create_tour_booking(uuid, date, integer) to authenticated;
grant execute on function public.respond_tour_booking(uuid, boolean) to authenticated;
grant execute on function public.cancel_tour_booking(uuid) to authenticated;
grant execute on function public.tour_spots_left(uuid, date) to anon, authenticated;

-- Guides upload tour photos to the same bucket as listings (own folder only).
-- Replaces the hosts-only upload policy from 002.
drop policy if exists "Hosts upload listing photos" on storage.objects;
create policy "Hosts upload listing photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (public.is_host() or public.is_guide())
  );

-- ---------------------------------------------------------------------------
-- 4. Admin dashboard: include tours (replaces the version from 010)
-- ---------------------------------------------------------------------------
create or replace function public.admin_stats()
returns json
language plpgsql
stable
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only.';
  end if;

  return json_build_object(
    'users',            (select count(*) from public.profiles),
    'travelers',        (select count(*) from public.profiles where role = 'traveler'),
    'hosts',            (select count(*) from public.profiles where role = 'host'),
    'guides',           (select count(*) from public.profiles where role = 'guide'),
    'admins',           (select count(*) from public.profiles where role = 'admin'),
    'new_users_7d',     (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'active_24h',       (select count(*) from public.profiles where last_seen_at > now() - interval '24 hours'),
    'active_7d',        (select count(*) from public.profiles where last_seen_at > now() - interval '7 days'),
    'listings',         (select count(*) from public.listings),
    'active_listings',  (select count(*) from public.listings where status = 'active'),
    'tours',            (select count(*) from public.tours where status = 'active'),
    'tour_bookings',    (select count(*) from public.tour_bookings),
    'bookings',         (select count(*) from public.bookings),
    'pending_bookings', (select count(*) from public.bookings where status = 'pending'),
    'paid_bookings',    (select count(*) from public.bookings where payment_status = 'paid'),
    'revenue',          (select coalesce(sum(total), 0) from public.bookings where payment_status = 'paid'),
    'platform_fees',    (select coalesce(sum(service_fee), 0) from public.bookings where payment_status = 'paid'),
    'reviews',          (select count(*) from public.reviews),
    'avg_rating',       (select round(avg(rating)::numeric, 1) from public.reviews),
    'signups_14d', (
      select json_agg(json_build_object('day', d::date, 'count', (
        select count(*) from public.profiles p where p.created_at::date = d::date
      )) order by d)
      from generate_series(current_date - 13, current_date, interval '1 day') d
    )
  );
end;
$$;



-- 012 â€” Trust & safety (PRD 5.1 verification workflow, 5.6 trust & safety):
--   â€¢ hosts and guides submit an ID + selfie; an admin approves or rejects it
--   â€¢ anyone logged in can report a listing, tour or guide; admins review
-- Run once in Supabase â†’ SQL Editor, after 011. Safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. Verified status lives on the profile (set only by admins)
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists verified boolean not null default false;
-- Users can't change it: 005 only lets them update full_name, phone and bio.

-- New listings take the host's verified status automatically.
create or replace function public.set_listing_verified()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  new.host_verified := coalesce((select verified from public.profiles where id = new.host_id), false);
  return new;
end;
$$;

drop trigger if exists listings_set_verified on public.listings;
create trigger listings_set_verified
  before insert on public.listings
  for each row execute function public.set_listing_verified();

-- The guide card on tour pages now also says whether the guide is verified.
drop function if exists public.guide_profile(uuid);
create function public.guide_profile(p_guide_id uuid)
returns table (first_name text, bio text, verified boolean)
language sql
stable
security definer set search_path = public
as $$
  select split_part(coalesce(p.full_name, ''), ' ', 1), p.bio, p.verified
    from public.profiles p
   where p.id = p_guide_id and p.role = 'guide';
$$;
grant execute on function public.guide_profile(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. ID documents â€” a PRIVATE bucket (no public links, ever)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('verification-docs', 'verification-docs', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

drop policy if exists "Users upload their own ID documents" on storage.objects;
create policy "Users upload their own ID documents"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (public.is_host() or public.is_guide())
  );

-- Owners can see their own files; admins can see everyone's (to review them).
drop policy if exists "Owners and admins read ID documents" on storage.objects;
create policy "Owners and admins read ID documents"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'verification-docs'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

-- ---------------------------------------------------------------------------
-- 3. Verification requests
-- ---------------------------------------------------------------------------
create table if not exists public.verification_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  id_type     text not null check (id_type in ('nin', 'drivers_licence', 'passport', 'voters_card')),
  id_doc_path text not null,
  selfie_path text not null,
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reason      text check (reason is null or char_length(reason) <= 300),
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists verification_requests_user_idx on public.verification_requests (user_id, created_at desc);

alter table public.verification_requests enable row level security;

drop policy if exists "Users see their own verification requests" on public.verification_requests;
create policy "Users see their own verification requests"
  on public.verification_requests for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

revoke all on public.verification_requests from anon, authenticated;
grant select on public.verification_requests to authenticated;

-- Host or guide sends their documents (already uploaded to their own folder).
create or replace function public.submit_verification(p_id_type text, p_id_doc_path text, p_selfie_path text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not (public.is_host() or public.is_guide()) then
    raise exception 'Only hosts and guides can request verification.';
  end if;
  if exists (select 1 from public.profiles where id = auth.uid() and verified) then
    raise exception 'You are already verified.';
  end if;
  if exists (select 1 from public.verification_requests where user_id = auth.uid() and status = 'pending') then
    raise exception 'Your documents are already being reviewed.';
  end if;
  if split_part(p_id_doc_path, '/', 1) <> auth.uid()::text or split_part(p_selfie_path, '/', 1) <> auth.uid()::text then
    raise exception 'Invalid document upload.';
  end if;

  insert into public.verification_requests (user_id, id_type, id_doc_path, selfie_path)
  values (auth.uid(), p_id_type, p_id_doc_path, p_selfie_path);
end;
$$;

-- Admin queue: pending requests with the person's name, email and role.
create or replace function public.admin_verifications()
returns table (
  id uuid, user_id uuid, full_name text, email text, role text,
  id_type text, id_doc_path text, selfie_path text, created_at timestamptz
)
language plpgsql
stable
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only.';
  end if;
  return query
    select v.id, v.user_id, p.full_name, u.email::text, p.role, v.id_type, v.id_doc_path, v.selfie_path, v.created_at
      from public.verification_requests v
      join public.profiles p on p.id = v.user_id
      join auth.users u on u.id = v.user_id
     where v.status = 'pending'
     order by v.created_at;
end;
$$;

-- Admin approves (â†’ Verified badge on the profile and every listing) or rejects with a reason.
create or replace function public.review_verification(p_request_id uuid, p_approve boolean, p_reason text default null)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  uid uuid;
begin
  if not public.is_admin() then
    raise exception 'Admins only.';
  end if;

  update public.verification_requests
     set status = case when p_approve then 'approved' else 'rejected' end,
         reason = case when p_approve then null else nullif(trim(p_reason), '') end,
         reviewed_at = now()
   where id = p_request_id and status = 'pending'
  returning user_id into uid;

  if uid is null then
    raise exception 'This request has already been reviewed.';
  end if;

  if p_approve then
    update public.profiles set verified = true where id = uid;
    update public.listings set host_verified = true where host_id = uid;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Reports
-- ---------------------------------------------------------------------------
create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  target_type text not null check (target_type in ('listing', 'tour')),
  target_id   uuid not null,
  category    text not null check (category in ('fraud', 'unsafe', 'fake', 'inappropriate', 'other')),
  details     text check (details is null or char_length(details) <= 1000),
  status      text not null default 'open' check (status in ('open', 'dismissed', 'actioned')),
  created_at  timestamptz not null default now()
);

alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated; -- only through the functions below

create or replace function public.submit_report(p_target_type text, p_target_id uuid, p_category text, p_details text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Please log in to report.';
  end if;
  if exists (
    select 1 from public.reports
     where reporter_id = auth.uid() and target_id = p_target_id and status = 'open'
  ) then
    raise exception 'You have already reported this. Our team is looking into it.';
  end if;

  insert into public.reports (reporter_id, target_type, target_id, category, details)
  values (auth.uid(), p_target_type, p_target_id, p_category, nullif(trim(p_details), ''));
end;
$$;

create or replace function public.admin_reports()
returns table (
  id uuid, target_type text, target_id uuid, target_title text, target_status text,
  owner_name text, category text, details text, reporter_name text, created_at timestamptz
)
language plpgsql
stable
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only.';
  end if;
  return query
    select r.id, r.target_type, r.target_id,
           coalesce(l.title, t.title, 'Deleted'),
           coalesce(l.status, t.status, 'deleted'),
           o.full_name, r.category, r.details, rp.full_name, r.created_at
      from public.reports r
      left join public.listings l on r.target_type = 'listing' and l.id = r.target_id
      left join public.tours t on r.target_type = 'tour' and t.id = r.target_id
      left join public.profiles o on o.id = coalesce(l.host_id, t.guide_id)
      left join public.profiles rp on rp.id = r.reporter_id
     where r.status = 'open'
     order by r.created_at;
end;
$$;

-- Dismiss a report, or pause the reported listing/tour so it leaves search.
create or replace function public.resolve_report(p_report_id uuid, p_pause boolean)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  r public.reports;
begin
  if not public.is_admin() then
    raise exception 'Admins only.';
  end if;

  select * into r from public.reports where id = p_report_id and status = 'open';
  if not found then
    raise exception 'This report has already been handled.';
  end if;

  if p_pause then
    if r.target_type = 'listing' then
      update public.listings set status = 'paused' where id = r.target_id;
    else
      update public.tours set status = 'paused' where id = r.target_id;
    end if;
  end if;

  -- Close this and any other open reports about the same thing.
  update public.reports
     set status = case when p_pause then 'actioned' else 'dismissed' end
   where target_id = r.target_id and status = 'open';
end;
$$;

revoke execute on function public.submit_verification(text, text, text) from public, anon;
revoke execute on function public.admin_verifications() from public, anon;
revoke execute on function public.review_verification(uuid, boolean, text) from public, anon;
revoke execute on function public.submit_report(text, uuid, text, text) from public, anon;
revoke execute on function public.admin_reports() from public, anon;
revoke execute on function public.resolve_report(uuid, boolean) from public, anon;
grant execute on function public.submit_verification(text, text, text) to authenticated;
grant execute on function public.admin_verifications() to authenticated;
grant execute on function public.review_verification(uuid, boolean, text) to authenticated;
grant execute on function public.submit_report(text, uuid, text, text) to authenticated;
grant execute on function public.admin_reports() to authenticated;
grant execute on function public.resolve_report(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Admin dashboard counts (replaces the version from 011)
-- ---------------------------------------------------------------------------
create or replace function public.admin_stats()
returns json
language plpgsql
stable
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only.';
  end if;

  return json_build_object(
    'users',            (select count(*) from public.profiles),
    'travelers',        (select count(*) from public.profiles where role = 'traveler'),
    'hosts',            (select count(*) from public.profiles where role = 'host'),
    'guides',           (select count(*) from public.profiles where role = 'guide'),
    'admins',           (select count(*) from public.profiles where role = 'admin'),
    'verified_users',   (select count(*) from public.profiles where verified),
    'new_users_7d',     (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'active_24h',       (select count(*) from public.profiles where last_seen_at > now() - interval '24 hours'),
    'active_7d',        (select count(*) from public.profiles where last_seen_at > now() - interval '7 days'),
    'listings',         (select count(*) from public.listings),
    'active_listings',  (select count(*) from public.listings where status = 'active'),
    'tours',            (select count(*) from public.tours where status = 'active'),
    'tour_bookings',    (select count(*) from public.tour_bookings),
    'bookings',         (select count(*) from public.bookings),
    'pending_bookings', (select count(*) from public.bookings where status = 'pending'),
    'paid_bookings',    (select count(*) from public.bookings where payment_status = 'paid'),
    'revenue',          (select coalesce(sum(total), 0) from public.bookings where payment_status = 'paid'),
    'platform_fees',    (select coalesce(sum(service_fee), 0) from public.bookings where payment_status = 'paid'),
    'reviews',          (select count(*) from public.reviews),
    'avg_rating',       (select round(avg(rating)::numeric, 1) from public.reviews),
    'open_reports',     (select count(*) from public.reports where status = 'open'),
    'pending_verifications', (select count(*) from public.verification_requests where status = 'pending'),
    'signups_14d', (
      select json_agg(json_build_object('day', d::date, 'count', (
        select count(*) from public.profiles p where p.created_at::date = d::date
      )) order by d)
      from generate_series(current_date - 13, current_date, interval '1 day') d
    )
  );
end;
$$;



