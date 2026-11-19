import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Shell from "@/components/Shell";

const LINKS = [
  { href: "/customer", label: "Overview" },
  { href: "/customer/orders", label: "My Sticker Order" },
  { href: "/customer/vehicle", label: "My Vehicle" },
  { href: "/customer/qr", label: "My QR Sticker" },
  { href: "/customer/notifications", label: "Notifications" },
  { href: "/customer/requests", label: "Contact Requests" },
  { href: "/customer/emergency", label: "Emergency Contact" },
];

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  if (!s || s.role !== "CUSTOMER") redirect("/login?role=customer");
  return <Shell title="Customer Dashboard" subtitle="My vehicle and QR sticker" name={s.name} detail={s.phone} links={LINKS}>{children}</Shell>;
}
