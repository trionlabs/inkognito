import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { error: "Only PDF files are accepted" },
        { status: 400 }
      );
    }

    const uploadsDir = join(process.cwd(), "..", "uploads");
    await mkdir(uploadsDir, { recursive: true });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const timestamp = Date.now();
    const filename = `${timestamp}_${file.name}`;
    const filepath = join(uploadsDir, filename);
    await writeFile(filepath, buffer);

    console.log(`[INFO]: PDF uploaded: ${filepath} (${buffer.length} bytes)`);

    return NextResponse.json({
      filename,
      size: buffer.length,
      path: filepath,
    });
  } catch (error) {
    console.error("[ERROR]: Upload failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
