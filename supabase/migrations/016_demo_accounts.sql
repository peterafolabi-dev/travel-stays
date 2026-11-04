-- 016: shared demo accounts for recruiters and reviewers
--
-- The app's "Try a demo account" buttons log into a few throwaway accounts.
-- Anyone can use them, so the database must stop a visitor from deleting them.
-- The list lives in its own table with RLS on and no policies, so only the
-- server (security definer functions, the dashboard) can read or change it.
-- A profile flag would not work: users can edit their own profile.
--
-- After creating the demo users in Supabase → Authentication → Users, run:
--   insert into public.demo_accounts (user_id)
--   select id from auth.users where email in ('demo.traveller@…', 'demo.host@…', 'demo.guide@…');

create table if not exists public.demo_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.demo_accounts enable row level security;
revoke all on public.demo_accounts from anon, authenticated;

-- Same as 013's delete_my_account, plus one check at the top.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Please log in first.';
  end if;

  if exists (select 1 from public.demo_accounts where user_id = uid) then
    raise exception 'This is a shared demo account, so it can''t be deleted.';
  end if;

  if exists (
    select 1 from public.bookings
     where (traveler_id = uid or host_id = uid)
       and status in ('pending', 'confirmed') and check_out >= current_date
    union all
    select 1 from public.tour_bookings
     where (traveler_id = uid or guide_id = uid)
       and status in ('pending', 'confirmed') and tour_date >= current_date
  ) then
    raise exception 'You have stays or tours coming up. Cancel or finish them first, then you can delete your account.';
  end if;

  delete from auth.users where id = uid;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
