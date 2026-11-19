import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export default async function CustomerOverview() {
  const s = await getSession();
  if (!s) return null;
  const user = await db.user.findUnique({ where: { id: s.id }, include: { vehicles: { include: { qrCodes: true } }, subscriptions: { include: { plan: true }, orderBy: { createdAt: "desc" } }, notifications: { orderBy: { createdAt: "desc" }, take: 5 } } });
  if (!user) return <p>Account not found.</p>;
  const vehicle = user.vehicles[0];
  const qr = vehicle?.qrCodes[0];
  const sub = user.subscriptions[0];
  const pending = await db.contactRequest.count({ where: { vehicle: { ownerId: s.id }, status: "PENDING" } });
  const unread = await db.notification.count({ where: { userId: s.id, isRead: false } });
  const latest = await db.contactRequest.findFirst({ where: { vehicle: { ownerId: s.id } }, orderBy: { createdAt: "desc" } });
  const myOrder = await db.stickerOrder.findFirst({ where: { buyerPhone: user.phone }, orderBy: { createdAt: "desc" } });
  return (
    <div>
      <h2 className="text-xl font-bold">Welcome back, {user.name.split(" ")[0]}</h2>
      <p className="text-slate-600">Your vehicle, QR sticker, and contact requests in one place.</p>
      <div className="grid md:grid-cols-4 gap-4 mt-5">
        <div className="card"><p className="text-3xl font-bold">{user.vehicles.length}</p><p className="text-slate-600 text-sm">Registered vehicle</p><p className="text-green-700 text-sm">{vehicle?.plate || "No vehicle yet"}</p></div>
        <div className="card"><p className="text-3xl font-bold">{qr?.code || "-"}</p><p className="text-slate-600 text-sm">QR sticker</p><p className="text-green-700 text-sm">{qr?.status || "None"}</p></div>
        <div className="card"><p className="text-3xl font-bold">{pending}</p><p className="text-slate-600 text-sm">Pending contact requests</p><p className="text-amber-700 text-sm">Needs your review</p></div>
        <div className="card"><p className="text-3xl font-bold">{unread}</p><p className="text-slate-600 text-sm">Unread notifications</p><p className="text-green-700 text-sm">{sub ? `${sub.plan.name} till ${sub.endDate.toISOString().slice(0, 10)}` : "No plan"}</p></div>
      </div>
      <div className="grid md:grid-cols-2 gap-4 mt-5">
        <div className="card">
          <h3 className="font-bold">My vehicle</h3>
          {vehicle ? <div className="mt-2 text-sm space-y-1"><p>Plate: <strong>{vehicle.plate}</strong></p><p>Vehicle: {vehicle.make} {vehicle.model} {vehicle.year}, {vehicle.color}</p><p>Plan: {sub ? `${sub.plan.name} - PKR ${sub.plan.pricePkr}` : "None"}</p></div> : <p className="text-slate-600 text-sm mt-2">No vehicle registered yet.</p>}
          <Link href="/customer/vehicle" className="btn-secondary mt-4 inline-block">View vehicle details</Link>
        </div>
        <div className="card">
          <h3 className="font-bold">My Sticker Order</h3>
          {myOrder ? <div className="mt-2 text-sm space-y-1"><p>Sticker: <strong>{myOrder.stickerCode}</strong></p><p>Price paid: <strong>PKR {myOrder.pricePkr}</strong> - {myOrder.paymentStatus === "PAID" ? "Paid" : "Unpaid"}</p><p>Order status: <strong>{myOrder.orderStatus}</strong></p><p className="text-slate-500">Delivery: {myOrder.deliveryAddress}</p></div> : <p className="text-slate-600 text-sm mt-2">No sticker order found for your phone yet.</p>}
          <Link href="/customer/orders" className="btn-secondary mt-4 inline-block">View my sticker orders</Link>
        </div>
        <div className="card">
          <h3 className="font-bold">Latest contact request</h3>
          {latest ? <div className="mt-2 text-sm"><p><strong>{latest.scannerName}</strong> <span className="badge-amber">{latest.status}</span></p><p className="mt-1">{latest.message}</p><p className="text-slate-500 mt-1">{latest.createdAt.toISOString().slice(0, 16).replace("T", " ")} - {latest.scannerPhone}</p></div> : <p className="text-slate-600 text-sm mt-2">No contact requests yet.</p>}
          <Link href="/customer/requests" className="btn-secondary mt-4 inline-block">View all requests</Link>
        </div>
      </div>
    </div>
  );
}
