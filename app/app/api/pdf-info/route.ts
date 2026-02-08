import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { PDFDocument, PDFName } from "pdf-lib";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const filename = searchParams.get("filename");

    if (!filename) {
      return NextResponse.json({ error: "Missing filename parameter" }, { status: 400 });
    }

    // Prevent path traversal
    if (filename.includes("..") || filename.includes("/")) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    const uploadsDir = join(process.cwd(), "..", "uploads");
    const filepath = join(uploadsDir, filename);
    const bytes = await readFile(filepath);

    const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pageCount = pdfDoc.getPageCount();

    // Extract metadata
    const title = pdfDoc.getTitle() || undefined;
    const author = pdfDoc.getAuthor() || undefined;
    const creationDate = pdfDoc.getCreationDate()?.toISOString() || undefined;

    // Check for digital signatures by scanning AcroForm fields
    let hasSig = false;
    let signerName: string | undefined;

    try {
      const form = pdfDoc.getForm();
      const fields = form.getFields();
      for (const field of fields) {
        const dict = field.acroField.dict;
        const ftEntry = dict.get(PDFName.of("FT"));
        if (ftEntry && ftEntry.toString().includes("Sig")) {
          hasSig = true;
          break;
        }
      }
    } catch {
      // No AcroForm present — fall through to raw byte scan
    }

    // If no AcroForm sig found, scan raw PDF bytes for signature markers
    if (!hasSig) {
      const rawStr = bytes.toString("latin1");
      if (rawStr.includes("/Type /Sig") || rawStr.includes("/SubFilter /adbe.pkcs7")) {
        hasSig = true;
      }
    }

    // Try to extract signer name from raw bytes
    if (hasSig && !signerName) {
      const rawStr = bytes.toString("latin1");
      const nameMatch = rawStr.match(/\/Name\s*\(([^)]+)\)/);
      if (nameMatch) {
        signerName = nameMatch[1];
      }
    }

    return NextResponse.json({
      pageCount,
      hasSig,
      signerName,
      title,
      author,
      creationDate,
    });
  } catch (error) {
    console.error("[ERROR]: PDF info extraction failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to read PDF info" },
      { status: 500 }
    );
  }
}
