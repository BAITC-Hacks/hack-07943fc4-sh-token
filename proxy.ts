import { NextResponse, type NextRequest } from "next/server"
import { checkDemoAccess, demoAccessRequired } from "@/lib/server/demo-access"

export function proxy(request: NextRequest) {
  const denied = checkDemoAccess(request)
  if (denied) return denied
  const response = NextResponse.next()
  if (demoAccessRequired()) {
    response.headers.set("Cache-Control", "private, no-store")
    response.headers.set("X-Robots-Tag", "noindex, nofollow")
  }
  return response
}

// API handlers check credentials themselves, before reading any request body.
// Excluding them avoids Proxy's duplicate buffering/truncation of parquet uploads.
export const config = { matcher: ["/((?!api(?:/|$)).*)"] }
