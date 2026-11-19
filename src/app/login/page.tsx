import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import LoginPage from "./LoginPage";

export default async function Login({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const s = await getSession();
  if (s?.role === "ADMIN") redirect("/admin");
  if (s?.role === "CUSTOMER") redirect("/customer");
  const params = await searchParams;
  return <LoginPage initialRole={params.role || "customer"} />;
}
