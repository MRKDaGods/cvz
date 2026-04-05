import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/auth/crypto";
import { createSession } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=no_code", request.url));
  }

  // Validate OAuth state to prevent CSRF
  const cookieStore = await cookies();
  const savedState = cookieStore.get("cvz_oauth_state")?.value;
  cookieStore.delete("cvz_oauth_state");

  if (!state || !savedState || state !== savedState) {
    return NextResponse.redirect(new URL("/login?error=invalid_state", request.url));
  }

  // Exchange code for access token
  let tokenData: Record<string, unknown>;
  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });
    if (!tokenRes.ok) {
      return NextResponse.redirect(new URL("/login?error=token_exchange_failed", request.url));
    }
    tokenData = await tokenRes.json();
  } catch {
    return NextResponse.redirect(new URL("/login?error=token_exchange_failed", request.url));
  }

  if (tokenData.error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(String(tokenData.error))}`, request.url)
    );
  }

  const accessToken = tokenData.access_token as string;

  // Fetch GitHub user profile
  let githubUser: Record<string, unknown>;
  try {
    const userRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!userRes.ok) {
      return NextResponse.redirect(new URL("/login?error=github_api_failed", request.url));
    }
    githubUser = await userRes.json();
  } catch {
    return NextResponse.redirect(new URL("/login?error=github_api_failed", request.url));
  }

  if (!githubUser.id) {
    return NextResponse.redirect(new URL("/login?error=invalid_user", request.url));
  }

  // Find or create user + account
  const githubId = String(githubUser.id);
  const username = String(githubUser.login);
  const avatarUrl = githubUser.avatar_url ? String(githubUser.avatar_url) : null;
  let account = await db.account.findUnique({ where: { githubId } });

  if (account) {
    // Update token
    await db.account.update({
      where: { id: account.id },
      data: {
        accessToken: encrypt(accessToken),
        githubUsername: username,
        avatarUrl,
      },
    });
    await createSession(account.userId);
  } else {
    // Check if there's a logged-in user (linking another account)
    // For now, create a new user per GitHub account
    const user = await db.user.create({
      data: {
        accounts: {
          create: {
            githubId,
            githubUsername: username,
            avatarUrl,
            accessToken: encrypt(accessToken),
            isActive: true,
          },
        },
      },
    });
    await createSession(user.id);
  }

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
