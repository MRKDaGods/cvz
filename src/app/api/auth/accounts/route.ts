import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accounts = user.accounts.map((a) => ({
    id: a.id,
    githubUsername: a.githubUsername,
    avatarUrl: a.avatarUrl,
    isActive: a.isActive,
  }));

  return NextResponse.json({ accounts });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { accountId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { accountId } = body;
  if (!accountId) {
    return NextResponse.json({ error: "Missing accountId" }, { status: 400 });
  }

  // Verify the account belongs to this user
  const account = user.accounts.find((a) => a.id === accountId);
  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  // Deactivate all, activate selected
  await db.account.updateMany({
    where: { userId: user.id },
    data: { isActive: false },
  });
  await db.account.update({
    where: { id: accountId },
    data: { isActive: true },
  });

  return NextResponse.json({ ok: true });
}
