-- 018: email alerts for bookings (free, via Brevo)
--
-- Hosts and guides used to see a new booking only when they opened the site.
-- Now the database emails them the moment a stay or tour is booked, and emails
-- the traveller when a request is accepted or declined.
--
-- Uses Brevo's free plan (300 emails a day) through pg_net, so no server or
-- Edge Function is needed. Nothing is sent until you add two secrets:
--
--   Supabase → Project Settings → Vault → Add new secret
--     name: brevo_api_key     value: your Brevo API key (Brevo → SMTP & API → API keys)
--     name: brevo_sender      value: a sender email you verified in Brevo (Senders & IP)
--
-- If either secret is missing, or Brevo is down, bookings still work: the email
-- is skipped, never the booking. Safe to run more than once.

create extension if not exists pg_net;

-- ---------------------------------------------------------------------------
-- Send one email through Brevo. Fire-and-forget: pg_net queues the request.
-- ---------------------------------------------------------------------------
create or replace function public.send_email(p_to uuid, p_subject text, p_html text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  api_key text;
  sender  text;
  to_email text;
  to_name  text;
begin
  select decrypted_secret into api_key from vault.decrypted_secrets where name = 'brevo_api_key';
  select decrypted_secret into sender  from vault.decrypted_secrets where name = 'brevo_sender';
  if api_key is null or sender is null then
    return; -- email not set up yet
  end if;

  select u.email, coalesce(nullif(p.full_name, ''), split_part(u.email, '@', 1))
    into to_email, to_name
    from auth.users u left join public.profiles p on p.id = u.id
   where u.id = p_to;
  if to_email is null then
    return;
  end if;

  perform net.http_post(
    url := 'https://api.brevo.com/v3/smtp/email',
    headers := jsonb_build_object('api-key', api_key, 'content-type', 'application/json', 'accept', 'application/json'),
    body := jsonb_build_object(
      'sender', jsonb_build_object('email', sender, 'name', 'Travel & Stays'),
      'to', jsonb_build_array(jsonb_build_object('email', to_email, 'name', to_name)),
      'subject', p_subject,
      'htmlContent', p_html
    )
  );
exception when others then
  -- An email problem must never block a booking.
  raise warning 'send_email failed: %', sqlerrm;
end;
$$;

revoke execute on function public.send_email(uuid, text, text) from public, anon, authenticated;

-- Escapes text that guests or hosts typed before it goes into an email.
create or replace function public.html_escape(t text)
returns text
language sql immutable
as $$ select replace(replace(replace(coalesce(t, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;') $$;

-- Shared email layout.
create or replace function public.email_body(p_heading text, p_lines text, p_button_text text, p_link text)
returns text
language sql immutable
as $$
  select '<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#1c1917">'
      || '<p style="color:#047857;font-weight:bold;margin:0 0 16px">Travel &amp; Stays</p>'
      || '<h2 style="margin:0 0 12px">' || p_heading || '</h2>'
      || p_lines
      || '<p style="margin:24px 0"><a href="' || p_link || '" style="background:#065f46;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none">'
      || p_button_text || '</a></p>'
      || '<p style="color:#78716c;font-size:12px">You got this email because you have an account on travel-stays.vercel.app.</p>'
      || '</div>'
$$;

-- ---------------------------------------------------------------------------
-- Stays
-- ---------------------------------------------------------------------------
create or replace function public.notify_booking()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  title text;
  guest text;
  dates text;
begin
  select l.title into title from public.listings l where l.id = new.listing_id;
  select coalesce(nullif(full_name, ''), 'A guest') into guest from public.profiles where id = new.traveler_id;
  dates := to_char(new.check_in, 'Dy DD Mon YYYY') || ' to ' || to_char(new.check_out, 'Dy DD Mon YYYY');

  if tg_op = 'INSERT' then
    perform public.send_email(
      new.host_id,
      case when new.status = 'pending' then 'New booking request: ' else 'New booking: ' end || title,
      public.email_body(
        case when new.status = 'pending' then 'You have a new booking request' else 'You have a new booking' end,
        '<p><b>' || public.html_escape(guest) || '</b> wants to stay at <b>' || public.html_escape(title) || '</b>.</p>'
          || '<p>' || dates || ' · ' || new.guests || ' guest(s) · ' || new.nights || ' night(s)</p>'
          || case when new.status = 'pending'
                  then '<p>The dates are held for you. Please accept or decline soon so the guest can plan.</p>'
                  else '<p>This was an Instant Book, so it is already confirmed.</p>' end,
        case when new.status = 'pending' then 'Accept or decline' else 'View booking' end,
        'https://travel-stays.vercel.app/host/listings'
      )
    );
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status in ('confirmed', 'declined') then
    perform public.send_email(
      new.traveler_id,
      case when new.status = 'confirmed' then 'Your stay is confirmed: ' else 'Your request was declined: ' end || title,
      public.email_body(
        case when new.status = 'confirmed' then 'Good news, the host accepted!' else 'The host couldn''t accept this time' end,
        '<p><b>' || public.html_escape(title) || '</b> · ' || dates || '</p>'
          || case when new.status = 'confirmed'
                  then '<p>Pay from My trips to lock in your stay.</p>'
                  else '<p>Your dates have been released. There are plenty of other places to stay.</p>' end,
        case when new.status = 'confirmed' then 'Pay now' else 'Find another stay' end,
        case when new.status = 'confirmed' then 'https://travel-stays.vercel.app/trips/' || new.id
             else 'https://travel-stays.vercel.app/stays' end
      )
    );
  end if;
  return new;
exception when others then
  raise warning 'notify_booking failed: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists bookings_notify on public.bookings;
create trigger bookings_notify
  after insert or update of status on public.bookings
  for each row execute function public.notify_booking();

-- ---------------------------------------------------------------------------
-- Tours
-- ---------------------------------------------------------------------------
create or replace function public.notify_tour_booking()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  title text;
  guest text;
  day   text;
begin
  select t.title into title from public.tours t where t.id = new.tour_id;
  select coalesce(nullif(full_name, ''), 'A traveller') into guest from public.profiles where id = new.traveler_id;
  day := to_char(new.tour_date, 'Dy DD Mon YYYY');

  if tg_op = 'INSERT' then
    perform public.send_email(
      new.guide_id,
      'New tour booking: ' || title,
      public.email_body(
        'Someone booked your tour',
        '<p><b>' || public.html_escape(guest) || '</b> booked <b>' || public.html_escape(title) || '</b>.</p>'
          || '<p>' || day || ' · ' || new.people || ' people</p>',
        'Open my tours',
        'https://travel-stays.vercel.app/guide/tours'
      )
    );
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status in ('confirmed', 'declined') then
    perform public.send_email(
      new.traveler_id,
      case when new.status = 'confirmed' then 'Your tour is confirmed: ' else 'Your tour request was declined: ' end || title,
      public.email_body(
        case when new.status = 'confirmed' then 'Your guide accepted!' else 'The guide couldn''t take this booking' end,
        '<p><b>' || public.html_escape(title) || '</b> · ' || day || '</p>',
        'Open My trips',
        'https://travel-stays.vercel.app/trips'
      )
    );
  end if;
  return new;
exception when others then
  raise warning 'notify_tour_booking failed: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists tour_bookings_notify on public.tour_bookings;
create trigger tour_bookings_notify
  after insert or update of status on public.tour_bookings
  for each row execute function public.notify_tour_booking();
