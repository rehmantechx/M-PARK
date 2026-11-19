import { db } from "@/lib/db";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { adminRequestAction } from "@/lib/actions";
import { requestBadgeClass, requestLabel } from "@/lib/format";


export default async function AdminRequests({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const params = await searchParams;
  const filter = params.status === "PENDING" || params.status === "APPROVED" || params.status === "IGNORED" ? params.status : "";
  const requests = await db.contactRequest.findMany({ where: filter ? { status: filter } : {}, include: { vehicle: { include: { owner: true } } }, orderBy: { createdAt: "desc" }, take: 100 });
  return (
    <div className="card">
      <h2 className="font-bold text-lg">Contact Requests</h2>
      <p className="text-slate-600 text-sm">Requests from people who scanned a sticker. Customers approve or ignore them in their own dashboard, and the admin can do the same here.</p>
      <div className="flex gap-2 mt-4 flex-wrap">
        <a className={!filter ? "btn-primary" : "btn-secondary"} href="/admin/requests">All</a>
        <a className={filter === "PENDING" ? "btn-primary" : "btn-secondary"} href="/admin/requests?status=PENDING">Pending</a>
        <a className={filter === "APPROVED" ? "btn-primary" : "btn-secondary"} href="/admin/requests?status=APPROVED">Approved</a>
        <a className={filter === "IGNORED" ? "btn-primary" : "btn-secondary"} href="/admin/requests?status=IGNORED">Ignored</a>
      </div>
      {requests.length === 0 ? <p className="text-slate-600 text-sm mt-4">No contact requests yet.</p> : (
        <div className="mt-4 space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="border rounded-lg p-4">
              <p className="font-semibold">{r.scannerName} - {r.scannerPhone} <span className={requestBadgeClass(r.status)}>{requestLabel(r.status)}</span></p>
              <p className="text-sm mt-1">{r.message}</p>
              <p className="text-slate-500 text-sm mt-1">Plate {r.vehicle.plate} - Owner {r.vehicle.owner.name} - {r.createdAt.toISOString().slice(0, 16).replace("T", " ")}</p>
              {r.status === "PENDING" ? (
                <div className="flex gap-2 mt-3">
                  <ActionForm action={adminRequestAction.bind(null, r.id, "APPROVED")}><SubmitButton className="btn-primary">Approve</SubmitButton></ActionForm>
                  <ActionForm action={adminRequestAction.bind(null, r.id, "IGNORED")}><SubmitButton className="btn-secondary">Ignore</SubmitButton></ActionForm>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
