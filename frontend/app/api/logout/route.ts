import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Route handler that clears auth cookies and redirects to /login.
 *  Used when a server component detects an invalid/expired token
 *  (server components can't delete cookies directly). */
export async function GET(request: NextRequest) {
  const url = new URL("/login", request.url);
  const response = NextResponse.redirect(url);

  response.cookies.delete("access_token");
  response.cookies.delete("refresh_token");

  return response;
}
