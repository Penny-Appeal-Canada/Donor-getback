# Donor Recovery Dashboard

A Next.js app that pulls failed donation transactions from Stripe, shows them in a dashboard, lets your team reach out (email / call / text) with a fresh checkout link, and automatically tracks when a failed donation is recovered, including a running "total recovered" figure for any date range.

## How recovery detection works

A failed transaction is marked **RECOVERED** automatically when any of these happens, checked in order of confidence:

1. **Same PaymentIntent** - the original PaymentIntent is retried and eventually succeeds (`payment_intent.succeeded` arrives for a PI we already recorded as failed).
2. **Recovery link** - when you click "Email link" or "Text link", the app creates a brand new Checkout Session tagged with `metadata.recovery_of = <failed PI id>`. When that session's payment succeeds, the webhook reads the metadata and links the success back to the exact failure. This is the strongest attribution and the recommended primary path.
3. **Donor match (fallback)** - a new successful payment from the same donor (matched by Stripe Customer ID, or email as fallback) within 30 days of an open failure is treated as a recovery of the oldest open failure. This catches donors who ignore your link but go back to your donate page on their own.

The "Recovered in this period" total is a SQL `SUM` over `recoveredAmount` between your chosen dates, not an incrementing counter. Sums are idempotent: Stripe webhook retries, backfills, and re-runs can never double-count, and you can query any historical range at any time. A `WebhookEvent` table additionally dedupes Stripe event deliveries.

## Statuses

| Status | Meaning | Set by |
|---|---|---|
| NEW | Failed, nobody contacted yet | webhook / backfill |
| CONTACTED | Outreach sent or call logged | action buttons |
| RECOVERED | Donation completed | webhook (automatic) or manual override |
| CLOSED | Manually closed (declined / unreachable) | Close button or manual override |

Any status can also be set directly from the dropdown under each row's status badge - useful for correcting a mistaken auto-match or recording a donation that came in outside Stripe. Manually marking something RECOVERED prompts for an amount (since the recovered-total sum reads `recoveredAmount`, not just status) and is tagged `recoveryMethod: MANUAL`.

## Setup

1. Create a free [Neon](https://neon.tech) Postgres database and copy the connection string.
2. Configure env and push the schema:

```bash
npm install
cp .env.example .env        # fill in your keys, including DATABASE_URL from Neon
npx prisma db push          # creates tables in Postgres
npm run dev
```

### Stripe webhook (real-time)

The dashboard filters by the date range you pick. Stripe webhooks keep the
database up to date in real time; the page refreshes every 15 seconds so new
failures in that range appear without a manual reload.

**Production (permanent):** in the Stripe Dashboard → Developers → Webhooks,
add an endpoint:

`https://yourapp.com/api/webhooks/stripe`

Subscribe to:

- `payment_intent.payment_failed`
- `payment_intent.succeeded`
- `checkout.session.completed`
- `checkout.session.expired` (optional: also captures donors who opened checkout and abandoned it)

Copy the endpoint signing secret into `STRIPE_WEBHOOK_SECRET`.

**Local development:** Stripe cannot reach `localhost`, so use the CLI as a
temporary forwarder (not needed once the app is deployed with the Dashboard
webhook above):

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Copy the printed `whsec_...` into `STRIPE_WEBHOOK_SECRET` and restart `npm run dev`.

### Import history

Webhooks only see failures from the moment they're configured. Pull in past
failures (and replay past successes through the matcher):

```bash
npm run backfill -- 90    # last 90 days
```

## Actions

- **Email link** - creates a 24-hour Checkout Session for the same amount and emails it via Resend.
- **Call** - opens `tel:` on your device and logs the call.
- **Text link** - same checkout link, sent by SMS via Twilio.
- **Close** - stop pursuing a transaction.

Each action logs to `ContactLog` and flips status NEW → CONTACTED.

## Authentication

The dashboard is gated behind an allowlisted magic-link sign-in, since it exposes donor PII:

1. A staff member enters their email on `/login`.
2. If that address is in `ALLOWED_EMAILS`, a one-time sign-in link is emailed via Resend (valid 15 minutes, single use). The response is identical either way, so the endpoint can't be used to test which emails are on the team.
3. Clicking the link sets a signed, HttpOnly session cookie (30 days) and redirects to the dashboard.

`middleware.ts` enforces this on every route except `/login`, `/api/auth/*`, `/api/webhooks/*` (Stripe needs unauthenticated access), and `/thank-you` (a donor-facing page, not a staff page).

Env vars:

- `SESSION_SECRET` - long random string used to sign session cookies (e.g. `openssl rand -hex 32`).
- `ALLOWED_EMAILS` - comma-separated list of staff emails allowed to sign in.

In development, sign-in links are also printed to the server console so you can test without waiting on real email delivery.

## Going to production (Vercel)

1. Add the same env vars in Vercel (see `.env.example`), with:
   - `DATABASE_URL` = your Neon connection string
   - `APP_URL` = `https://your-app.vercel.app`
   - `STRIPE_WEBHOOK_SECRET` = signing secret from a Dashboard webhook pointed at  
     `https://your-app.vercel.app/api/webhooks/stripe`
2. Deploy. `postinstall` runs `prisma generate`; run `npx prisma db push` once against Neon if you haven’t already (from your laptop with `DATABASE_URL` set).
3. Verify a sending domain in Resend so recovery and sign-in emails don't land in spam.
4. CASL note (Canada): a follow-up about a transaction the donor themselves initiated is generally fine, but keep the copy transactional and include your org's contact info. For SMS, Twilio requires a registered sender in Canada.
