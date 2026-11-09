# Case study: Travel & Stays

**A two-sided booking marketplace for Nigeria, built during my MALhub internship (Aug–Oct 2026).**
Live: [travel-stays.vercel.app](https://travel-stays.vercel.app) · Code: this repo · Author: [Afolabi Peter](https://www.linkedin.com/in/afolabipeter-dev)

---

## The problem

Travellers in Nigeria book short stays mostly through WhatsApp and Instagram. They send money to a stranger and hope the apartment exists. Hosts have the opposite problem: no easy way to show they are legitimate, take payment in naira, or stop two people booking the same weekend.

The brief was a marketplace with three kinds of users (travellers, hosts and tour guides) where **money, dates and identity can be trusted**.

## What I built

- Search stays by city, dates and guests across all 36 states and the FCT, plus local tours
- Booking with a 10% service fee, host accept/decline or instant booking, and an availability calendar
- Paystack payments in naira (card, bank transfer, USSD), in test mode
- ID and selfie verification for hosts and guides, reviewed by an admin before the **Verified** badge appears
- Cancellation policies (flexible, moderate, strict) that quote the guest an exact refund before they cancel
- An admin dashboard with live "online now", sign-ups and revenue

## How it fits together

```mermaid
flowchart LR
    subgraph Browser
      UI[React 19 app<br/>Vite · Tailwind]
      PS[Paystack popup<br/>public key only]
    end

    subgraph Supabase
      AUTH[Auth<br/>email + Google]
      RPC[SQL functions<br/>create_booking · start_payment<br/>cancel_booking]
      DB[(Postgres<br/>row-level security)]
      EF[Edge Function<br/>verify-payment<br/>holds secret key]
      ST[Private storage<br/>ID documents]
    end

    PAY[Paystack API]

    UI --> AUTH
    UI -- "book / pay / cancel" --> RPC --> DB
    UI --> PS --> PAY
    UI -- "reference" --> EF
    EF -- "verify reference" --> PAY
    EF -- "mark paid" --> DB
    UI -- "upload ID" --> ST
```

The browser never writes bookings or payments directly. It calls SQL functions that run the rules on the server, and the only thing that can mark a booking paid is the Edge Function.

## A booking, step by step

```mermaid
sequenceDiagram
    actor G as Guest
    participant A as React app
    participant DB as Postgres (SQL functions)
    participant P as Paystack
    participant E as verify-payment

    G->>A: Pick dates, click Book
    A->>DB: create_booking(listing, dates, guests)
    Note over DB: Price worked out here from the listing,<br/>not from the browser.<br/>Overlap constraint rejects clashing dates.
    DB-->>A: booking (total in naira)
    G->>A: Pay
    A->>DB: start_payment(booking)
    DB-->>A: reference + amount in kobo
    A->>P: Open popup with reference
    P-->>A: "success" (not trusted yet)
    A->>E: verify(reference)
    E->>P: GET /transaction/verify/{reference}
    P-->>E: status, amount, currency
    Note over E: judgePayment(): success AND exact amount AND NGN
    E->>DB: payment = success, booking = paid
    E-->>A: confirmed
```

## The hard parts

### 1. Two guests, same weekend, same second
A check like "is the date free?" followed by an insert has a race: two requests can both see the dates free and both insert. I moved the guarantee into Postgres with an **exclusion constraint**:

```sql
constraint bookings_no_overlap exclude using gist (
  listing_id with =,
  daterange(check_in, check_out, '[)') with &&
) where (status in ('pending', 'confirmed'))
```

`'[)'` means check-out day is free for the next guest, and cancelled or declined bookings don't block anyone. The date picker greys out booked days for convenience, but the database is what makes a double booking impossible.

### 2. "The popup said success" is not proof
The Paystack popup runs in the browser, so anyone can fake its result. The `verify-payment` Edge Function asks Paystack directly, using a secret key that never leaves the server, and only accepts the payment if **all** of these hold: the request succeeded, Paystack says the transaction succeeded, the amount matches what the server priced **to the kobo**, and the currency is NGN.

That decision is a pure function (`supabase/functions/verify-payment/verify.ts`) with 11 unit tests that run in CI, including underpayment by one kobo, overpayment, wrong currency, abandoned popups, unknown references and malformed responses.

### 3. Prices come from the server
`create_booking` reads the nightly price and cleaning fee from the listing and computes nights, service fee and total in SQL. `start_payment` then charges exactly that total. A guest editing the page can change what they *see*, not what they *pay*.

### 4. Users can only touch their own rows
Every table has row-level security policies, and writes go through `security definer` functions that check `auth.uid()`. The rules hold even if someone skips the app and calls the Supabase API directly.

### 5. Trust before visibility
ID documents go to a private bucket that only admins can read. A host's listings show **Verified** only after an admin approves them, and any listing can be reported and paused immediately.

## Results

- Live on Vercel, with demo data scripts covering stays in all 36 states and the FCT, plus tours
- CI on every push: ESLint, production build, the payment tests, and a **database job that builds a fresh Postgres 16 from the real migrations** and checks that:
  - overlapping nights are refused and the check-out day stays free (the exclusion constraint),
  - 8 sessions booking the same dates at the same instant produce exactly one booking,
  - the price is worked out by the server, travellers see only their own rows and cannot write bookings or payments directly,
  - unpaid holds expire without touching paid bookings or one being paid right now
- The payment decision is a pure function covered by 11 unit tests, and the webhook signature check by 8 more
- Shipped through Git workflows and code reviews with the MALhub engineering team

## Known limits

- **Hold expiry and the Paystack webhook are written and tested but need switching on:** run `019_expire_unpaid_holds.sql` in the Supabase SQL editor (and enable pg_cron for the hourly schedule), and deploy `paystack-webhook` with `--no-verify-jwt`, then add its URL in the Paystack dashboard. Until then, a guest who closes the tab right after paying is only confirmed if verify-payment ran.
- Each traveller was already limited to 3 unpaid holds (migration 017), but a hold never expired before 019.
- If a guest pays after their unpaid booking has been expired, the money is recorded but the booking is cancelled; an admin has to refund it. (Expiry skips any booking with a payment attempt in the last hour to make this rare.)
- Payments run in Paystack test mode. Host payouts are not held until check-in, and refunds are recorded for an admin to process by hand.

## What I'd do next

- Hold host payouts until check-in using Paystack split payments and subaccounts
- Run the database tests against the Supabase CLI's local stack (real auth and storage) instead of the small stand-ins in `supabase/tests/prelude.sql`
- Row-level-security tests for the tours tables as well as stays
