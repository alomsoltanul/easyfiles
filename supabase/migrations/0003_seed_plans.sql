-- ConvertTools SaaS — plan seed
-- Mirrors src/lib/plans.ts. That file is the compile-time source of truth;
-- these rows let the admin console edit prices and limits without a deploy.
--
-- limits keys:
--   maxFileBytes  bytes per file          (null = unlimited)
--   maxBatch      files per run           (null = unlimited)
--   runsPerDay    tool runs per day       (null = unlimited)
--   videoPerDay   video downloads per day (null = unlimited)
--   historyDays   saved history retention (null = forever, 0 = none)
--   seats         included seats
--   api           API access
--   proTools      unlocks the 12 access:'pro' tools

insert into public.plans
  (id, name, tagline, monthly_price_cents, yearly_price_cents, limits, features, sort, active, listed)
values
  (
    'anon', 'Anonymous', 'No account needed',
    0, 0,
    '{"maxFileBytes":26214400,"maxBatch":3,"runsPerDay":10,"videoPerDay":2,"historyDays":0,"seats":0,"api":false,"proTools":false}'::jsonb,
    '["44 free tools","No sign-up required","Files never leave your browser"]'::jsonb,
    0, true, false
  ),
  (
    'free', 'Free', 'Save your history',
    0, 0,
    '{"maxFileBytes":52428800,"maxBatch":5,"runsPerDay":30,"videoPerDay":5,"historyDays":30,"seats":1,"api":false,"proTools":false}'::jsonb,
    '["44 free tools","30 days of saved history","50 MB files","30 runs per day"]'::jsonb,
    1, true, false
  ),
  (
    'starter', 'Starter', 'For occasional heavy files',
    400, 3900,
    '{"maxFileBytes":104857600,"maxBatch":20,"runsPerDay":500,"videoPerDay":30,"historyDays":365,"seats":1,"api":false,"proTools":true}'::jsonb,
    '["All 56 tools","100 MB files","20 files per batch","500 runs per day","1 year of history","30 video downloads per day"]'::jsonb,
    2, true, true
  ),
  (
    'pro', 'Pro', 'For daily document work',
    900, 8900,
    '{"maxFileBytes":524288000,"maxBatch":100,"runsPerDay":null,"videoPerDay":100,"historyDays":null,"seats":1,"api":true,"proTools":true}'::jsonb,
    '["All 56 tools","500 MB files","100 files per batch","Unlimited runs","History kept forever","100 video downloads per day","API access"]'::jsonb,
    3, true, true
  ),
  (
    'business', 'Business', 'For teams',
    2900, 28900,
    '{"maxFileBytes":2147483648,"maxBatch":null,"runsPerDay":null,"videoPerDay":300,"historyDays":null,"seats":5,"api":true,"proTools":true}'::jsonb,
    '["All 56 tools","2 GB files","Unlimited batch size","Unlimited runs","History kept forever","300 video downloads per day","API access","5 seats"]'::jsonb,
    4, true, true
  )
on conflict (id) do update set
  name                = excluded.name,
  tagline             = excluded.tagline,
  monthly_price_cents = excluded.monthly_price_cents,
  yearly_price_cents  = excluded.yearly_price_cents,
  limits              = excluded.limits,
  features            = excluded.features,
  sort                = excluded.sort,
  active              = excluded.active,
  listed              = excluded.listed;

-- Stripe price IDs are filled in later, either from the admin console or with:
--   update public.plans set stripe_price_id_month = 'price_…',
--                           stripe_price_id_year  = 'price_…'
--    where id = 'starter';
