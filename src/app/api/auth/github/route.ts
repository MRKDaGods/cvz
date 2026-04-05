import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const callbackUrl = process.env.GITHUB_CALLBACK_URL;
  if (!clientId || !callbackUrl) {
    return NextResponse.json({ error: "GitHub OAuth not configured" }, { status: 500 });
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
