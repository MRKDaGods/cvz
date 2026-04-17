import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";

interface SectionPatchInput {
  id?: string;
  type: string;
  title: string;
  originalContent: string;
  optimizedContent: string | null;
  latexContent: string | null;
  aiComments: string | null;
  userNotes: string | null;
  order: number;
}

const STAGE_ORDER = ["upload", "review", "template", "optimize", "finalize"] as const;

function resolveMonotonicStage(currentStage: string, requestedStage: unknown): string | undefined {
  if (typeof requestedStage !== "string") {
    return undefined;
  }

  const currentIndex = STAGE_ORDER.indexOf(currentStage as (typeof STAGE_ORDER)[number]);
  const requestedIndex = STAGE_ORDER.indexOf(requestedStage as (typeof STAGE_ORDER)[number]);

  if (requestedIndex < 0) {
    return currentIndex >= 0 ? currentStage : undefined;
  }

  if (currentIndex < 0) {
    return requestedStage;
  }

  return STAGE_ORDER[Math.max(currentIndex, requestedIndex)];
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function normalizeSectionInput(value: unknown, index: number): SectionPatchInput | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const input = value as Record<string, unknown>;
  const aiCommentsRaw = input.aiComments;
  let aiComments: string | null = null;

  if (typeof aiCommentsRaw === "string") {
    aiComments = aiCommentsRaw;
  } else if (aiCommentsRaw != null) {
    try {
      aiComments = JSON.stringify(aiCommentsRaw);
    } catch {
      aiComments = null;
    }
  }

  const rawOrder = typeof input.order === "number" ? input.order : index;
  const safeOrder = Number.isFinite(rawOrder) ? Math.max(0, Math.floor(rawOrder)) : index;

  return {
    id: typeof input.id === "string" && input.id.trim() ? input.id : undefined,
    type: typeof input.type === "string" && input.type.trim() ? input.type : "other",
    title: typeof input.title === "string" ? input.title : "",
    originalContent: typeof input.originalContent === "string" ? input.originalContent : "",
    optimizedContent: toStringOrNull(input.optimizedContent),
    latexContent: toStringOrNull(input.latexContent),
    aiComments,
    userNotes: toStringOrNull(input.userNotes),
    order: safeOrder,
  };
}

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

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const allowedFields = [
    "title",
    "rawCvText",
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

  if ("stage" in body) {
    const nextStage = resolveMonotonicStage(existing.stage, body.stage);
    if (nextStage !== undefined) {
      data.stage = nextStage;
    }
  }

  const requestedSections = Array.isArray(body.sections)
    ? body.sections
    : null;
  const sections = requestedSections
    ? requestedSections
        .map((section, index) => normalizeSectionInput(section, index))
        .filter((section): section is SectionPatchInput => section !== null)
    : null;

  if (sections) {
    await db.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) {
        await tx.session.update({
          where: { id },
          data,
        });
      }

      const existingSections = await tx.cvSection.findMany({
        where: { sessionId: id },
        select: { id: true },
      });

      const existingIds = new Set(existingSections.map((section) => section.id));
      const incomingExistingIds = new Set(
        sections
          .map((section) => section.id)
          .filter((sectionId): sectionId is string => !!sectionId && existingIds.has(sectionId))
      );

      const staleIds = existingSections
        .map((section) => section.id)
        .filter((sectionId) => !incomingExistingIds.has(sectionId));

      if (staleIds.length > 0) {
        await tx.cvSection.deleteMany({
          where: { id: { in: staleIds }, sessionId: id },
        });
      }

      for (const section of sections) {
        const sectionData = {
          type: section.type,
          title: section.title,
          originalContent: section.originalContent,
          optimizedContent: section.optimizedContent,
          latexContent: section.latexContent,
          aiComments: section.aiComments,
          userNotes: section.userNotes,
          order: section.order,
        };

        if (section.id && existingIds.has(section.id)) {
          await tx.cvSection.update({
            where: { id: section.id },
            data: sectionData,
          });
        } else {
          await tx.cvSection.create({
            data: { ...sectionData, sessionId: id },
          });
        }
      }
    });

    const hydrated = await db.session.findUnique({
      where: { id, userId: user.id },
      include: { sections: { orderBy: { order: "asc" } }, scores: true },
    });

    if (!hydrated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(hydrated);
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
