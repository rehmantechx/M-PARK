import Link from "next/link";
import { db } from "@/lib/db";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { adminQrStatus } from "@/lib/actions";

export default async function AdminQrCodes({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const params = await searchParams;
  const q = (params.q || "").trim().toUpperCase().slice(0, 100);
  const status = params.status === "ACTIVE" || params.status === "INACTIVE" || params.status === "LOST" ? params.status : "";
  const list = await db.qrCode.findMany({
    where: { ...(q ? { code: { contains: q } } : {}), ...(status ? { status } : {}) },
    include: { vehicle: { include: { owner: true } } },
    orderBy: { code: "asc" },
    take: 100,
  });
  return (
    <div className="card">
      <h2 className="font-bold text-lg">QR Codes</h2>
      <p className="text-slate-600 text-sm">{list.length} codes shown (up to 100). Change a status to activate, deactivate, or mark a sticker lost.</p>
      <form method="get" className="flex gap-2 mt-4 flex-wrap">
        <input name="q" defaultValue={q} placeholder="Search QR code" className="input flex-1 min-w-40" />
        <select name="status" defaultValue={status} className="input w-auto"><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="LOST">Lost</option></select>
        <button className="btn-secondary" type="submit">Search</button>
      </form>
      {list.length === 0 ? <p className="text-slate-600 text-sm mt-4">No QR codes found.</p> : (
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-slate-500"><th className="py-2">Code</th><th>Batch</th><th>Vehicle</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {list.map((qr) => (
                <tr key={qr.id} className="border-t">
                  <td className="py-3 font-semibold">{qr.code}</td>
                  <td>{qr.batch}</td>
                  <td>{qr.vehicle ? `${qr.vehicle.plate} - ${qr.vehicle.owner.name}` : "Unassigned"}</td>
                  <td><span className={qr.status === "ACTIVE" ? "badge-green" : qr.status === "LOST" ? "badge-red" : "badge-grey"}>{qr.status}</span></td>
                  <td>
                    <div className="flex gap-1 flex-wrap">
                      <ActionForm action={adminQrStatus.bind(null, qr.id, "ACTIVE")}><SubmitButton className="btn-secondary" >Activate</SubmitButton></ActionForm>
                      <ActionForm action={adminQrStatus.bind(null, qr.id, "INACTIVE")}><SubmitButton className="btn-secondary">Deactivate</SubmitButton></ActionForm>
                      <ActionForm action={adminQrStatus.bind(null, qr.id, "LOST")}><SubmitButton className="btn-danger" confirm="Mark this sticker lost?">Lost</SubmitButton></ActionForm>
                      <Link className="btn-secondary" href={`/api/qr/${qr.code}`}>View API</Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
