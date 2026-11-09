-- 019: unpaid bookings no longer hold dates forever
--
-- Until now a booking request (or an accepted booking that was never paid)
-- blocked its dates until someone cancelled it. 017 capped each traveller at
-- three unpaid holds, but a hold never expired. This adds
-- expire_stale_bookings(), which cancels stays that are still unpaid a fixed
-- time after they were requested, so the dates open up again. Paid bookings
-- are never touched.
--
-- Run once in Supabase -> SQL Editor. Safe to run more than once.
-- To run it automatically, enable the pg_cron extension (Database -> Extensions);
-- this file then schedules it hourly. Without pg_cron you can call it by hand:
--   select public.expire_stale_bookings();

create or replace function public.expire_stale_bookings(p_hours integer default 72)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  n integer;
begin
  if p_hours is null or p_hours < 1 then
    raise exception 'p_hours must be at least 1';
  end if;

  update public.bookings
     set status = 'cancelled',
         cancelled_at = now()
   where status in ('pending', 'confirmed')
     and payment_status = 'unpaid'
     and created_at < now() - make_interval(hours => p_hours)
     -- never cancel under someone who is paying right now (a payment attempt in the last hour)
     and not exists (
       select 1 from public.payments p
        where p.booking_id = public.bookings.id
          and p.status = 'pending'
          and p.created_at > now() - interval '1 hour'
     );

  get diagnostics n = row_count;
  return n;
end;
$$;

-- Only the server (or the cron job) may run it, never a browser.
revoke execute on function public.expire_stale_bookings(integer) from public, anon, authenticated;
grant execute on function public.expire_stale_bookings(integer) to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'expire-stale-bookings';
    perform cron.schedule('expire-stale-bookings', '7 * * * *', 'select public.expire_stale_bookings();');
  else
    raise notice 'pg_cron is not enabled: call select public.expire_stale_bookings(); by hand or enable the extension and run this file again.';
  end if;
end $$;
