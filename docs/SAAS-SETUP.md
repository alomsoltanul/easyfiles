# SaaS setup

Everything in the code is done. These are the external accounts it needs.
Until you do step 1 the site still works — all 56 tools run, gated as free,
and the header shows signed-out buttons.

---

## 1. Supabase

Create the project under whichever account you want to bill. Region cannot be
changed later, so pick the one nearest your traffic.

Run the migrations, in order, either by pasting each file into the SQL editor
or with the CLI:

```bash
npx supabase link --project-ref <ref>
npx supabase db push
```

```
supabase/migrations/0001_init.sql          tables, enums, triggers
supabase/migrations/0002_rls.sql           row level security, is_admin()
supabase/migrations/0003_seed_plans.sql    the five plan rows
supabase/migrations/0004_retention.sql     history pruning function
supabase/migrations/0005_fix_profile_guard.sql
supabase/migrations/0006_admin_console.sql admin_users, login attempts
```

`supabase/all-migrations.sql` is all of them concatenated, safe to re-run — paste
that one file if you would rather not run them individually.

Then in the dashboard:

- **Authentication → URL Configuration** — set Site URL and add both
  `http://localhost:3000/auth/callback` and
  `https://easyheictojpg.vercel.app/auth/callback` to the redirect allow-list.
  OAuth and magic links bounce without this.
- **Authentication → Providers** — enable Google if you want the "Continue with
  Google" button to work. Everything else works without it.
- **Advisors** — check it after the migrations land and clear anything it flags.

Copy into `.env.local` and into Vercel:

```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable / anon key>
SUPABASE_SERVICE_ROLE_KEY=<secret / service_role key>
```

Regenerate the types whenever you change the schema:

```bash
npx supabase gen types typescript --project-id <ref> > src/lib/supabase/database.types.ts
```

> Free-tier projects pause after 7 days with no activity. Fine while building;
> move to Pro before launch or auth goes down on a quiet week.

---

## 2. Admin console

The console is a separate application. It has its own accounts, its own
sign-in and its own session cookie, and shares nothing with customer auth:

| | Customers | Console |
|---|---|---|
| Identity | Supabase Auth → `auth.users` + `profiles` | NextAuth → `public.admin_users` |
| Session | `sb-*` cookies | `__Secure-ct-admin.session` |
| Sign-in | `/account/sign-in` | `/$ADMIN_PATH_SECRET/login` |

A customer account can never become a console account, and a console account
has no plan, no quota and no tool history.

### Environment

```
ADMIN_PATH_SECRET=<random string, no slashes>
AUTH_SECRET=<npx auth secret>

# optional — enables "Continue with Google" on the console login
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
```

For Google, add `https://<your-domain>/api/auth/callback/google` (and the
localhost equivalent) as an authorised redirect URI in the Google Cloud
console. Google never creates a console account: the address has to exist in
`admin_users` already, or the sign-in is refused.

### The first owner

There is no sign-up screen and no password-reset email, so the first account is
created from the command line:

```bash
node scripts/create-admin.mjs you@example.com --role owner
```

It prints a generated password once. Sign in at `/$ADMIN_PATH_SECRET/login` and
change it under **Team & access**. Everyone after that is added from inside the
console — `--google-only` creates an account with no password at all.

Roles: `viewer` reads everything and changes nothing, `admin` can change
customers, tools and prices, `owner` can additionally manage console access.

### How it is protected

- `src/proxy.ts` is the only route to `/admin-console`; a direct hit returns the
  ordinary 404, as do `/admin`, `/login` and the other guessable paths.
- Every page behind the login calls `requireAdminActor()`, which re-reads the
  `admin_users` row on each request — disabling an account takes effect on the
  next click, not when the token expires.
- Failed sign-ins are counted per email and per IP over a 15-minute window and
  logged to `admin_login_attempts`; the form only ever says "wrong" or "too
  many attempts", never which addresses exist.
- NextAuth's own redirecting endpoints (`/api/auth/signin`, `/signout`,
  `/error`, `/callback/credentials`) return the 404 so none of them can hand the
  secret path to a stranger. `pages.error` points at the public
  `/sign-in-failed` for the same reason. Sign-in and sign-out run in-process
  from Server Actions, so nothing needs those endpoints.
- Every change made in the console is written to `admin_audit`, which has no
  delete path from the app — including for an owner.

Rotate the secret path any time by changing `ADMIN_PATH_SECRET`; no code change
is needed. `.env.local` already has one generated for local use; set a different
one in Vercel.

### Leftover `profiles.role = 'admin'`

Console access used to be a flag on the customer profile. It no longer opens
anything, but it still widens what that customer's own session can read through
the `is_admin()` RLS policies. The console's overview flags any account still
carrying it, and the customer detail screen clears it.

---

## 3. Stripe

Create three products, each with a monthly and a yearly price — six prices in
total. Amounts should match the plan rows, or change the rows to match Stripe:

| Plan | Monthly | Yearly |
|---|---|---|
| Starter | $4 | $39 |
| Pro | $9 | $89 |
| Business | $29 | $289 |

Paste the six price IDs into the console at `/$ADMIN_PATH_SECRET/plans`, or:

```sql
update public.plans
   set stripe_price_id_month = 'price_…', stripe_price_id_year = 'price_…'
 where id = 'starter';
```

A plan with no price ID shows "Coming soon" instead of failing after the click.

**Webhook** → `https://easyheictojpg.vercel.app/api/webhooks/stripe`, sending:

```
checkout.session.completed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.payment_failed
```

```
STRIPE_SECRET_KEY=sk_…
STRIPE_WEBHOOK_SECRET=whsec_…
```

Locally: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.

---

## 4. Cron

`vercel.json` schedules `/api/cron/retention` daily at 03:17 UTC. It prunes
history past each plan's retention window. Set:

```
CRON_SECRET=<random string>
```

The route rejects anything without `Authorization: Bearer $CRON_SECRET`.

---

## 5. Vercel

Add every variable above under Production and Preview, plus:

```
NEXT_PUBLIC_SITE_URL=https://easyheictojpg.vercel.app
```

---

## Test list

- `/login`, `/admin`, `/wp-admin`, any nonsense path → branded 404
- `/admin-console`, `/api/auth/signin`, `/api/auth/callback/credentials` → 404
- `/$ADMIN_PATH_SECRET` signed out → the console login, and nothing else on the
  site links to it
- wrong console password eight times → "too many attempts" for 15 minutes, and
  eight rows in `admin_login_attempts`
- disable your own second console account, then reload its session → back at
  the login screen immediately
- sign up → confirm email → `/account` shows the Free plan
- run merge, split and an image convert → three rows in `/account/history`
- upload a 60 MB file signed out → blocked at 25 MB with an upgrade prompt
- `/pdf/ocr` signed out → page renders with its description and an upgrade card
- checkout with `4242 4242 4242 4242` → plan unlocks without re-login
- cancel in the portal → `cancel_at_period_end` shows on `/account/billing`
- resend a webhook from the Stripe dashboard → second delivery is a no-op

---

## Two things to know

**Client-side gating is a paywall, not a security boundary.** 44 of the 56
tools run entirely in the browser, so someone determined can bypass the gate
with devtools. This is normal for this product category. What is genuinely
enforced server-side: plan and usage facts come from `/api/me`, history and
quota counters are RLS-protected, and `/api/video/prepare` — the only route
that mints a download token — checks the plan before issuing one.

**The video paywall is inconsistent on purpose, for now.** `/video` (the
universal downloader) is a paid tool, but the four per-platform pages under
`/video-tools/` are free and do the same job. The daily video quota applies to
all of them, so cost is bounded either way — but a free user who hits the
upgrade card on `/video` can click straight through to a free platform page.
Decide whether to make all five paid or all five free; changing it is one line
in `src/lib/tool-access.ts`.
