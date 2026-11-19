import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Shell from "@/components/Shell";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/vehicles", label: "Vehicles" },
  { href: "/admin/qr-codes", label: "QR Codes" },
  { href: "/admin/inventory", label: "QR Inventory" },
  { href: "/admin/requests", label: "Contact Requests" },
  { href: "/admin/notifications", label: "Notifications" },
  { href: "/admin/subscriptions", label: "Subscriptions" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  if (!s || s.role !== "ADMIN") redirect("/login?role=admin");
  return <Shell title="Admin Dashboard" subtitle="All customers and sticker sales" name={s.name} detail={s.phone} links={LINKS}>{children}</Shell>;
}
