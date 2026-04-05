import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessions = await db.session.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      title: true,
      stage: true,
      templateId: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(sessions);
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const title = body.title || "Untitled";

  const session = await db.session.create({
    data: {
      userId: user.id,
      title,
    },
  });

  return NextResponse.json(session, { status: 201 });
}
