import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { extractTextFromPdf } = await import("@/lib/pdf/parser");
    const text = await extractTextFromPdf(buffer);

    return NextResponse.json({ text });
  } catch (error) {
    console.error("parse-pdf error:", error);
    return NextResponse.json(
      { error: "Failed to parse PDF", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
