import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getGitHubOAuthConfig } from "@/lib/env";

export async function GET(request: NextRequest) {
  const { clientId, callbackUrl, missing } = getGitHubOAuthConfig();
  if (!clientId || !callbackUrl) {
    const error = missing.length > 0 ? `github_oauth_not_configured:${missing.join("_")}` : "github_oauth_not_configured";
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error)}`, request.url));
  }

  const state = crypto.randomUUID();

  // Store state in a short-lived cookie for CSRF validation
  const cookieStore = await cookies();
  cookieStore.set("cvz_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    scope: "read:user user:email",
    state,
  });

  return NextResponse.redirect(`https://github.com/login/oauth/authorize?${params}`);
}
