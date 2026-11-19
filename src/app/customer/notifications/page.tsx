import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { markNotificationsRead } from "@/lib/actions";

export default async function CustomerNotifications() {
  const s = await getSession();
  if (!s) redirect("/login?role=customer");
  const list = await db.notification.findMany({ where: { userId: s.id }, orderBy: { createdAt: "desc" }, take: 100 });
  const unread = list.filter((n) => !n.isRead).length;
  return (
    <div className="card">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="font-bold text-lg">Notifications</h2>
        {unread > 0 ? <ActionForm action={markNotificationsRead}><SubmitButton className="btn-secondary">Mark all read ({unread})</SubmitButton></ActionForm> : null}
      </div>
      <div className="mt-4 space-y-3">
        {list.length === 0 ? <p className="text-slate-600 text-sm">No notifications yet.</p> : null}
        {list.map((n) => (
          <div key={n.id} className="border-b pb-3">
            <p className="font-semibold">{n.title} {!n.isRead && <span className="badge-blue">Unread</span>}</p>
            <p className="text-slate-600 text-sm">{n.body}</p>
            <p className="text-slate-400 text-xs">{n.createdAt.toISOString().slice(0, 16).replace("T", " ")}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
