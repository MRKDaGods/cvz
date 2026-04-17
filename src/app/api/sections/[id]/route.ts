import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Verify ownership through session
  const section = await db.cvSection.findUnique({
    where: { id },
    include: { session: { select: { userId: true } } },
  });

  if (!section || section.session.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const allowedFields = [
    "title",
    "optimizedContent",
    "aiComments",
  ] as const;

  const data: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (field in body) {
      data[field] = field === "aiComments"
        ? JSON.stringify(body[field])
        : body[field];
    }
  }

  const updated = await db.cvSection.update({
    where: { id },
    data,
  });

  return NextResponse.json(updated);
}
