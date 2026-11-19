import { db } from "@/lib/db";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { adminPlanCreate, adminPlanUpdate } from "@/lib/actions";
import { formatPkr } from "@/lib/validate";

export default async function AdminSubscriptions() {
  const plans = await db.subscriptionPlan.findMany({ orderBy: { pricePkr: "asc" } });
  const subs = await db.subscription.findMany({ include: { user: true, plan: true }, orderBy: { createdAt: "desc" }, take: 20 });
  return (
    <div>
      <div className="card">
        <h2 className="font-bold text-lg">Subscription plans</h2>
        <p className="text-slate-600 text-sm">Prices in PKR. A price change applies to new subscriptions only. Old subscriptions keep the price they were created with in the plan history below.</p>
        {plans.length === 0 ? <p className="text-slate-600 text-sm mt-4">No plans yet. Create one below.</p> : null}
        <div className="grid md:grid-cols-3 gap-4 mt-4">
          {plans.map((p) => (
            <div key={p.id} className="border rounded-lg p-4">
              <p className="font-bold">{p.name} {!p.isActive && <span className="badge-grey">Inactive</span>}</p>
              <p className="text-2xl font-bold mt-1">{formatPkr(p.pricePkr)}</p>
              <p className="text-slate-600 text-sm">{p.durationMonths} month{p.durationMonths > 1 ? "s" : ""} - {p.description || ""}</p>
              <ActionForm action={adminPlanUpdate} className="mt-3 space-y-2">
                <input type="hidden" name="id" value={p.id} />
                <div><label className="label">Name</label><input className="input" name="name" defaultValue={p.name} maxLength={100} required /></div>
                <div className="flex gap-2 flex-wrap">
                  <input className="input flex-1 min-w-24" name="pricePkr" type="number" min={1} step={1} defaultValue={p.pricePkr} required />
                  <input className="input flex-1 min-w-24" name="durationMonths" type="number" min={1} max={120} step={1} defaultValue={p.durationMonths} required />
                </div>
                <div><label className="label">Description</label><input className="input" name="description" defaultValue={p.description || ""} maxLength={200} /></div>
                <div className="flex gap-2 flex-wrap">
                  <select className="input w-auto" name="isActive" defaultValue={p.isActive ? "true" : "false"}>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                  <SubmitButton>Save</SubmitButton>
                </div>
              </ActionForm>
            </div>
          ))}
        </div>
      </div>
      <div className="card mt-5 max-w-lg">
        <h3 className="font-bold">Create new plan</h3>
        <ActionForm action={adminPlanCreate} className="grid md:grid-cols-2 gap-3 mt-4">
          <div><label className="label">Name</label><input className="input" name="name" maxLength={100} required /></div>
          <div><label className="label">Price PKR</label><input className="input" name="pricePkr" type="number" min={1} step={1} required /></div>
          <div><label className="label">Duration months</label><input className="input" name="durationMonths" type="number" min={1} max={120} step={1} defaultValue="1" required /></div>
          <div><label className="label">Description</label><input className="input" name="description" maxLength={200} /></div>
          <div className="md:col-span-2"><SubmitButton>Create plan</SubmitButton></div>
        </ActionForm>
      </div>
      <div className="card mt-5">
        <h3 className="font-bold">Recent subscriptions</h3>
        {subs.length === 0 ? <p className="text-slate-600 text-sm mt-2">No subscriptions yet.</p> : null}
        <div className="mt-3 space-y-2 text-sm">
          {subs.map((s) => <p key={s.id}>{s.user.name} - {s.plan.name} - {formatPkr(s.plan.pricePkr)} - {s.status} - {s.startDate.toISOString().slice(0, 10)} to {s.endDate.toISOString().slice(0, 10)}</p>)}
        </div>
        <p className="text-slate-500 text-sm mt-3">Subscriptions are created on registration and by the admin. Online payment is configured in the environment settings.</p>
      </div>
    </div>
  );
}
