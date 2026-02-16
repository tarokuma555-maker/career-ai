import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  // ページルート保護: /admin/* (/admin/login は除く)
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    if (!token) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    const session = await verifySessionToken(token);
    if (!session) {
      const res = NextResponse.redirect(new URL("/admin/login", request.url));
      res.cookies.delete(SESSION_COOKIE);
      return res;
    }
  }

  // API ルート保護: /api/admin/*, /api/analyze-agent, /api/analyze-detailed
  if (
    pathname.startsWith("/api/admin") ||
    pathname.startsWith("/api/analyze-agent") ||
    pathname.startsWith("/api/analyze-detailed")
  ) {
    if (!token) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
    const session = await verifySessionToken(token);
    if (!session) {
      return NextResponse.json(
        { error: "セッションが無効です" },
        { status: 401 },
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/api/analyze-agent/:path*", "/api/analyze-detailed/:path*"],
};
