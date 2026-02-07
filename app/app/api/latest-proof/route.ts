import { NextResponse } from "next/server";
import { readdir, stat } from "fs/promises";
import { join } from "path";

export async function GET() {
  try {
    const proofsDir = join(process.cwd(), "..", "proofs");
    const files = await readdir(proofsDir);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));

    if (jsonFiles.length === 0) {
      return NextResponse.json({ error: "No proof files found" }, { status: 404 });
    }

    // Find most recently modified
    let latest = { name: "", mtime: 0 };
    for (const file of jsonFiles) {
      const s = await stat(join(proofsDir, file));
      if (s.mtimeMs > latest.mtime) {
        latest = { name: file, mtime: s.mtimeMs };
      }
    }

    return NextResponse.json({ filename: latest.name });
  } catch (error) {
    console.error("[ERROR]: Failed to list proofs:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list proofs" },
      { status: 500 }
    );
  }
}
