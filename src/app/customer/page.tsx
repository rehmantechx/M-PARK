import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { formatPkr, isActiveSubscription, normalizePhone } from "@/lib/validate";
import { redirect } from "next/navigation";

function statusBadge(status: string) {
  return status === "PENDING" ? "badge-amber" : status === "APPROVED" ? "badge-green" : "badge-grey";
}
function statusLabel(status: string) {
  return status === "PENDING" ? "Pending" : status === "APPROVED" ? "Approved" : "Ignored";
}

export default async function CustomerOverview() {
  const s = await getSession();
  if (!s) redirect("/login?role=customer");
  const user = await db.user.findUnique({ where: { id: s.id }, include: { vehicles: { include: { qrCodes: { orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "asc" } }, subscriptions: { include: { plan: true }, orderBy: { createdAt: "desc" } } } });
  if (!user) return <p>Account not found.</p>;
  const vehicle = user.vehicles[0];
  const qr = vehicle?.qrCodes[0];
  const sub = user.subscriptions.find((x) => isActiveSubscription(x)) || null;
  const pending = await db.contactRequest.count({ where: { vehicle: { ownerId: s.id }, status: "PENDING" } });
  const unread = await db.notification.count({ where: { userId: s.id, isRead: false } });
  const latest = await db.contactRequest.findFirst({ where: { vehicle: { ownerId: s.id } }, orderBy: { createdAt: "desc" } });
  const myOrder = await db.stickerOrder.findFirst({ where: { OR: [{ userId: s.id }, { buyerPhone: normalizePhone(user.phone) }, { buyerPhone: user.phone }] }, orderBy: { createdAt: "desc" } });
  const firstName = (user.name || "").trim().split(" ")[0] || "there";
  return (
    <div>
      <h2 className="text-xl font-bold">Welcome back, {firstName}</h2>
      <p className="text-slate-600">Your vehicle, QR sticker, and contact requests in one place.</p>
      <div className="grid md:grid-cols-4 gap-4 mt-5">
        <div className="card"><p className="text-3xl font-bold">{user.vehicles.length}</p><p className="text-slate-600 text-sm">{user.vehicles.length === 1 ? "Registered vehicle" : "Registered vehicles"}</p><p className="text-green-700 text-sm">{vehicle?.plate || "No vehicle yet"}</p></div>
        <div className="card"><Link href="/customer/qr" className="block"><p className="text-3xl font-bold break-words">{qr?.code || "-"}</p><p className="text-slate-600 text-sm">QR sticker</p><p className="text-green-700 text-sm">{qr?.status || "None"}</p></Link></div>
        <div className="card"><p className="text-3xl font-bold">{pending}</p><p className="text-slate-600 text-sm">Pending contact requests</p><p className="text-amber-700 text-sm">{pending > 0 ? "Needs your review" : "All caught up"}</p></div>
        <div className="card"><Link href="/customer/notifications" className="block"><p className="text-3xl font-bold">{unread}</p><p className="text-slate-600 text-sm">Unread notifications</p><p className="text-green-700 text-sm">{sub ? `${sub.plan.name} till ${sub.endDate.toISOString().slice(0, 10)}` : "No active plan"}</p></Link></div>
      </div>
      <div className="grid md:grid-cols-2 gap-4 mt-5">
        <div className="card">
          <h3 className="font-bold">My vehicle</h3>
          {vehicle ? <div className="mt-2 text-sm space-y-1"><p>Plate: <strong>{vehicle.plate}</strong></p><p>Vehicle: {vehicle.make} {vehicle.model} {vehicle.year}, {vehicle.color}</p><p>Plan: {sub ? `${sub.plan.name} - ${formatPkr(sub.plan.pricePkr)}` : "None"}</p></div> : <p className="text-slate-600 text-sm mt-2">No vehicle registered yet. Ask the admin to register your vehicle.</p>}
          <Link href="/customer/vehicle" className="btn-secondary mt-4 inline-block">View vehicle details</Link>
        </div>
        <div className="card">
          <h3 className="font-bold">My Sticker Order</h3>
          {myOrder ? <div className="mt-2 text-sm space-y-1"><p>Sticker: <strong>{myOrder.stickerCode}</strong></p><p>{myOrder.paymentStatus === "PAID" ? "Price paid" : "Price"}: <strong>{formatPkr(myOrder.pricePkr)}</strong> - {myOrder.paymentStatus === "PAID" ? "Paid" : "Unpaid"}</p><p>Order status: <strong>{myOrder.orderStatus}</strong></p><p className="text-slate-500">Delivery: {myOrder.deliveryAddress}</p></div> : <p className="text-slate-600 text-sm mt-2">No sticker order found for your account yet.</p>}
          <Link href="/customer/orders" className="btn-secondary mt-4 inline-block">View my sticker orders</Link>
        </div>
        <div className="card">
          <h3 className="font-bold">Latest contact request</h3>
          {latest ? <div className="mt-2 text-sm"><p><strong>{latest.scannerName}</strong> <span className={statusBadge(latest.status)}>{statusLabel(latest.status)}</span></p><p className="mt-1">{latest.message}</p><p className="text-slate-500 mt-1">{latest.createdAt.toISOString().slice(0, 16).replace("T", " ")} - {latest.scannerPhone}</p></div> : <p className="text-slate-600 text-sm mt-2">No contact requests yet.</p>}
          <Link href="/customer/requests" className="btn-secondary mt-4 inline-block">View all requests</Link>
        </div>
      </div>
    </div>
  );
}
