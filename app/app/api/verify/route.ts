import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { attestationId, proof, publicSignals } = body;

    if (!proof || !publicSignals) {
      console.warn("[WARNING]: proof or publicSignals missing from body");
      return NextResponse.json({ status: "error", result: false, message: "Missing proof or publicSignals" }, { status: 200 });
    }

    const timestamp = Date.now();
    const proofId = `${attestationId || "unknown"}_${timestamp}`;

    const proofsDir = join(process.cwd(), "..", "proofs");
    await mkdir(proofsDir, { recursive: true });

    const proofPath = join(proofsDir, `${proofId}.json`);
    await writeFile(proofPath, JSON.stringify({ attestationId, proof, publicSignals }, null, 2));
    console.log(`[INFO]: Proof saved: ${proofPath}`);

    return NextResponse.json({ status: "success", result: true, proofId });
  } catch (error) {
    console.error("[ERROR]: Error capturing proof:", error);
    return NextResponse.json(
      { status: "error", result: false, message: error instanceof Error ? error.message : "Unknown error" },
      { status: 200 }
    );
  }
}
