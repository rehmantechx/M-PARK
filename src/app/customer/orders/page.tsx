import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { formatPkr, normalizePhone } from "@/lib/validate";

export default async function CustomerOrders() {
  const s = await getSession();
  if (!s) redirect("/login?role=customer");
  const orders = await db.stickerOrder.findMany({ where: { OR: [{ userId: s.id }, { buyerPhone: normalizePhone(s.phone) }, { buyerPhone: s.phone }] }, orderBy: { createdAt: "desc" }, take: 100 });
  return (
    <div>
      <h2 className="text-xl font-bold">My Sticker Orders</h2>
      <p className="text-slate-600">Your QR sticker purchases, price, order status and delivery address.</p>
      <div className="space-y-4 mt-5">
        {orders.length === 0 ? <p className="text-slate-600">No sticker orders yet.</p> : null}
        {orders.map((o) => (
          <div key={o.id} className="card">
            <p className="font-bold">Sticker {o.stickerCode} - {formatPkr(o.pricePkr)}</p>
            <p className="text-slate-600 text-sm mt-1">Payment: {o.paymentStatus === "PAID" ? "Paid" : "Unpaid"}{o.paymentMethod ? ` by ${o.paymentMethod}` : ""}</p>
            <p className="text-slate-600 text-sm">Order status: <strong>{o.orderStatus}</strong></p>
            <p className="text-slate-600 text-sm">Delivery: {o.deliveryAddress}</p>
            <p className="text-slate-500 text-sm">Ordered {o.createdAt.toISOString().slice(0, 10)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
