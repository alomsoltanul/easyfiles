import { NextResponse, type NextRequest } from 'next/server';
import { getAccount } from '@/lib/auth';
import { getLivePlans } from '@/lib/plan-source';
import { getStripe, isStripeConfigured, priceIdFor } from '@/lib/stripe';
import { isPlanId } from '@/lib/plans';
import { absoluteUrl } from '@/lib/site';

export const dynamic = 'force-dynamic';

/**
 * Starts a Stripe Checkout session for one plan and interval.
 *
 * The plan and its price ID are read server-side from the plans table — the
 * client only names which plan it wants, so a tampered request cannot buy the
 * Business plan at the Starter price.
 */
export async function POST(request: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Payments are not set up yet.' }, { status: 503 });
  }

  const account = await getAccount();
  if (!account) {
    return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  }
  if (account.profile.banned_at) {
    return NextResponse.json({ error: 'This account cannot start a subscription.' }, { status: 403 });
  }

  let body: { planId?: string; interval?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const planId = body.planId ?? '';
  const interval = body.interval === 'year' ? 'year' : 'month';

  if (!isPlanId(planId) || planId === 'anon' || planId === 'free') {
    return NextResponse.json({ error: 'Choose a paid plan.' }, { status: 400 });
  }

  const plans = await getLivePlans();
  const plan = plans.find((p) => p.id === planId);
  if (!plan) {
    return NextResponse.json({ error: 'That plan is not available.' }, { status: 404 });
  }

  const priceId = priceIdFor(plan, interval);
  if (!priceId) {
    return NextResponse.json(
      { error: `The ${plan.name} plan has no ${interval}ly price configured yet.` },
      { status: 503 },
    );
  }

  const stripe = getStripe();

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      // Reuse the customer we already know about so a returning subscriber does
      // not end up with two customer records.
      customer: account.subscription?.stripe_customer_id ?? undefined,
      customer_email: account.subscription?.stripe_customer_id ? undefined : account.profile.email,
      client_reference_id: account.user.id,
      // The webhook needs to know who this is for; session metadata survives
      // onto the subscription so later events can be attributed too.
      metadata: { user_id: account.user.id, plan_id: plan.id, interval },
      subscription_data: {
        metadata: { user_id: account.user.id, plan_id: plan.id, interval },
      },
      allow_promotion_codes: true,
      success_url: absoluteUrl('/account/billing?checkout=success'),
      cancel_url: absoluteUrl('/pricing?checkout=cancelled'),
    });

    if (!session.url) throw new Error('Stripe did not return a checkout URL.');
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('checkout session failed', (err as Error).message);
    return NextResponse.json({ error: 'Could not start checkout. Try again.' }, { status: 500 });
  }
}
