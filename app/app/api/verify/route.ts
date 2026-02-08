import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log(
      "[VERIFY] Received body keys:",
      Object.keys(body),
      "attestationId:",
      body.attestationId
    );

    const { attestationId, proof, publicSignals } = body;

    if (!proof || !publicSignals) {
      console.warn("[VERIFY] Missing required fields");
      return NextResponse.json(
        { status: "error", result: false, reason: "Missing proof or publicSignals" },
        { status: 200 }
      );
    }

    // Save proof for gnark/SP1 pipeline
    const timestamp = Date.now();
    const proofId = `${attestationId || "unknown"}_${timestamp}`;
    const proofsDir = join(process.cwd(), "..", "proofs");
    await mkdir(proofsDir, { recursive: true });
    const proofPath = join(proofsDir, `${proofId}.json`);
    await writeFile(
      proofPath,
      JSON.stringify({ attestationId, proof, publicSignals }, null, 2)
    );
    console.log(`[VERIFY] Proof saved: ${proofPath}`);

    return NextResponse.json({ status: "success", result: true, proofId });
  } catch (error) {
    console.error("[VERIFY] Error:", error);
    return NextResponse.json(
      {
        status: "error",
        result: false,
        reason: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 200 }
    );
  }
}
