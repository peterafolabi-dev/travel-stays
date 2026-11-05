-- 017: sensible listing limits and fairer booking holds
--
-- Found while testing the live site as a traveller:
--   1. A listing could claim 5,000,000 guests and 500,000 bedrooms, because the
--      database only checked the lower bounds.
--   2. Booking dates you had already booked yourself said "booked by someone
--      else", which is confusing.
--   3. A pending request holds the dates until the host answers, so one account
--      could hold dates across many listings without ever paying. Each traveller
--      may now hold at most 3 unpaid stays at a time.
--   4. Stays could be booked any number of years ahead; tours already stop at
--      6 months, stays now stop at 12.
--   5. The same traveller could book the same tour on the same date twice.
--
-- Safe to run more than once.

-- ---------------------------------------------------------------------------
-- 1. Upper limits on listings
-- ---------------------------------------------------------------------------
-- NOT VALID: existing rows are left alone (fix or pause them from the admin
-- page), but every new or edited listing must pass.
alter table public.listings drop constraint if exists listings_max_guests_range;
alter table public.listings add constraint listings_max_guests_range
  check (max_guests between 1 and 50) not valid;

alter table public.listings drop constraint if exists listings_bedrooms_range;
alter table public.listings add constraint listings_bedrooms_range
  check (bedrooms between 0 and 30) not valid;

alter table public.listings drop constraint if exists listings_price_range;
alter table public.listings add constraint listings_price_range
  check (price_per_night between 1 and 10000000) not valid;

alter table public.listings drop constraint if exists listings_cleaning_fee_range;
alter table public.listings add constraint listings_cleaning_fee_range
  check (cleaning_fee between 0 and 1000000) not valid;

-- ---------------------------------------------------------------------------
-- 2-4. create_booking (same as 008, with the new checks marked NEW)
-- ---------------------------------------------------------------------------
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
  if p_check_in > current_date + 365 then -- NEW
    raise exception 'Stays can be booked up to 12 months ahead.';
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

  -- NEW: a clear message when the clash is with your own booking.
  if exists (
    select 1 from public.bookings x
     where x.listing_id = l.id
       and x.traveler_id = auth.uid()
       and x.status in ('pending', 'confirmed')
       and daterange(x.check_in, x.check_out, '[)') && daterange(p_check_in, p_check_out, '[)')
  ) then
    raise exception 'You already have a booking here for some of these dates. Check My trips.';
  end if;

  -- NEW: at most 3 unpaid holds per traveller, so nobody can block dates
  -- across the site without paying.
  if (
    select count(*) from public.bookings x
     where x.traveler_id = auth.uid()
       and x.status in ('pending', 'confirmed')
       and x.payment_status = 'unpaid'
       and x.check_out > current_date
  ) >= 3 then
    raise exception 'You have 3 unpaid bookings already. Pay for or cancel one in My trips before booking another.';
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

revoke execute on function public.create_booking(uuid, date, date, integer) from public, anon;
grant execute on function public.create_booking(uuid, date, date, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. create_tour_booking (same as 011, with the new checks marked NEW)
-- ---------------------------------------------------------------------------
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
  if p_people < 1 then -- NEW: its own message
    raise exception 'Book for at least 1 person.';
  end if;
  if p_people > t.max_group then
    raise exception 'This tour takes up to % people.', t.max_group;
  end if;

  -- NEW: one booking per traveller per tour date (change the group size instead).
  if exists (
    select 1 from public.tour_bookings x
     where x.tour_id = t.id and x.tour_date = p_date
       and x.traveler_id = auth.uid() and x.status in ('pending', 'confirmed')
  ) then
    raise exception 'You''ve already booked this tour for that date. Check My trips.';
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

revoke execute on function public.create_tour_booking(uuid, date, integer) from public, anon;
grant execute on function public.create_tour_booking(uuid, date, integer) to authenticated;
