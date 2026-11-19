import { db } from "@/lib/db";

function qrBadge(status: string) {
  return status === "ACTIVE" ? "badge-green" : status === "LOST" ? "badge-red" : "badge-grey";
}

export default async function AdminVehicles() {
  const vehicles = await db.vehicle.findMany({ include: { owner: true, qrCodes: { orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "desc" }, take: 100 });
  return (
    <div className="card">
      <h2 className="font-bold text-lg">Vehicles</h2>
      <p className="text-slate-600 text-sm">{vehicles.length} registered vehicles (showing up to 100).</p>
      {vehicles.length === 0 ? <p className="text-slate-600 text-sm mt-4">No vehicles yet.</p> : (
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-slate-500"><th className="py-2">Plate</th><th>Vehicle</th><th>Owner</th><th>QR codes</th></tr></thead>
            <tbody>
              {vehicles.map((v) => (
                <tr key={v.id} className="border-t">
                  <td className="py-3 font-semibold">{v.plate}</td>
                  <td>{v.make} {v.model} {v.year}, {v.color}</td>
                  <td>{v.owner.name}<br /><span className="text-slate-500">{v.owner.phone}</span></td>
                  <td>{v.qrCodes.length === 0 ? "-" : v.qrCodes.map((q) => <span key={q.id} className="block">{q.code} <span className={qrBadge(q.status)}>{q.status}</span></span>)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
