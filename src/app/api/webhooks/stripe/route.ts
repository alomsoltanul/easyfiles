import { NextResponse, type NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { getLivePlans } from '@/lib/plan-source';
import {
  getStripe,
  intervalForPrice,
  isStripeConfigured,
  planIdForPrice,
  toSubscriptionStatus,
} from '@/lib/stripe';
import { isPlanId } from '@/lib/plans';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Statuses that still entitle the user to their plan. */
const LIVE = new Set(['trialing', 'active', 'past_due']);

/**
 * In current Stripe API versions the billing period lives on the subscription
 * item, not on the subscription. Take the furthest-out item so a multi-item
 * subscription reports the date access actually ends.
 */
function periodEnd(subscription: Stripe.Subscription): string | null {
  const ends = subscription.items.data
    .map((item) => item.current_period_end)
    .filter((value): value is number => typeof value === 'number');
  if (ends.length === 0) return null;
  return new Date(Math.max(...ends) * 1000).toISOString();
}

function firstPriceId(subscription: Stripe.Subscription): string | null {
  return subscription.items.data[0]?.price?.id ?? null;
}

function customerId(value: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
  if (!value) return null;
  return typeof value === 'string' ? value : value.id;
}

/**
 * Writes one Stripe subscription into our table.
 *
 * Keyed on stripe_subscription_id so replays and out-of-order deliveries
 * converge on the same row rather than stacking duplicates.
 */
async function syncSubscription(subscription: Stripe.Subscription): Promise<void> {
  const admin = getSupabaseAdminClient();
  const plans = await getLivePlans();

  const priceId = firstPriceId(subscription);
  const metaUserId = subscription.metadata?.user_id;
  const metaPlanId = subscription.metadata?.plan_id;

  let userId = metaUserId || null;

  // Subscriptions created from the Stripe dashboard carry no metadata, so fall
  // back to whichever user we already know owns this customer.
  if (!userId) {
    const stripeCustomer = customerId(subscription.customer);
    if (stripeCustomer) {
      const { data } = await admin
        .from('subscriptions')
        .select('user_id')
        .eq('stripe_customer_id', stripeCustomer)
        .limit(1)
        .maybeSingle();
      userId = data?.user_id ?? null;
    }
  }

  if (!userId) {
    console.error('stripe webhook: no user for subscription', subscription.id);
    return;
  }

  const planId =
    metaPlanId && isPlanId(metaPlanId)
      ? metaPlanId
      : priceId
        ? planIdForPrice(plans, priceId)
        : null;

  if (!planId) {
    console.error('stripe webhook: no plan for price', priceId);
    return;
  }

  const status = toSubscriptionStatus(subscription.status);

  // At most one live row per user — the partial unique index enforces it, so
  // retire any earlier live row before writing this one.
  if (LIVE.has(status)) {
    await admin
      .from('subscriptions')
      .update({ status: 'canceled' })
      .eq('user_id', userId)
      .neq('stripe_subscription_id', subscription.id)
      .in('status', ['trialing', 'active', 'past_due']);
  }

  const { error } = await admin.from('subscriptions').upsert(
    {
      user_id: userId,
      plan_id: planId,
      interval: priceId ? intervalForPrice(plans, priceId) : 'month',
      status,
      stripe_customer_id: customerId(subscription.customer),
      stripe_subscription_id: subscription.id,
      current_period_end: periodEnd(subscription),
      cancel_at_period_end: subscription.cancel_at_period_end,
      comped: false,
    },
    { onConflict: 'stripe_subscription_id' },
  );

  if (error) {
    console.error('stripe webhook: subscription upsert failed', error.message);
    throw new Error(error.message);
  }
}

export async function POST(request: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Stripe is not configured.' }, { status: 503 });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'STRIPE_WEBHOOK_SECRET is not set.' }, { status: 500 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature.' }, { status: 400 });
  }

  // The raw body is what the signature covers — parse only after verifying.
  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = await getStripe().webhooks.constructEventAsync(payload, signature, secret);
  } catch (err) {
    console.error('stripe webhook: bad signature', (err as Error).message);
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  // Idempotency: the insert fails on a duplicate id, which means we have
  // already handled this event and Stripe is simply retrying.
  const { error: seenError } = await admin
    .from('stripe_events')
    .insert({ id: event.id, type: event.type });

  if (seenError) {
    if (seenError.code === '23505') {
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error('stripe webhook: could not record event', seenError.message);
    return NextResponse.json({ error: 'Could not record event.' }, { status: 500 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.mode !== 'subscription' || !session.subscription) break;

        const subscriptionId =
          typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
        const subscription = await getStripe().subscriptions.retrieve(subscriptionId);

        // Checkout knows the user; the subscription object might not yet.
        const userId = session.metadata?.user_id ?? session.client_reference_id;
        if (userId && !subscription.metadata?.user_id) {
          subscription.metadata = { ...subscription.metadata, user_id: userId };
        }

        await syncSubscription(subscription);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        await syncSubscription(event.data.object);
        break;
      }

      case 'invoice.payment_failed': {
        // Stripe also sends customer.subscription.updated with past_due, which
        // is what actually moves the row; this is here for the log trail.
        const invoice = event.data.object;
        console.warn('stripe webhook: payment failed', {
          customer: customerId(invoice.customer),
          invoice: invoice.id,
        });
        break;
      }

      default:
        break;
    }
  } catch (err) {
    // Leave the event marked as seen only if we succeeded; otherwise clear it
    // so Stripe's retry gets a real second attempt.
    await admin.from('stripe_events').delete().eq('id', event.id);
    console.error('stripe webhook: handler failed', (err as Error).message);
    return NextResponse.json({ error: 'Handler failed.' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
