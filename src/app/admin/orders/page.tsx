import { db } from "@/lib/db";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { adminOrderPayment, adminOrderStatus, adminProductPrice } from "@/lib/actions";
import { formatPkr } from "@/lib/validate";

const STATUSES = ["ORDERED", "PRINTED", "SHIPPED", "DELIVERED", "ACTIVATED"] as const;

export default async function AdminOrders() {
  const orders = await db.stickerOrder.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  const product = await db.product.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" } });
  const paidOrders = orders.filter((o) => o.paymentStatus === "PAID");
  const totalRevenue = paidOrders.reduce((sum, o) => sum + o.pricePkr, 0);
  return (
    <div>
      <p className="text-slate-600">QR sticker sales. This is the core M-Park business: sell the sticker, confirm payment, ship it, then it is permanently linked to the vehicle after registration.</p>
      <div className="grid md:grid-cols-3 gap-4 mt-5">
        <div className="card"><p className="text-3xl font-bold">{paidOrders.length}</p><p className="text-slate-600 text-sm">Total QR stickers sold (paid)</p><p className="text-slate-500 text-sm">{orders.length} orders in total</p></div>
        <div className="card"><p className="text-3xl font-bold">{formatPkr(totalRevenue)}</p><p className="text-slate-600 text-sm">Total revenue from sticker sales</p><p className="text-slate-500 text-sm">Paid orders only</p></div>
        <div className="card">
          <p className="text-3xl font-bold">{product ? formatPkr(product.pricePkr) : "-"}</p>
          <p className="text-slate-600 text-sm">Sticker price</p>
          {product ? (
            <ActionForm action={adminProductPrice} className="flex gap-2 mt-3 flex-wrap">
              <input type="hidden" name="id" value={product.id} />
              <input className="input flex-1 min-w-24" name="pricePkr" type="number" defaultValue={product.pricePkr} min={1} step={1} required />
              <SubmitButton>Save price</SubmitButton>
            </ActionForm>
          ) : <p className="text-red-700 text-sm mt-2">No active sticker product. Add one in the database seed or product table.</p>}
          <p className="text-slate-500 text-xs mt-2">Price changes apply to new orders only. Past orders keep their price.</p>
        </div>
      </div>
      <div className="card mt-5 overflow-x-auto">
        <h3 className="font-bold">Orders</h3>
        {orders.length === 0 ? <p className="text-slate-600 text-sm mt-2">No orders yet.</p> : null}
        <table className="w-full text-sm mt-3">
          <thead><tr className="text-left text-slate-500"><th className="py-2">Buyer</th><th>Plate</th><th>Sticker</th><th>Price</th><th>Payment</th><th>Order status</th><th>Actions</th></tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-t">
                <td className="py-2"><strong>{o.buyerName}</strong><br /><span className="text-slate-500">{o.buyerPhone}</span><br /><span className="text-slate-500">{o.deliveryAddress}</span></td>
                <td>{o.plate || "-"}</td>
                <td>{o.stickerCode}</td>
                <td>{formatPkr(o.pricePkr)}</td>
                <td>{o.paymentStatus === "PAID" ? <span className="badge-green">Paid</span> : <span className="badge-amber">Unpaid</span>}{o.paymentMethod ? <span className="text-slate-500 block">{o.paymentMethod}</span> : null}</td>
                <td><span className="badge-grey">{o.orderStatus}</span></td>
                <td>
                  <ActionForm action={adminOrderPayment} className="inline">
                    <input type="hidden" name="id" value={o.id} />
                    <input type="hidden" name="paymentStatus" value={o.paymentStatus === "PAID" ? "UNPAID" : "PAID"} />
                    <SubmitButton className="btn-secondary text-sm">{o.paymentStatus === "PAID" ? "Mark Unpaid" : "Mark Paid"}</SubmitButton>
                  </ActionForm>
                  <ActionForm action={adminOrderStatus} className="inline ml-2">
                    <input type="hidden" name="id" value={o.id} />
                    <select className="input inline-block w-auto" name="orderStatus" defaultValue={o.orderStatus}>
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <SubmitButton className="btn-primary text-sm ml-2">Save status</SubmitButton>
                  </ActionForm>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
