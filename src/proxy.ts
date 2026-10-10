import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// /api/shield authenticates with CRON_SECRET itself (no user session).
const PUBLIC_PATHS = ["/login", "/signup", "/forgot-password", "/auth", "/about", "/api/shield"];

/** Refreshes the Supabase session cookie and gates the app behind sign-in. */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  let signedIn = Boolean(data?.claims?.sub);
  const { pathname } = request.nextUrl;
  const isPublic = pathname === "/" || PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const isEntryPage = pathname === "/login" || pathname === "/signup" || pathname === "/";

  // getClaims() only verifies the JWT locally. Before bouncing a "signed-in" visitor away from the
  // sign-in page, confirm the account still exists server-side; otherwise a deleted/revoked user's
  // stale cookie would loop between /login and the app forever. Clear such sessions.
  if (signedIn && isEntryPage) {
    const { data: u, error } = await supabase.auth.getUser();
    if (error || !u.user) {
      await supabase.auth.signOut({ scope: "local" });
      signedIn = false;
    }
  }

  if (!signedIn && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const hadSession = request.cookies.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));
    url.search = `?next=${encodeURIComponent(pathname + request.nextUrl.search)}${hadSession ? "&reason=expired" : ""}`;
    return NextResponse.redirect(url);
  }
  if (signedIn && isEntryPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/home";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
