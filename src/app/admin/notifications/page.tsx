import { db } from "@/lib/db";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { markNotificationsRead } from "@/lib/actions";

export default async function AdminNotifications() {
  const list = await db.notification.findMany({ include: { user: true }, orderBy: { createdAt: "desc" }, take: 50 });
  const scans = await db.scanLog.findMany({ include: { vehicle: true }, orderBy: { createdAt: "desc" }, take: 20 });
  // Aggregate instead of counting the loaded page, so the badge is correct
  // even when more unread notifications exist beyond the first 50.
  const unread = await db.notification.count({ where: { isRead: false } });
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="card">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <h2 className="font-bold text-lg">Notifications monitoring</h2>
          {/* Always mounted: the form must outlive the button so its success
              message stays visible after every notification is read. */}
          <ActionForm action={markNotificationsRead}>
            {unread > 0 ? <SubmitButton className="btn-secondary">Mark all read ({unread})</SubmitButton> : null}
          </ActionForm>
        </div>
        <div className="mt-4 space-y-3">
          {list.length === 0 ? <p className="text-slate-600 text-sm">No notifications yet.</p> : null}
          {list.map((n) => (
            <div key={n.id} className="border-b pb-2"><p className="font-semibold">{n.title} - {n.user.name} {!n.isRead ? <span className="badge-blue">Unread</span> : null}</p><p className="text-slate-600 text-sm">{n.body}</p><p className="text-slate-400 text-xs">{n.createdAt.toISOString().slice(0, 16).replace("T", " ")}</p></div>
          ))}
        </div>
      </div>
      <div className="card">
        <h2 className="font-bold text-lg">Scan log</h2>
        <div className="mt-4 space-y-3">
          {scans.length === 0 ? <p className="text-slate-600 text-sm">No scans logged yet.</p> : null}
          {scans.map((s) => (
            <div key={s.id} className="border-b pb-2"><p className="font-semibold">{s.scannerName || "Unknown"} scanned {s.vehicle.plate}</p><p className="text-slate-500 text-sm">{s.scannerPhone || ""} - Verified: {s.verified ? "Yes" : "No"} - {s.createdAt.toISOString().slice(0, 16).replace("T", " ")}</p></div>
          ))}
        </div>
      </div>
    </div>
  );
}
