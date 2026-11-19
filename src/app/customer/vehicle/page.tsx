import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { customerUpdateVehicle } from "@/lib/actions";

export default async function CustomerVehicle() {
  const s = await getSession();
  if (!s) redirect("/login?role=customer");
  const vehicle = await db.vehicle.findFirst({ where: { ownerId: s.id }, include: { qrCodes: { orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "asc" } });
  if (!vehicle) return <div className="card max-w-lg"><h2 className="font-bold text-lg">My vehicle</h2><p className="text-slate-600 text-sm mt-2">No vehicle registered yet. Ask the admin to register your vehicle, or use the registration page built by the frontend team.</p></div>;
  return (
    <div className="card max-w-lg">
      <h2 className="font-bold text-lg">My vehicle</h2>
      <p className="text-slate-600 text-sm">Changes are saved in the database.</p>
      <ActionForm action={customerUpdateVehicle} className="space-y-4 mt-4">
        <input type="hidden" name="vehicleId" value={vehicle.id} />
        <div><label className="label" htmlFor="plate">Plate</label><input id="plate" className="input" name="plate" defaultValue={vehicle.plate} maxLength={15} required /></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className="label" htmlFor="make">Make</label><input id="make" className="input" name="make" defaultValue={vehicle.make} maxLength={50} required /></div>
          <div><label className="label" htmlFor="model">Model</label><input id="model" className="input" name="model" defaultValue={vehicle.model} maxLength={50} required /></div>
          <div><label className="label" htmlFor="year">Year</label><input id="year" className="input" name="year" type="number" min={1900} max={2027} step={1} defaultValue={vehicle.year} required /></div>
          <div><label className="label" htmlFor="color">Color</label><input id="color" className="input" name="color" defaultValue={vehicle.color} maxLength={30} required /></div>
        </div>
        <p className="text-slate-600 text-sm">QR code: <strong>{vehicle.qrCodes[0]?.code || "None"}</strong> - {vehicle.qrCodes[0]?.status || ""} <Link className="text-green-700 underline" href="/customer/qr">View QR sticker</Link></p>
        <SubmitButton>Save vehicle</SubmitButton>
      </ActionForm>
    </div>
  );
}
