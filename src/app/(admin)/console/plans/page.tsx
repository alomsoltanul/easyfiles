import { listPlanRows } from '@/lib/admin-data';
import { formatPrice } from '@/lib/plans';
import { Panel } from '@/components/admin/primitives';
import PlanEditor from '@/components/admin/PlanEditor';

export default async function ConsolePlansPage() {
  const plans = await listPlanRows();
  const sellable = plans.filter((p) => p.listed);
  const internal = plans.filter((p) => !p.listed);

  return (
    <div className="space-y-4">
      <p className="rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-[13px] leading-relaxed text-slate-500">
        These rows drive the pricing page and checkout. A plan with no Stripe price ID shows as
        “Coming soon” rather than failing after the click — create the price in Stripe first, then
        paste its ID here. Limits are edited in the migration files; prices are edited here.
      </p>

      <Panel title="Plans for sale">
        {sellable.map((plan) => (
          <PlanEditor
            key={plan.id}
            planId={plan.id}
            name={`${plan.name} — ${formatPrice(plan.monthly_price_cents)}/mo · ${formatPrice(plan.yearly_price_cents)}/yr`}
            monthlyCents={plan.monthly_price_cents}
            yearlyCents={plan.yearly_price_cents}
            priceIdMonth={plan.stripe_price_id_month}
            priceIdYear={plan.stripe_price_id_year}
          />
        ))}
      </Panel>

      <Panel title="Limit tiers (not sold)">
        <ul className="divide-y divide-slate-100">
          {internal.map((plan) => (
            <li key={plan.id} className="px-5 py-3">
              <p className="text-sm font-semibold text-slate-900">{plan.name}</p>
              <p className="mt-0.5 font-mono text-[11px] leading-relaxed text-slate-500">
                {JSON.stringify(plan.limits)}
              </p>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
