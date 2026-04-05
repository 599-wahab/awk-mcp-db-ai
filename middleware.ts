// middleware.ts
// Uses req.nextUrl.origin so it works on ANY port (3000, 3001, Vercel, etc.)
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req: any) => {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/dashboard") && !req.auth) {
    // Use the actual request origin — never hardcoded
    const loginUrl = new URL("/login", req.nextUrl.origin);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/api/ai")) {
    const res = NextResponse.next();
    res.headers.set("Access-Control-Allow-Origin", "*");
    res.headers.set("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.headers.set("Access-Control-Allow-Headers", "Content-Type, x-api-key");
    return res;
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*", "/api/ai"],
};