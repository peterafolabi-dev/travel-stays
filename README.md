# Travel & Stays

[![CI](https://github.com/peterafolabi-dev/travel-stays/actions/workflows/ci.yml/badge.svg)](https://github.com/peterafolabi-dev/travel-stays/actions/workflows/ci.yml)
![React](https://img.shields.io/badge/React-19-61DAFB)
![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20RLS-3ECF8E)
![Paystack](https://img.shields.io/badge/Paystack-test%20mode-0BA4DB)

A two-sided marketplace for Nigeria where **travellers** find and book verified places to stay and local tours, **hosts** list and manage their properties, and **tour guides** list experiences. Payments go through Paystack, and an **admin dashboard** shows live platform activity.

**Live site:** https://travel-stays.vercel.app
**Built from:** the Travel & Stays Product Requirements Document (PRD)

![Travel & Stays](https://raw.githubusercontent.com/peterafolabi-dev/Retail-Logistics-Core/main/docs/portfolio/travel.jpg)

<!-- Uncomment once the demo accounts are set up (docs/DEMO-GUIDE.md):
**⚡ Try it in 30 seconds:** open the [login page](https://travel-stays.vercel.app/login) and click **Traveller**, **Host** or **Tour guide**. No sign-up, and payments use a Paystack test card.
-->

**📖 Read the [case study](docs/CASE_STUDY.md)**: the problem, architecture diagrams, a booking step by step, and the hard parts.

---

## Engineering decisions

The parts of a booking marketplace that go wrong in production, and how this one handles them:

- **Double bookings are impossible at the database level.** `bookings` has an exclusion constraint (`exclude using gist … daterange(check_in, check_out, '[)') with &&`), so two overlapping bookings for the same listing can't both be saved, even if two guests click "Book" in the same second. The UI date picker is a convenience, not the guarantee.
- **Payments are verified on the server, not trusted from the browser.** A Supabase Edge Function (`supabase/functions/verify-payment`) calls Paystack with the secret key and only marks a booking paid when the transaction succeeded **and** the amount and currency (NGN) match what the server expected. A tampered client can't pay ₦100 for a ₦100,000 stay. That decision lives in a small pure function (`verify.ts`) with 11 unit tests covering underpayment by one kobo, overpayment, wrong currency, abandoned popups, unknown references and malformed responses.
- **The secret key never reaches the browser.** The client only holds Paystack's public key; verification runs in the Edge Function.
- **Users can only touch their own data.** Every table uses Postgres row-level security policies, so the rules hold even if someone calls the Supabase API directly instead of using the app.
- **Trust is earned before listings go live.** Hosts and guides upload ID to a private storage bucket, and an admin approves them before the Verified badge appears.
- **CI on every push.** GitHub Actions lints the client, runs a production build and runs the payment tests.

---

## Features

### Travellers
- Search stays by city, dates and number of guests, and filter by property type
- Listing pages with a photo gallery, amenities, house rules, cancellation policy, reviews and similar stays
- Book with a date picker that blocks unavailable dates; the price breakdown shows nights, cleaning fee and a 10% service fee
- Pay securely with **Paystack** (test mode), with server-side payment verification
- **My trips**: upcoming, past and cancelled bookings with their status and payment state
- **Reviews**: rate and review a stay after check-out (one review per booking)
- **Saved**: a wishlist of stays
- Profile page with personal details and password change

### Hosts
- Create, edit, pause and delete listings, with photo upload
- Accept or decline booking requests, or allow instant booking
- **Availability calendar**: block dates when the place isn't available
- Reply publicly to reviews

### Tour guides
- Create tours with an itinerary, duration, start time, meeting point, maximum group size, price per person, what's included, languages, the days it runs, and photos
- Accept or decline booking requests from the **My tours** dashboard
- See upcoming departures, the number of guests coming, and confirmed earnings
- Travellers browse tours by city and category (food, adventure, culture, nature), pick a date and number of people, and request a place
- The **Trips** tab shows a city's stays and tours together

### Admins
- **Dashboard** at `/admin`:
  - **Online now**: logged-in users with the site open (live)
  - **Active users** in the last 24 hours and 7 days
  - Sign-ups over the last 14 days
  - Totals for users by role, listings, bookings, revenue, platform fees and reviews
  - Searchable list of all users

### Trust and safety
- **ID verification:** hosts and guides upload a government ID and a selfie to a private storage bucket. An admin approves or rejects each request, and approval adds the **Verified** badge to the person's listings and tours.
- A **Report** button on every listing and tour. Admins review reports and can pause a listing or tour immediately.
- **Safety features on listings** (smoke alarm, first-aid kit, security…), with an indoor-camera notice
- **Share my trip** and an emergency (112) card on every upcoming booking
- Hosts and guides can **report a guest**; anyone can **delete their account**
- A **Trust & safety** page with travel tips and Nigeria's emergency number (112)

### Accounts and security
- Email/password sign-up with a choice of role (traveller, host or tour guide), plus **Continue with Google**
- Password reset by email
- Automatic logout after **30 minutes of inactivity**, with a one-minute warning
- A dedicated logged-out page
- Database security with Supabase **row-level security (RLS)**: users can only see and change their own data

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 8, React Router 7 |
| Styling and animation | Tailwind CSS 4, Motion, Lucide icons |
| Backend | Supabase: PostgreSQL, Auth, Storage, Realtime, Edge Functions |
| Payments | Paystack (test mode) |
| Hosting | Vercel (auto-deploys from GitHub) |

---

## Project structure

```
travel-stays/
├── client/                    React web app
│   ├── src/pages/             One file per page (Home, Stays, ListingDetail, Trips, Admin, …)
│   ├── src/components/        Reusable UI (Navbar, BookingWidget, ListingCard, …)
│   ├── src/context/           App-wide state: auth, toasts, saved stays, online presence
│   └── src/lib/               Data access (Supabase queries) and helpers
├── supabase/
│   ├── schema.sql             Base tables: profiles and listings
│   ├── migrations/            002–018, run in order
│   ├── functions/verify-payment/   Edge Function that confirms Paystack payments
│   └── demo/                  Optional demo data scripts
└── docs/                      Demo guide and "how it works" notes
```

---

## Running it locally

**You need:** Node.js 20 or newer, and a Supabase project.

1. **Install dependencies**
   ```bash
   cd client
   npm install
   ```
2. **Configure environment variables.** Copy `client/.env.example` to `client/.env` and fill in:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-or-publishable-key
   VITE_PAYSTACK_PUBLIC_KEY=pk_test_...
   ```
3. **Set up the database.** In Supabase, open **SQL Editor** and run `supabase/schema.sql`, then each file in `supabase/migrations/` in number order (002 to 018).
4. **Deploy the payment function** (optional, only needed for payments):
   - Deploy `supabase/functions/verify-payment`.
   - Add the secret `PAYSTACK_SECRET_KEY` under **Edge Functions → Secrets**.
5. **Start the app**
   ```bash
   npm run dev
   ```
   Then open http://localhost:5173.

**Optional demo data:**
- `supabase/demo/seed_listings.sql` adds stays in Calabar, Lagos, Abuja and more.
- `supabase/demo/seed_all_states.sql` adds one stay in each remaining state, so all 36 states and the FCT are covered.
- `supabase/demo/seed_tours.sql` adds tours: a Calabar food walk, Agbokim Waterfalls, Obudu, Yankari and more.
- `supabase/demo/past_booking.sql` creates a finished stay so a review can be left.

---

## More documentation
- [docs/DEMO-GUIDE.md](docs/DEMO-GUIDE.md): demo accounts, test payment details and a step-by-step demo script
- [docs/HOW-IT-WORKS.md](docs/HOW-IT-WORKS.md): how the key parts work (booking, payments, security, live presence)
- [docs/CODE-GUIDE.md](docs/CODE-GUIDE.md): a file-by-file walkthrough of the code, with each feature traced step by step
