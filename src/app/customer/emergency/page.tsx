import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { customerEmergencyUpsert, customerEmergencyDelete } from "@/lib/actions";

export default async function CustomerEmergency() {
  const s = await getSession();
  if (!s) redirect("/login?role=customer");
  const contact = await db.emergencyContact.findUnique({ where: { userId: s.id } });
  return (
    <div className="card max-w-lg">
      <h2 className="font-bold text-lg">Emergency contact</h2>
      <p className="text-slate-600 text-sm">Your emergency contact number is never shown on the scan page. If a scanner sends an alert, M-Park also notifies this contact through the secure system.</p>
      {contact ? <p className="text-sm mt-3 bg-slate-50 border rounded-lg p-3">Saved contact: <strong>{contact.name}</strong> - {contact.phone}{contact.relationship ? ` (${contact.relationship})` : ""}</p> : null}
      <ActionForm action={customerEmergencyUpsert} className="space-y-4 mt-4">
        <div><label className="label" htmlFor="ec-name">Name</label><input id="ec-name" className="input" name="name" defaultValue={contact?.name || ""} maxLength={100} required /></div>
        <div><label className="label" htmlFor="ec-phone">Phone</label><input id="ec-phone" className="input" name="phone" type="tel" inputMode="tel" maxLength={15} defaultValue={contact?.phone || ""} placeholder="+92 300 0000000" required /></div>
        <div><label className="label" htmlFor="ec-rel">Relationship (optional)</label><input id="ec-rel" className="input" name="relationship" defaultValue={contact?.relationship || ""} maxLength={50} /></div>
        <SubmitButton>Save emergency contact</SubmitButton>
      </ActionForm>
      {contact ? (
        <div className="mt-4">
          <ActionForm action={customerEmergencyDelete}><SubmitButton className="btn-danger" confirm="Remove your emergency contact?">Remove emergency contact</SubmitButton></ActionForm>
        </div>
      ) : null}
    </div>
  );
}
