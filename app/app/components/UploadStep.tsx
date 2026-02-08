"use client";

import { useState, useCallback, useEffect } from "react";
import { PdfFile, UseCase } from "../types";
import { PdfIcon, CheckIcon, ArrowRightIcon, ShieldIcon } from "./Icons";
import StepIndicator from "./StepIndicator";

interface UploadStepProps {
  useCase: UseCase;
  onUploaded: (file: PdfFile) => void;
  onContinue: () => void;
  pdfFile: PdfFile | null;
}

type PreflightStatus = "idle" | "checking" | "done" | "error";

interface PdfInfo {
  pageCount: number;
  hasSig: boolean;
  signerName?: string;
  title?: string;
  author?: string;
  creationDate?: string;
}

export default function UploadStep({ useCase, onUploaded, onContinue, pdfFile }: UploadStepProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [preflight, setPreflight] = useState<PreflightStatus>("idle");
  const [pdfInfo, setPdfInfo] = useState<PdfInfo | null>(null);

  // Fetch real PDF metadata after upload
  useEffect(() => {
    if (!pdfFile) {
      setPreflight("idle");
      setPdfInfo(null);
      return;
    }
    let cancelled = false;
    setPreflight("checking");

    (async () => {
      try {
        const res = await fetch(`/api/pdf-info?filename=${encodeURIComponent(pdfFile.serverName)}`);
        if (cancelled) return;
        if (!res.ok) throw new Error("Failed to read PDF");
        const info: PdfInfo = await res.json();
        setPdfInfo(info);
        setPreflight("done");
      } catch {
        if (!cancelled) setPreflight("error");
      }
    })();

    return () => { cancelled = true; };
  }, [pdfFile]);

  const uploadPdf = useCallback(
    async (file: File) => {
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

        if (!res.ok) throw new Error(data.error || "Upload failed");

        onUploaded({ name: file.name, size: data.size, serverName: data.filename });
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [onUploaded]
  );

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

  const handleReplace = () => {
    document.getElementById("file-input-replace")?.click();
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const nextLabel = useCase.sources.includes("passport")
    ? "Continue to identity scan"
    : "Generate proof";

  return (
    <div className="animate-fadeInUp">
      <StepIndicator
        label="Upload Document"
        sublabel="Drop or select a digitally signed PDF to verify."
      />

      {!pdfFile ? (
        /* ---- Drop zone ---- */
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById("file-input")?.click()}
          className={`upload-zone relative p-16 text-center cursor-pointer transition-colors ${
            dragOver ? "bg-ink-bright/5" : ""
          }`}
        >
          <svg className="upload-zone-border" width="100%" height="100%" preserveAspectRatio="none">
            <rect
              x="0.5" y="0.5"
              width="99%" height="99%"
              fill="none"
              stroke={dragOver ? "#f5f5f5" : "#2a2a2a"}
              strokeWidth="1"
              className="transition-[stroke] duration-200"
            />
          </svg>
          <input
            id="file-input"
            type="file"
            accept=".pdf"
            onChange={handleFileInput}
            className="hidden"
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border border-ink-border-strong rounded-full border-t-ink-subtle animate-spin" />
              <p className="font-mono text-[15px] text-ink-subtle">Uploading...</p>
            </div>
          ) : (
            <>
              <PdfIcon className="w-8 h-8 text-ink-muted mx-auto mb-4" />
              <p className="font-mono text-[15px] text-ink-text mb-2">Drop a signed PDF here</p>
              <p className="font-mono text-[13px] text-ink-muted">or click to browse</p>
            </>
          )}
        </div>
      ) : (
        /* ---- Post-upload: file card + preflight + action ---- */
        <div className="space-y-3 animate-fadeInUp">
          {/* File card */}
          <div className="border border-ink-border bg-ink-surface/80 p-4">
            <div className="flex items-start gap-3">
              {/* File icon */}
              <div className="w-10 h-10 border border-ink-border-strong bg-ink-bg flex items-center justify-center shrink-0 rounded-[3px]">
                <PdfIcon className="w-4 h-4 text-ink-subtle" />
              </div>

              {/* File info */}
              <div className="flex-1 min-w-0">
                <p className="font-mono text-[15px] text-ink-bright truncate leading-tight">{pdfFile.name}</p>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="font-mono text-[13px] text-ink-muted">{formatBytes(pdfFile.size)}</span>
                  <span className="text-ink-muted">|</span>
                  <span className="font-mono text-[13px] text-ink-muted">PDF</span>
                </div>
              </div>

              {/* Replace button */}
              <button
                onClick={handleReplace}
                className="font-mono text-[12px] text-ink-muted hover:text-ink-subtle uppercase tracking-wider transition-colors px-2 py-1 border border-transparent hover:border-ink-border-strong rounded-[3px]"
              >
                Replace
              </button>
              <input
                id="file-input-replace"
                type="file"
                accept=".pdf"
                onChange={handleFileInput}
                className="hidden"
              />
            </div>
          </div>

          {/* Preflight checks */}
          <div className="border border-ink-border bg-ink-surface/40 p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <ShieldIcon className="w-3 h-3 text-ink-border-strong" />
              <span className="font-mono text-[12px] text-ink-muted uppercase tracking-[0.15em]">Pre-flight checks</span>
            </div>

            {/* Signature detection */}
            <div className="flex items-center justify-between">
              <span className="font-mono text-[13px] text-ink-muted">Digital signature</span>
              {preflight === "checking" ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                  <span className="font-mono text-[13px] text-yellow-400">Checking...</span>
                </span>
              ) : preflight === "done" && pdfInfo ? (
                pdfInfo.hasSig ? (
                  <span className="flex items-center gap-1.5">
                    <CheckIcon className="w-3 h-3 text-green-400" />
                    <span className="font-mono text-[13px] text-green-400">Detected</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    <span className="font-mono text-[13px] text-red-400">Not found</span>
                  </span>
                )
              ) : preflight === "error" ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  <span className="font-mono text-[13px] text-red-400">Read error</span>
                </span>
              ) : null}
            </div>

            {/* Document integrity */}
            <div className="flex items-center justify-between">
              <span className="font-mono text-[13px] text-ink-muted">Document integrity</span>
              {preflight === "checking" ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                  <span className="font-mono text-[13px] text-yellow-400">Verifying...</span>
                </span>
              ) : preflight === "done" ? (
                <span className="flex items-center gap-1.5">
                  <CheckIcon className="w-3 h-3 text-green-400" />
                  <span className="font-mono text-[13px] text-green-400">Intact</span>
                </span>
              ) : preflight === "error" ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  <span className="font-mono text-[13px] text-red-400">Failed</span>
                </span>
              ) : null}
            </div>

            {/* PDF metadata details */}
            {preflight === "done" && pdfInfo && (
              <div className="pt-2 border-t border-ink-border space-y-2 animate-fadeInUp">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[13px] text-ink-muted">Pages</span>
                  <span className="font-mono text-[13px] text-ink-subtle">{pdfInfo.pageCount}</span>
                </div>
                {pdfInfo.signerName && (
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[13px] text-ink-muted">Signer</span>
                    <span className="font-mono text-[13px] text-ink-subtle">{pdfInfo.signerName}</span>
                  </div>
                )}
                {pdfInfo.author && (
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[13px] text-ink-muted">Author</span>
                    <span className="font-mono text-[13px] text-ink-subtle">{pdfInfo.author}</span>
                  </div>
                )}
              </div>
            )}

            {/* Checks that will run */}
            {useCase.checks.length > 0 && preflight === "done" && pdfInfo?.hasSig && (
              <div className="pt-2 border-t border-ink-border animate-fadeInUp">
                <span className="font-mono text-[12px] text-ink-muted uppercase tracking-[0.12em]">
                  Will verify
                </span>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {useCase.checks.map((check) => (
                    <span
                      key={check}
                      className="font-mono text-[12px] text-ink-subtle border border-ink-border bg-ink-bg px-2 py-0.5 rounded-[2px]"
                    >
                      {check}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Continue button */}
          <button
            onClick={onContinue}
            disabled={preflight !== "done"}
            className={`w-full py-3 font-mono text-[15px] flex items-center justify-center gap-2 group transition-all duration-200 ${
              preflight === "done"
                ? "border border-green-400/30 bg-green-400/5 text-ink-text hover:text-ink-bright hover:border-green-400/50 hover:bg-green-400/10"
                : "border border-ink-border text-ink-muted cursor-not-allowed"
            }`}
          >
            <span>{nextLabel}</span>
            <ArrowRightIcon className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
          </button>
        </div>
      )}

      {uploadError && (
        <p className="font-mono text-xs text-red-400 mt-3">{uploadError}</p>
      )}
    </div>
  );
}
