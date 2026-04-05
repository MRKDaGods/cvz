import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const session = await db.session.findUnique({
    where: { id, userId: user.id },
    include: { sections: { orderBy: { order: "asc" } }, scores: true },
  });

  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(session);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await db.session.findUnique({
    where: { id, userId: user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const allowedFields = [
    "title",
    "stage",
    "jobDesc",
    "templateId",
    "latexSource",
    "pdfPath",
  ] as const;

  const data: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (field in body) {
      data[field] = body[field];
    }
  }

  const updated = await db.session.update({
    where: { id },
    data,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await db.session.findUnique({
    where: { id, userId: user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.session.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
