-- 015 — Cancellations follow the listing's policy: before cancelling, the
-- guest sees exactly what they get back; refunds are recorded for the admin.
-- Run once in Supabase → SQL Editor, after 014. Safe to re-run.
--
-- Rules (times are counted to the listing's check-in time, Nigeria time):
--   Not paid yet ............ free to cancel, nothing was charged
--   Flexible ................ 24h+ before: all nights back · later: first night kept
--   Moderate ................ 5 days+ before: all nights back · later: 50% of nights back
--   Strict .................. 7 days+ before: 50% of nights back · later: no nights back
--   Always (when paid) ...... service fee is non-refundable; cleaning fee is refunded
--   On/after check-in day ... can't cancel online

-- ---------------------------------------------------------------------------
-- 1. Refund details on bookings
-- ---------------------------------------------------------------------------
alter table public.bookings
  add column if not exists refund_amount integer check (refund_amount is null or refund_amount >= 0), -- naira
  add column if not exists cancelled_at timestamptz;

alter table public.bookings drop constraint if exists bookings_payment_status_check;
alter table public.bookings add constraint bookings_payment_status_check
  check (payment_status in ('unpaid', 'paid', 'refund_pending', 'refunded'));

-- ---------------------------------------------------------------------------
-- 2. What would I get back if I cancelled now?
-- ---------------------------------------------------------------------------
create or replace function public.cancellation_quote(p_booking_id uuid)
returns json
language plpgsql
stable
security definer set search_path = public
as $$
declare
  b public.bookings;
  l public.listings;
  hours numeric;
  nightly integer;
  nights_back integer := 0;
  cleaning_back integer := 0;
  paid boolean;
  policy text;
  rule text;
begin
  select * into b from public.bookings where id = p_booking_id and traveler_id = auth.uid();
  if not found then
    raise exception 'Booking not found.';
  end if;
  select * into l from public.listings where id = b.listing_id;

  policy := coalesce(l.cancellation_policy, 'moderate');
  hours := extract(epoch from (
             ((b.check_in + coalesce(l.check_in_time, '14:00')::time) at time zone 'Africa/Lagos') - now()
           )) / 3600;
  paid := b.payment_status = 'paid';
  nightly := b.price_per_night * b.nights;

  if not paid then
    rule := 'You haven’t paid yet, so cancelling is free — nothing was charged.';
  else
    cleaning_back := b.cleaning_fee; -- the place was never cleaned for you
    if policy = 'flexible' then
      if hours >= 24 then
        nights_back := nightly;
        rule := 'Flexible policy: you’re cancelling at least 24 hours before check-in, so the nightly cost is refunded in full.';
      else
        nights_back := nightly - b.price_per_night;
        rule := 'Flexible policy: it’s less than 24 hours before check-in, so the first night is non-refundable.';
      end if;
    elsif policy = 'strict' then
      if hours >= 7 * 24 then
        nights_back := round(nightly * 0.5);
        rule := 'Strict policy: you’re cancelling at least 7 days before check-in, so 50% of the nightly cost is refunded.';
      else
        nights_back := 0;
        rule := 'Strict policy: it’s less than 7 days before check-in, so the nightly cost is non-refundable.';
      end if;
    else -- moderate
      if hours >= 5 * 24 then
        nights_back := nightly;
        rule := 'Moderate policy: you’re cancelling at least 5 days before check-in, so the nightly cost is refunded in full.';
      else
        nights_back := round(nightly * 0.5);
        rule := 'Moderate policy: it’s less than 5 days before check-in, so 50% of the nightly cost is refunded.';
      end if;
    end if;
  end if;

  return json_build_object(
    'can_cancel',       b.status in ('pending', 'confirmed') and b.check_in > current_date,
    'paid',             paid,
    'policy',           policy,
    'hours_until',      greatest(round(hours), 0),
    'total_paid',       case when paid then b.total else 0 end,
    'nights_refund',    nights_back,
    'cleaning_refund',  cleaning_back,
    'nights_kept',      case when paid then nightly - nights_back else 0 end,
    'service_fee_kept', case when paid then b.service_fee else 0 end,
    'refund',           nights_back + cleaning_back,
    'rule',             rule
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Cancel (replaces the version from 003): same rules, refund recorded
-- ---------------------------------------------------------------------------
create or replace function public.cancel_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer set search_path = public
as $$
declare
  q json;
  refund integer;
  b public.bookings;
begin
  q := public.cancellation_quote(p_booking_id);
  if not (q ->> 'can_cancel')::boolean then
    raise exception 'This booking can no longer be cancelled online. If your stay has started, please contact support.';
  end if;
  refund := (q ->> 'refund')::integer;

  update public.bookings
     set status = 'cancelled',
         cancelled_at = now(),
         refund_amount = case when payment_status = 'paid' then refund end,
         payment_status = case when payment_status = 'paid' and refund > 0 then 'refund_pending' else payment_status end
   where id = p_booking_id and traveler_id = auth.uid()
  returning * into b;

  return b;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Admin: refunds to send (sent by hand from the Paystack dashboard)
-- ---------------------------------------------------------------------------
create or replace function public.admin_refunds()
returns table (
  booking_id uuid, guest_name text, guest_email text, listing_title text,
  refund_amount integer, total integer, payment_reference text, cancelled_at timestamptz
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
    select b.id, p.full_name, u.email::text, l.title, b.refund_amount, b.total, b.payment_reference, b.cancelled_at
      from public.bookings b
      join public.profiles p on p.id = b.traveler_id
      join auth.users u on u.id = b.traveler_id
      left join public.listings l on l.id = b.listing_id
     where b.payment_status = 'refund_pending'
     order by b.cancelled_at;
end;
$$;

create or replace function public.mark_refunded(p_booking_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only.';
  end if;
  update public.bookings set payment_status = 'refunded'
   where id = p_booking_id and payment_status = 'refund_pending';
end;
$$;

revoke execute on function public.cancellation_quote(uuid) from public, anon;
revoke execute on function public.admin_refunds() from public, anon;
revoke execute on function public.mark_refunded(uuid) from public, anon;
grant execute on function public.cancellation_quote(uuid) to authenticated;
grant execute on function public.admin_refunds() to authenticated;
grant execute on function public.mark_refunded(uuid) to authenticated;
