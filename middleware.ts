import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isSapabidanHost } from "@/src/config/app-variant";

const BLOCKED_CHAT_ROLES = new Set(["dokter", "apoteker"]);
const BLOCKED_STAFF_PATHS = ["/staff/dokter", "/staff/apoteker"];

export function middleware(request: NextRequest) {
  if (!isSapabidanHost(request.headers.get("host"))) return NextResponse.next();

  const { pathname } = request.nextUrl;

  for (const role of BLOCKED_CHAT_ROLES) {
    if (pathname === `/chat/${role}` || pathname.startsWith(`/chat/${role}/`)) {
      return NextResponse.redirect(new URL("/chat/bidan", request.url));
    }
  }

  for (const blocked of BLOCKED_STAFF_PATHS) {
    if (pathname === blocked || pathname.startsWith(`${blocked}/`)) {
      return NextResponse.redirect(new URL("/staff/bidan", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/chat/:path*", "/staff/:path*"],
};
