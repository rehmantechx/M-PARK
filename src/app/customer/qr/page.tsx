import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { qrDataUrl, scanUrlFor } from "@/lib/qr";

export default async function CustomerQr() {
  const s = await getSession();
  if (!s) return null;
  const vehicle = await db.vehicle.findFirst({ where: { ownerId: s.id }, include: { qrCodes: true } });
  const qr = vehicle?.qrCodes[0];
  if (!qr || !vehicle) return <p>No QR sticker yet.</p>;
  const dataUrl = await qrDataUrl(qr.code);
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="card text-center">
        <h2 className="font-bold">My QR sticker</h2>
        <img src={dataUrl} alt={`QR code ${qr.code}`} className="w-64 h-64 mx-auto mt-4 border rounded-lg p-2 bg-white" />
        <p className="font-bold mt-3">{qr.code} <span className="badge-green">{qr.status}</span></p>
        <p className="text-slate-500 text-sm">Scan URL: {scanUrlFor(qr.code)}</p>
        <a className="btn-primary mt-4 inline-block" href={dataUrl} download={`${qr.code}.png`}>Download QR</a>
      </div>
      <div className="card">
        <h3 className="font-bold">Sticker information</h3>
        <div className="text-sm space-y-2 mt-3">
          <p>QR Code: <strong>{qr.code}</strong></p>
          <p>Status: <strong>{qr.status}</strong></p>
          <p>Vehicle: {vehicle.plate} - {vehicle.make} {vehicle.model} {vehicle.year}, {vehicle.color}</p>
          <p>Batch: {qr.batch}</p>
          <p>Printed: {qr.printedAt.toISOString().slice(0, 10)}</p>
        </div>
        <h4 className="font-bold mt-5">How to use it</h4>
        <ol className="list-decimal ml-5 text-sm text-slate-600 space-y-1 mt-2">
          <li>Print the QR and stick it on the inside of your windscreen.</li>
          <li>Anyone who needs your car to move can scan it.</li>
          <li>They tap Call Owner or Send M-Park Alert. No OTP and no sign up are needed from the scanner.</li>
          <li>Your number is never shown. Calls go through M-Park Secure Relay.</li>
        </ol>
      </div>
    </div>
  );
}
