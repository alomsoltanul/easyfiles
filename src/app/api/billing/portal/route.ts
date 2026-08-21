import { NextResponse } from 'next/server';
import { getAccount } from '@/lib/auth';
import { getStripe, isStripeConfigured } from '@/lib/stripe';
import { absoluteUrl } from '@/lib/site';

export const dynamic = 'force-dynamic';

/**
 * Hands the user to Stripe's billing portal, where they can change plan, swap
 * card, download invoices or cancel. Everything they do there comes back to us
 * as webhooks, so there is no second place that has to stay in sync.
 */
export async function POST() {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Payments are not set up yet.' }, { status: 503 });
  }

  const account = await getAccount();
  if (!account) {
    return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  }

  const customerId = account.subscription?.stripe_customer_id;
  if (!customerId) {
    return NextResponse.json({ error: 'You do not have a subscription yet.' }, { status: 400 });
  }

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: absoluteUrl('/account/billing'),
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('portal session failed', (err as Error).message);
    return NextResponse.json({ error: 'Could not open the billing portal.' }, { status: 500 });
  }
}
