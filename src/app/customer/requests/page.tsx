import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { customerRequestAction } from "@/lib/actions";

function label(status: string) { return status === "PENDING" ? "Pending" : status === "APPROVED" ? "Approved" : "Ignored"; }
function badge(status: string) { return status === "PENDING" ? "badge-amber" : status === "APPROVED" ? "badge-green" : "badge-grey"; }

export default async function CustomerRequests() {
  const s = await getSession();
  if (!s) redirect("/login?role=customer");
  const list = await db.contactRequest.findMany({ where: { vehicle: { ownerId: s.id } }, include: { vehicle: true }, orderBy: { createdAt: "desc" }, take: 100 });
  return (
    <div className="card">
      <h2 className="font-bold text-lg">Contact requests</h2>
      <p className="text-slate-600 text-sm">Requests from people who scanned your QR sticker.</p>
      <div className="mt-4 space-y-4">
        {list.length === 0 ? <p className="text-slate-600 text-sm">No contact requests yet.</p> : null}
        {list.map((r) => (
          <div key={r.id} className="border rounded-lg p-4">
            <p><strong>{r.scannerName}</strong> - {r.scannerPhone} <span className={badge(r.status)}>{label(r.status)}</span></p>
            <p className="text-slate-600 text-sm mt-1">{r.message}</p>
            <p className="text-slate-400 text-xs mt-1">{r.vehicle.plate} - {r.createdAt.toISOString().slice(0, 16).replace("T", " ")}</p>
            {r.status === "PENDING" ? (
              <div className="flex gap-2 mt-3">
                <ActionForm action={customerRequestAction.bind(null, r.id, "APPROVED")}><SubmitButton confirm="Approve this request?">Approve</SubmitButton></ActionForm>
                <ActionForm action={customerRequestAction.bind(null, r.id, "IGNORED")}><SubmitButton className="btn-secondary" confirm="Ignore this request? You cannot undo it here.">Ignore</SubmitButton></ActionForm>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
