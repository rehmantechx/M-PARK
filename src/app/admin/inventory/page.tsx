import { db } from "@/lib/db";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { adminGenerateBatch } from "@/lib/actions";

export default async function AdminInventory() {
  // Counts and batch ranges come from database aggregates, not from
  // loading every QR code into memory. This stays fast as stock grows.
  const [total, assigned, usable, batches] = await Promise.all([
    db.qrCode.count(),
    db.qrCode.count({ where: { vehicleId: { not: null } } }),
    db.qrCode.count({ where: { vehicleId: null, status: "ACTIVE" } }),
    db.qrCode.groupBy({
      by: ["batch"],
      _count: { _all: true },
      _min: { code: true },
      _max: { code: true },
      orderBy: { batch: "asc" },
    }),
  ]);
  const assignedByBatch = await db.qrCode.groupBy({
    by: ["batch"],
    _count: { _all: true },
    where: { vehicleId: { not: null } },
  });
  const assignedMap = new Map(assignedByBatch.map((b) => [b.batch, b._count._all]));
  const rows = batches.map((b) => ({
    batch: b.batch,
    total: b._count._all,
    assigned: assignedMap.get(b.batch) || 0,
    unassigned: b._count._all - (assignedMap.get(b.batch) || 0),
    from: b._min.code || "-",
    to: b._max.code || "-",
  }));
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
