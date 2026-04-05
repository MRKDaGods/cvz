import { PDFParse } from "pdf-parse";

interface HyperlinkInfo {
  url: string;
  text: string;
}

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc = await (parser as any).load();
    let fullText = "";
    const allLinks: HyperlinkInfo[] = [];

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);

      // Extract text
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((item: any) => item.str != null)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((item: any) => item.str)
        .join("");
      fullText += pageText + "\n\n";

      // Extract hyperlinks (annotations)
      const annotations = (await page.getAnnotations({ intent: "display" })) || [];
      for (const ann of annotations) {
        if (ann.subtype !== "Link") continue;
        const url = ann.url ?? ann.unsafeUrl;
        if (!url) continue;
        const label = ann.overlaidText || "";
        // Only capture links where URL differs from visible text
        if (url && url !== label) {
          allLinks.push({ url, text: label });
        }
      }

      page.cleanup();
    }

    // Append discovered hyperlinks so the LLM can see actual URLs
    if (allLinks.length > 0) {
      fullText += "\n--- Hyperlinks ---\n";
      for (const link of allLinks) {
        if (link.text) {
          fullText += `${link.text}: ${link.url}\n`;
        } else {
          fullText += `${link.url}\n`;
        }
      }
    }

    return fullText.trim();
  } finally {
    await parser.destroy();
  }
}
