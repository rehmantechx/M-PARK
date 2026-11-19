import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function Home() {
  const s = await getSession();
  if (s?.role === "ADMIN") redirect("/admin");
  if (s?.role === "CUSTOMER") redirect("/customer");
  redirect("/login");
}
