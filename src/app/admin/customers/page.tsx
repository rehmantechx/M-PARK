import { db } from "@/lib/db";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { adminAddCustomer, adminCustomerUpdate, adminToggleBlock } from "@/lib/actions";
import { formatPkr } from "@/lib/validate";

export default async function AdminCustomers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const q = (params.q || "").trim();
  const qUpper = q.toUpperCase();
  const customers = await db.user.findMany({
    where: { role: "CUSTOMER", ...(q ? { OR: [{ name: { contains: q } }, { phone: { contains: q } }, { vehicles: { some: { plate: { contains: qUpper } } } }, { vehicles: { some: { qrCodes: { some: { code: { contains: qUpper } } } } } }] } : {}) },
    include: { vehicles: { include: { qrCodes: { orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "asc" } }, subscriptions: { include: { plan: true }, orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const plans = await db.subscriptionPlan.findMany({ where: { isActive: true }, orderBy: { pricePkr: "asc" } });
  const freeQr = await db.qrCode.findMany({ where: { vehicleId: null, status: "ACTIVE" }, orderBy: { code: "asc" }, take: 50 });
  return (
    <div>
      <div className="card">
        <h2 className="font-bold text-lg">Customers</h2>
        <p className="text-slate-600 text-sm">Manage all registered customers, plans and status. Saved in the database.</p>
        <form method="get" className="flex gap-2 mt-4 flex-wrap">
          <input name="q" defaultValue={q} placeholder="Search name, phone, plate or QR code" className="input flex-1 min-w-52" />
          <button className="btn-secondary" type="submit">Search</button>
        </form>
        {q && customers.length === 0 ? <p className="text-slate-600 text-sm mt-4">No customers found for &quot;{q}&quot;.</p> : null}
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-slate-500"><th className="py-2">Customer</th><th>Vehicle</th><th>QR code</th><th>Plan</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {customers.map((c) => {
                const v = c.vehicles[0];
                const sub = c.subscriptions[0];
                return (
                  <tr key={c.id} className="border-t">
                    <td className="py-3"><p className="font-semibold">{c.name}</p><p className="text-slate-500">{c.phone}</p></td>
                    <td>{v ? <span>{v.plate}<br /><span className="text-slate-500">{v.make} {v.model} {v.year}, {v.color}</span></span> : "-"}</td>
                    <td>{v?.qrCodes[0]?.code || "-"} <span className={v?.qrCodes[0]?.status === "ACTIVE" ? "badge-green" : "badge-grey"}>{v?.qrCodes[0]?.status || ""}</span></td>
                    <td>{sub ? <span>{sub.plan.name}<br /><span className="text-slate-500">{formatPkr(sub.plan.pricePkr)} - {sub.status}</span></span> : "No plan"}</td>
                    <td>{c.isBlocked ? <span className="badge-red">Blocked</span> : <span className="badge-green">Active</span>}</td>
                    <td>
                      <ActionForm action={adminToggleBlock.bind(null, c.id, !c.isBlocked)}>
                        <SubmitButton className={c.isBlocked ? "btn-primary" : "btn-danger"} confirm={c.isBlocked ? "Unblock this customer?" : "Block this customer? They will not be able to log in."}>{c.isBlocked ? "Unblock" : "Block"}</SubmitButton>
                      </ActionForm>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-slate-500 text-sm mt-2">{customers.length} customers shown.</p>
        </div>
      </div>
      <div className="card mt-5 max-w-2xl">
        <h3 className="font-bold">Add customer</h3>
        {plans.length === 0 ? <p className="text-red-700 text-sm mt-2">No active plans. Create a plan on the Subscriptions page first.</p> : null}
        {freeQr.length === 0 ? <p className="text-red-700 text-sm mt-2">No unassigned active QR codes. Generate a batch on the QR Inventory page first.</p> : null}
        <ActionForm action={adminAddCustomer} className="grid md:grid-cols-2 gap-3 mt-4">
          <div><label className="label" htmlFor="add-name">Name</label><input id="add-name" className="input" name="name" maxLength={100} required /></div>
          <div><label className="label" htmlFor="add-phone">Phone</label><input id="add-phone" className="input" name="phone" type="tel" inputMode="tel" maxLength={15} placeholder="+92 300 0000000" required /></div>
          <div><label className="label" htmlFor="add-plate">Plate</label><input id="add-plate" className="input" name="plate" maxLength={15} required /></div>
          <div><label className="label" htmlFor="add-year">Year</label><input id="add-year" className="input" name="year" type="number" min={1900} max={2027} step={1} defaultValue="2022" required /></div>
          <div><label className="label" htmlFor="add-make">Make</label><input id="add-make" className="input" name="make" maxLength={50} required /></div>
          <div><label className="label" htmlFor="add-model">Model</label><input id="add-model" className="input" name="model" maxLength={50} required /></div>
          <div><label className="label" htmlFor="add-color">Color</label><input id="add-color" className="input" name="color" maxLength={30} required /></div>
          <div><label className="label" htmlFor="add-plan">Plan</label><select id="add-plan" className="input" name="planId" required>{plans.map((p) => <option key={p.id} value={p.id}>{p.name} - {formatPkr(p.pricePkr)}</option>)}</select></div>
          <div><label className="label" htmlFor="add-qr">QR code (unassigned)</label><select id="add-qr" className="input" name="qrCode" required>{freeQr.map((x) => <option key={x.id} value={x.code}>{x.code} ({x.batch})</option>)}</select></div>
          <div className="md:col-span-2"><SubmitButton>Add customer</SubmitButton></div>
        </ActionForm>
      </div>
      <div className="card mt-5 max-w-2xl">
        <h3 className="font-bold">Edit a customer</h3>
        <p className="text-slate-600 text-sm">Fix a mistyped name, phone, plate, or vehicle. Use the first customer in the list as an example, change the values, and save.</p>
        {customers[0] ? (
          <ActionForm action={adminCustomerUpdate} className="grid md:grid-cols-2 gap-3 mt-4">
            <input type="hidden" name="userId" value={customers[0].id} />
            <input type="hidden" name="vehicleId" value={customers[0].vehicles[0]?.id || ""} />
            <div><label className="label">Name</label><input className="input" name="name" defaultValue={customers[0].name} maxLength={100} required /></div>
            <div><label className="label">Phone</label><input className="input" name="phone" type="tel" defaultValue={customers[0].phone} maxLength={15} required /></div>
            <div><label className="label">Plate</label><input className="input" name="plate" defaultValue={customers[0].vehicles[0]?.plate || ""} maxLength={15} required /></div>
            <div><label className="label">Year</label><input className="input" name="year" type="number" min={1900} max={2027} step={1} defaultValue={customers[0].vehicles[0]?.year || 2022} required /></div>
            <div><label className="label">Make</label><input className="input" name="make" defaultValue={customers[0].vehicles[0]?.make || ""} maxLength={50} required /></div>
            <div><label className="label">Model</label><input className="input" name="model" defaultValue={customers[0].vehicles[0]?.model || ""} maxLength={50} required /></div>
            <div><label className="label">Color</label><input className="input" name="color" defaultValue={customers[0].vehicles[0]?.color || ""} maxLength={30} required /></div>
            <div className="md:col-span-2"><SubmitButton>Save customer</SubmitButton></div>
          </ActionForm>
        ) : <p className="text-slate-600 text-sm mt-2">No customers yet.</p>}
      </div>
    </div>
  );
}
