import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Light guard only: redirects GET page requests without a cookie. Server
// action POSTs must reach the route so the action can return its inline
// error; every action re-verifies the session with requireAdmin/requireCustomer.
export function middleware(req: NextRequest) {
  const token = req.cookies.get("mpark_session")?.value;
  if (token) return NextResponse.next();

  const isActionPost =
    req.headers.has("next-action") ||
    (req.headers.get("content-type") ?? "").startsWith("multipart/form-data");
  if (isActionPost) return NextResponse.next();

  const role = req.nextUrl.pathname.startsWith("/admin") ? "admin" : "customer";
  return NextResponse.redirect(new URL(`/login?role=${role}`, req.url));
}

export const config = { matcher: ["/admin/:path*", "/customer/:path*"] };
