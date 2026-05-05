// proxy.ts
// Lightweight request gate: keep auth imports out of this file to avoid large edge bundles.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/dashboard")) {
    const session =
      req.cookies.get("authjs.session-token") ||
      req.cookies.get("__Secure-authjs.session-token") ||
      req.cookies.get("next-auth.session-token") ||
      req.cookies.get("__Secure-next-auth.session-token");

    if (!session) {
      return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
    }
  }

  if (pathname.startsWith("/api/ai")) {
    if (req.method === "OPTIONS") {
      return new NextResponse(null, {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
          "Access-Control-Allow-Headers":
            "Content-Type, x-api-key, X-API-Key, x-tenant-id, x-user-id, x-user-email, x-widget-mode",
        },
      });
    }

    const res = NextResponse.next();
    res.headers.set("Access-Control-Allow-Origin", "*");
    res.headers.set("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, x-api-key, X-API-Key, x-tenant-id, x-user-id, x-user-email, x-widget-mode",
    );
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/ai", "/api/ai/:path*"],
};
