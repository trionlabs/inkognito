import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { join, basename } from "path";
import { readFile } from "fs/promises";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const ROOT = join(process.cwd(), "..");

export async function POST(req: Request) {
  try {
    const { proofFile, pdfFile } = await req.json();

    if (!proofFile) {
      return NextResponse.json(
        { error: "proofFile is required" },
        { status: 400 }
      );
    }

    // Sanitize filenames to prevent path traversal
    const safeProofFile = basename(proofFile);

    const proofPath = join(ROOT, "proofs", safeProofFile);
    const pdfPath = pdfFile ? join(ROOT, "uploads", basename(pdfFile)) : null;
    const gnarkDir = join(ROOT, "gnark-out");
    const self2gnarkBin = join(ROOT, "self2gnark", "self2gnark");
    const proveBin = join(ROOT, "sp1", "target", "release", "prove");

    // Step 1: Convert Self proof to gnark format
    console.log(`[PROVE] Converting proof: ${proofFile}`);
    const { stdout: convertOut, stderr: convertErr } = await execFileAsync(
      self2gnarkBin,
      ["--proof", proofPath, "--export-gnark", gnarkDir, "--decode"],
      { timeout: 30_000 }
    );
    if (convertErr) console.log(`[PROVE] self2gnark stderr: ${convertErr}`);
    console.log(`[PROVE] self2gnark stdout: ${convertOut}`);

    // Read decoded identity if available
    let identity = null;
    try {
      const identityJson = await readFile(join(gnarkDir, "identity.json"), "utf-8");
      identity = JSON.parse(identityJson);
    } catch {
      // identity.json may not exist if decode failed
    }

    // Step 2: Submit to Succinct prover network
    console.log(`[PROVE] Submitting to Succinct network...`);
    const proveArgs = [
      "--prove",
      "--network",
      "--gnark-dir", gnarkDir,
      ...(pdfPath ? ["--pdf", pdfPath] : []),
    ];

    const { stdout: proveOut, stderr: proveErr } = await execFileAsync(
      proveBin,
      proveArgs,
      {
        timeout: 120_000,
        env: { ...process.env, RUST_LOG: "info" },
      }
    );
    if (proveErr) console.log(`[PROVE] prove stderr: ${proveErr}`);
    console.log(`[PROVE] prove stdout: ${proveOut}`);

    // Parse JSON output from prove binary
    const jsonMatch = proveOut.match(
      /---JSON_OUTPUT_START---\s*([\s\S]*?)\s*---JSON_OUTPUT_END---/
    );

    if (!jsonMatch) {
      console.error("[PROVE] Failed to parse JSON output from prove binary");
      return NextResponse.json(
        { error: "Failed to parse prove output", stdout: proveOut, stderr: proveErr },
        { status: 500 }
      );
    }

    const result = JSON.parse(jsonMatch[1]);

    return NextResponse.json({
      explorerUrl: result.explorer_url,
      requestId: result.request_id,
      identity,
    });
  } catch (error) {
    console.error("[ERROR]: Prove pipeline failed:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    const stderr = (error as { stderr?: string })?.stderr || "";
    return NextResponse.json(
      { error: msg, stderr },
      { status: 500 }
    );
  }
}
