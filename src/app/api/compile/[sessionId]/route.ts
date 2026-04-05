import { NextRequest, NextResponse } from "next/server";
import { verifySessionOwner } from "@/lib/auth/session";
import { getPdfPath } from "@/lib/latex/compiler";
import fs from "fs/promises";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  if (!(await verifySessionOwner(sessionId))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pdfPath = await getPdfPath(sessionId);

  if (!pdfPath) {
    return NextResponse.json({ error: "PDF not found" }, { status: 404 });
  }

  const pdfBuffer = await fs.readFile(pdfPath);

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="cv-${sessionId}.pdf"`,
    },
  });
}
