# Demo guide

**Live site:** https://travel-stays.vercel.app

## One-click demo accounts (for recruiters)

The login page shows **Try a demo account: Traveller · Host · Tour guide**. One click logs in, and a banner shows the Paystack test card. The buttons only appear once these steps are done:

1. In Supabase → **Authentication → Users → Add user**, create three throwaway users (tick *Auto confirm*), e.g. `demo.traveller@…`, `demo.host@…`, `demo.guide@…`, each with its own password. Never use a real person's account here: these logins are public.
2. Sign in once as the host and the guide and give them a listing and a tour, so there is something to see.
3. Run `supabase/migrations/016_demo_accounts.sql`, then the `insert into public.demo_accounts …` line from its header comment with the three emails. From then on the database refuses to delete those accounts.
4. In Vercel → Project → **Settings → Environment Variables**, add `VITE_DEMO_TRAVELLER_EMAIL`, `VITE_DEMO_TRAVELLER_PASSWORD`, and the same for `HOST` and `GUIDE`, then redeploy.

## Personal test accounts

| Role | Email | Password |
|---|---|---|
| Admin | peter.m2300470@st.futminna.edu.ng | *given separately* |
| Host | afolabiprosper329@gmail.com | *given separately* |
| Traveller | afolabiprosper061@gmail.com | *given separately* |
| Tour guide | anyhow680@gmail.com | *given separately* |

> Passwords are not stored in this repository, because it is public. They are provided with the submission.
> Assessors can also create their own traveller or host account on the Sign up page.

## Test payments (Paystack test mode)

No real money is charged. When the Paystack window opens:
1. Pick the **card** option.
2. Choose **Success** to simulate a successful payment, or **Declined** to see the failure message.
3. If asked for card details, use Paystack's test card: `4084 0840 8408 4081`, any future expiry date, CVV `408`, PIN `0000`, OTP `123456`.

---

## Demo script (about 8 minutes)

Use two browser windows. **Window A** is a normal window for the host and the admin. **Window B** is an incognito window for the traveller.

### 1. Landing page (30 seconds)
- Open the home page. Point out the hero video, the search bar and the Stays / Tours / Trips tabs.
- Search **Calabar**. The results show stays in Calabar only.

### 2. Traveller books a stay (2 minutes, window B)
- Log in as the **traveller**.
- Open a listing and show the gallery, amenities, house rules, cancellation policy and reviews.
- Pick dates and guests, and point out the price breakdown (nights + cleaning fee + 10% service fee).
- Click **Request to book** (or **Instant Book** on stays that allow it).
- Open **My trips**: the booking shows **Awaiting host**.

### 3. Host accepts (1 minute, window A)
- Log in as the **host** and open **My listings**.
- Show the stats and the incoming request, then click **Accept**.
- Optional: open a listing's **calendar** and block some dates. Those dates can no longer be booked.

### 4. Traveller pays (1 minute, window B)
- Refresh **My trips**. The booking is now **Confirmed**, with **Payment due**.
- Click **Pay now**, then choose **Success** in the Paystack window.
- The booking changes to **Paid**. The payment is checked on the server before it's marked as paid.

### 5. Reviews (1 minute, window B)
- Open a trip under **Past**. These are stays that have ended.
- Leave a star rating and a comment. It appears on the listing page and updates the listing's average rating.

### 5b. Tours (1 minute)
- Open the **Tours** tab on the Stays page and filter by **Food tours**. Open the **Calabar Food Walk**.
- Show the itinerary, meeting point and guide card. Pick a date, then click **Request to book**. Note that days the tour doesn't run are rejected.
- Log in as the **guide** and open **My tours**: accept the request. The traveller sees it as **Confirmed** under **My trips → Tours**.
- Open the **Trips** tab for Calabar: it shows stays and tours together.

### 6. Admin dashboard (1.5 minutes, window A)
- Log out (this shows the logged-out page), then log in as the **admin** and click **Dashboard**.
- **Online now** lists the traveller from window B, and which page they're on. Click around in window B and watch it update live.
- Show active users, sign-ups, bookings, revenue, platform fees and the user list.

### 6b. Trust and safety (1 minute)
- As the **host** or **guide**, open **Profile → Identity verification** and upload an ID photo and a selfie.
- As the **admin**, open the dashboard. Under **ID verification**, click **ID** or **Selfie** to view the documents, then click **Approve**. The **Verified** badge now appears on that person's listings and tours.
- As the **traveller**, click **Report** on a listing and choose a reason. It appears under **Reports** on the admin dashboard, where you can dismiss it or **Pause** the listing.
- Show the **Trust & safety** page (link in the footer).

### 7. Security extras (30 seconds)
- Show **Continue with Google** on the log-in page.
- Mention the automatic logout after 30 minutes of inactivity, with a one-minute warning.
- While logged out, try opening `/admin` or `/host/listings`: the site sends you to the log-in page.

---

## Before the demo: checklist
- [ ] The host account has listings (run `supabase/demo/seed_listings.sql` with the host's email).
- [ ] The guide account has tours (run `supabase/demo/seed_tours.sql` with the guide's email).
- [ ] The traveller has a finished stay to review (run `supabase/demo/past_booking.sql` with the traveller's email).
- [ ] All four accounts can log in.
- [ ] The latest code is pushed to GitHub, and Vercel shows the deployment as **Ready**.
