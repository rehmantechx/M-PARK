import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Light guard only: redirects without a cookie. Real session verification
// (JWT, expiry, role, blocked) runs in each layout with getSession().
export function middleware(req: NextRequest) {
  const token = req.cookies.get("mpark_session")?.value;
  if (!token) {
    const role = req.nextUrl.pathname.startsWith("/admin") ? "admin" : "customer";
    return NextResponse.redirect(new URL(`/login?role=${role}`, req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*", "/customer/:path*"] };
