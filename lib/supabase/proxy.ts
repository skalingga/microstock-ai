import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/next-path";
import type { Database } from "@/lib/database.types";

// Refreshes the Supabase session cookie and gates every page except /login and the reset callback.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() validates the token with Supabase; getSession() would trust the cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginPage = request.nextUrl.pathname === "/login";
  // The reset email link arrives here before the user has a session.
  const isPublic = isLoginPage || request.nextUrl.pathname === "/auth/callback";

  if (!user && request.nextUrl.pathname.startsWith("/api/")) {
    // Fetch calls need a machine-readable answer, not a redirect to the login page.
    return NextResponse.json(
      { error: { code: "unauthenticated", message: "Sesi berakhir. Silakan masuk lagi." } },
      { status: 401 },
    );
  }

  if (!user && !isPublic) {
    const { pathname, search } = request.nextUrl;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (pathname === "/reset-password") {
      // Without the session from the email link there is nothing to reset.
      url.searchParams.set("tautan", "kedaluwarsa");
    } else {
      if (pathname !== "/") url.searchParams.set("lanjut", safeNextPath(pathname + search));
      // An auth cookie that no longer yields a user means the session ran out, not a first visit.
      if (hasAuthCookie(request)) url.searchParams.set("sesi", "berakhir");
    }
    return redirectWithCookies(url, response);
  }

  if (user && isLoginPage) {
    const url = new URL(safeNextPath(request.nextUrl.searchParams.get("lanjut")), request.url);
    return redirectWithCookies(url, response);
  }

  return response;
}

// Supabase stores the session as sb-<project>-auth-token, split into .0/.1 chunks when large.
function hasAuthCookie(request: NextRequest) {
  return request.cookies.getAll().some(({ name }) => name.startsWith("sb-") && name.includes("-auth-token"));
}

function redirectWithCookies(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}
