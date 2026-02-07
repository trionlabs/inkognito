"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  SelfQRcodeWrapper,
  SelfAppBuilder,
  type SelfApp,
} from "@selfxyz/qrcode";

type Step = "upload" | "scan" | "proving" | "done";

interface ProveResult {
  explorerUrl: string;
  requestId: string;
  identity?: {
    surname?: string;
    given_name?: string;
    nationality?: string;
    date_of_birth?: string;
    older_than?: number;
    attestation_id?: number;
  };
}

export default function Home() {
  const [step, setStep] = useState<Step>("upload");
  const [selfApp, setSelfApp] = useState<SelfApp | null>(null);

  // PDF state
  const [pdfFile, setPdfFile] = useState<{ name: string; size: number; serverName: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Proof state
  const [proofError, setProofError] = useState<string | null>(null);
  const [provingStatus, setProvingStatus] = useState<string>("");
  const [proveResult, setProveResult] = useState<ProveResult | null>(null);
  const [proveError, setProveError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const app = new SelfAppBuilder({
        appName: "SP1 zkPDF + Self ID",
        scope: "sp1-zkpdf-selfid",
        endpoint:
          process.env.NEXT_PUBLIC_SELF_ENDPOINT ||
          "http://localhost:3000/api/verify",
        logoBase64: "https://i.postimg.cc/mrmVf9hm/self.png",
        userId: "0x0000000000000000000000000000000000000000",
        userIdType: "hex",
        endpointType: "staging_https",
        version: 2,
        disclosures: {
          nationality: true,
          name: true,
          date_of_birth: true,
          expiry_date: true,
          minimumAge: 18,
        },
      }).build();
      setSelfApp(app);
    } catch (error) {
      console.error("[ERROR]: Failed to initialize Self app:", error);
    }
  }, []);

  const uploadPdf = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setUploadError("Only PDF files are accepted");
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Upload failed");
      }

      setPdfFile({ name: file.name, size: data.size, serverName: data.filename });
      setStep("scan");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) uploadPdf(file);
    },
    [uploadPdf]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) uploadPdf(file);
    },
    [uploadPdf]
  );

  const handleGenerateProof = useCallback(async () => {
    if (!pdfFile) return;

    setStep("proving");
    setProveError(null);
    setProvingStatus("Finding latest proof...");

    try {
      // Get latest proof file
      const latestRes = await fetch("/api/latest-proof");
      const latestData = await latestRes.json();
      if (!latestRes.ok) throw new Error(latestData.error || "No proof found");

      setProvingStatus("Converting proof & submitting to Succinct network...");

      // Submit to prove pipeline
      const proveRes = await fetch("/api/prove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proofFile: latestData.filename,
          pdfFile: pdfFile.serverName,
        }),
      });

      const proveData = await proveRes.json();
      if (!proveRes.ok) throw new Error(proveData.error || "Proving failed");

      setProveResult(proveData);
      setStep("done");
    } catch (err) {
      setProveError(err instanceof Error ? err.message : "Proving failed");
      setStep("done");
    }
  }, [pdfFile]);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-lg w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">SP1 zkPDF + Self ID</h1>
          <p className="text-gray-400 mt-2">
            Upload a signed PDF, scan your ID, verify in zero knowledge
          </p>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-2 text-sm">
          <span className={step === "upload" ? "text-white font-medium" : "text-green-400"}>
            {step !== "upload" ? "1. PDF uploaded" : "1. Upload PDF"}
          </span>
          <span className="text-gray-600">{">"}</span>
          <span className={step === "scan" ? "text-white font-medium" : step === "upload" ? "text-gray-600" : "text-green-400"}>
            {step === "upload" || step === "scan" ? "2. Scan ID" : "2. ID scanned"}
          </span>
          <span className="text-gray-600">{">"}</span>
          <span className={step === "proving" ? "text-yellow-400 font-medium" : step === "done" ? "text-green-400" : "text-gray-600"}>
            {step === "proving" ? "3. Proving..." : step === "done" ? "3. Done" : "3. Prove"}
          </span>
        </div>

        {/* Step 1: Upload PDF */}
        {step === "upload" && (
          <div>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer ${
                dragOver
                  ? "border-blue-400 bg-blue-900/20"
                  : "border-gray-700 hover:border-gray-500"
              }`}
              onClick={() => document.getElementById("file-input")?.click()}
            >
              <input
                id="file-input"
                type="file"
                accept=".pdf"
                onChange={handleFileInput}
                className="hidden"
              />
              {uploading ? (
                <p className="text-gray-400">Uploading...</p>
              ) : (
                <>
                  <p className="text-gray-300 text-lg mb-2">
                    Drop a signed PDF here
                  </p>
                  <p className="text-gray-500 text-sm">or click to browse</p>
                </>
              )}
            </div>
            {uploadError && (
              <p className="text-red-400 text-sm mt-3">{uploadError}</p>
            )}
          </div>
        )}

        {/* Step 2: Scan ID */}
        {step === "scan" && (
          <div className="space-y-4">
            {pdfFile && (
              <div className="flex items-center gap-3 p-3 bg-green-900/30 border border-green-800 rounded-lg text-sm">
                <span className="text-green-400">PDF</span>
                <span className="text-gray-300 truncate flex-1">{pdfFile.name}</span>
                <span className="text-gray-500">{formatBytes(pdfFile.size)}</span>
              </div>
            )}

            <p className="text-center text-gray-400">
              Scan the QR code with the Self app
            </p>

            <div className="flex justify-center">
              {selfApp ? (
                <SelfQRcodeWrapper
                  selfApp={selfApp}
                  onSuccess={() => {
                    console.log("[INFO]: Verification successful, proof captured");
                    handleGenerateProof();
                  }}
                  onError={(data) => {
                    setProofError("Verification failed. Try again.");
                    console.error("[ERROR]: Verification error:", data);
                  }}
                  size={300}
                  darkMode={true}
                />
              ) : (
                <div className="w-[300px] h-[300px] bg-gray-800 rounded-lg flex items-center justify-center">
                  <p className="text-gray-500">Loading QR Code...</p>
                </div>
              )}
            </div>

            {proofError && (
              <p className="text-red-400 text-sm text-center">{proofError}</p>
            )}
          </div>
        )}

        {/* Step 3: Proving */}
        {step === "proving" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-3 bg-green-900/30 border border-green-800 rounded-lg text-sm">
                <span className="text-green-400">PDF</span>
                <span className="text-gray-300 truncate flex-1">{pdfFile?.name}</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-green-900/30 border border-green-800 rounded-lg text-sm">
                <span className="text-green-400">ID</span>
                <span className="text-gray-300">Identity proof captured</span>
              </div>
            </div>

            <div className="p-6 bg-gray-900 border border-gray-800 rounded-lg text-center space-y-3">
              <div className="flex justify-center">
                <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="text-yellow-400 font-medium">Generating ZK Proof</p>
              <p className="text-gray-500 text-sm">{provingStatus}</p>
              <p className="text-gray-600 text-xs">This may take a minute...</p>
            </div>
          </div>
        )}

        {/* Step 4: Done */}
        {step === "done" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-3 bg-green-900/30 border border-green-800 rounded-lg text-sm">
                <span className="text-green-400">PDF</span>
                <span className="text-gray-300 truncate flex-1">{pdfFile?.name}</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-green-900/30 border border-green-800 rounded-lg text-sm">
                <span className="text-green-400">ID</span>
                <span className="text-gray-300">Identity proof captured</span>
              </div>
            </div>

            {proveResult && (
              <div className="p-4 bg-green-900/30 border border-green-700 rounded-lg space-y-3">
                <p className="text-green-400 font-medium">Proof submitted to Succinct network</p>

                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-500">Explorer: </span>
                    <a
                      href={proveResult.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 underline break-all"
                    >
                      {proveResult.explorerUrl}
                    </a>
                  </div>
                  <div>
                    <span className="text-gray-500">Request ID: </span>
                    <code className="text-gray-300 text-xs break-all">{proveResult.requestId}</code>
                  </div>
                </div>

                {proveResult.identity && (
                  <div className="mt-3 pt-3 border-t border-green-800 space-y-1 text-sm">
                    <p className="text-gray-400 font-medium mb-2">Decoded Identity</p>
                    {proveResult.identity.surname && (
                      <div><span className="text-gray-500">Name: </span><span className="text-gray-300">{proveResult.identity.given_name} {proveResult.identity.surname}</span></div>
                    )}
                    {proveResult.identity.nationality && (
                      <div><span className="text-gray-500">Nationality: </span><span className="text-gray-300">{proveResult.identity.nationality}</span></div>
                    )}
                    {proveResult.identity.date_of_birth && (
                      <div><span className="text-gray-500">DOB: </span><span className="text-gray-300">{proveResult.identity.date_of_birth}</span></div>
                    )}
                    {proveResult.identity.older_than !== undefined && (
                      <div><span className="text-gray-500">Older than: </span><span className="text-gray-300">{proveResult.identity.older_than}</span></div>
                    )}
                  </div>
                )}
              </div>
            )}

            {proveError && (
              <div className="p-4 bg-red-900/30 border border-red-700 rounded-lg">
                <p className="text-red-400 font-medium">Proof generation failed</p>
                <p className="text-red-500 text-sm mt-1">{proveError}</p>
              </div>
            )}

            <button
              onClick={() => {
                setStep("upload");
                setPdfFile(null);
                setProofError(null);
                setUploadError(null);
                setProveResult(null);
                setProveError(null);
                setProvingStatus("");
              }}
              className="w-full py-2 text-sm text-gray-400 hover:text-white border border-gray-800 hover:border-gray-600 rounded-lg transition-colors"
            >
              Start over
            </button>
          </div>
        )}

        <div className="text-xs text-gray-600 text-center">
          <p>Endpoint: {process.env.NEXT_PUBLIC_SELF_ENDPOINT || "http://localhost:3000/api/verify"}</p>
        </div>
      </div>
    </main>
  );
}
