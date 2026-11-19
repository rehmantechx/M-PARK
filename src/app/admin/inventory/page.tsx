import { db } from "@/lib/db";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { adminGenerateBatch } from "@/lib/actions";

export default async function AdminInventory() {
  const all = await db.qrCode.findMany({ select: { batch: true, code: true, vehicleId: true, status: true } });
  const total = all.length;
  const assigned = all.filter((c) => c.vehicleId).length;
  const usable = all.filter((c) => !c.vehicleId && c.status === "ACTIVE").length;
  const byBatch = new Map<string, { total: number; assigned: number; codes: string[] }>();
  for (const c of all) {
    const r = byBatch.get(c.batch) || { total: 0, assigned: 0, codes: [] };
    r.total += 1;
    if (c.vehicleId) r.assigned += 1;
    r.codes.push(c.code);
    byBatch.set(c.batch, r);
  }
  const rows = [...byBatch.entries()].map(([batch, r]) => {
    const nums = r.codes.map((code) => Number(code.replace("MPK-", ""))).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
    return { batch, total: r.total, assigned: r.assigned, unassigned: r.total - r.assigned, from: nums.length ? `MPK-${nums[0]}` : "-", to: nums.length ? `MPK-${nums[nums.length - 1]}` : "-" };
  }).sort((a, b) => a.batch.localeCompare(b.batch));
  return (
    <div className="card">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div><h2 className="font-bold text-lg">QR Inventory</h2><p className="text-slate-600 text-sm">Sticker stock, batches, assigned and unassigned codes. Assigned means linked to a vehicle. Usable stock is unassigned and active.</p></div>
        <ActionForm action={adminGenerateBatch} className="flex gap-2 items-center flex-wrap">
          <label className="label mb-0" htmlFor="batch-count">Batch size</label>
          <select id="batch-count" name="count" defaultValue="50" className="input w-auto"><option value="10">10</option><option value="25">25</option><option value="50">50</option><option value="100">100</option></select>
          <SubmitButton confirm="Generate a new batch of QR codes? This creates real codes in the database.">Generate batch</SubmitButton>
        </ActionForm>
      </div>
      <div className="grid md:grid-cols-4 gap-4 mt-5">
        <div className="card"><p className="text-3xl font-bold">{total}</p><p className="text-slate-600 text-sm">Total stickers in stock</p></div>
        <div className="card"><p className="text-3xl font-bold">{assigned}</p><p className="text-slate-600 text-sm">Assigned</p></div>
        <div className="card"><p className="text-3xl font-bold">{usable}</p><p className="text-slate-600 text-sm">Usable stock (unassigned, active)</p></div>
        <div className="card"><p className="text-3xl font-bold">{rows.length}</p><p className="text-slate-600 text-sm">Batches</p></div>
      </div>
      {rows.length === 0 ? <p className="text-slate-600 text-sm mt-4">No QR codes yet. Generate a batch to create stock.</p> : (
        <div className="overflow-x-auto mt-5">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-slate-500"><th className="py-2">Batch</th><th>Code range</th><th>Total</th><th>Assigned</th><th>Unassigned</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.batch} className="border-t">
                  <td className="py-3 font-semibold">{r.batch}</td>
                  <td>{r.from} to {r.to}</td>
                  <td>{r.total}</td>
                  <td>{r.assigned}</td>
                  <td>{r.unassigned}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-slate-500 text-sm mt-3">Generating a batch creates real codes in the database that can be assigned in registration or in Add Customer.</p>
    </div>
  );
}
