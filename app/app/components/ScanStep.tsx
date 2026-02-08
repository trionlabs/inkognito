"use client";

import { useState, useEffect } from "react";
import {
  SelfQRcodeWrapper,
  type SelfApp,
} from "@selfxyz/qrcode";
import { PdfFile } from "../types";
import { CheckIcon } from "./Icons";
import StepIndicator from "./StepIndicator";

interface ScanStepProps {
  selfApp: SelfApp | null;
  pdfFile: PdfFile | null;
  onSuccess: () => void;
  onBack: () => void;
}

export default function ScanStep({ selfApp, pdfFile, onSuccess, onBack }: ScanStepProps) {
  const [proofError, setProofError] = useState<string | null>(null);
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    setShowFallback(false);
    const timer = setTimeout(() => setShowFallback(true), 15000);
    return () => clearTimeout(timer);
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="animate-fadeInUp">
      <StepIndicator label="Identity Scan" sublabel="Scan with the Self app to verify your passport." />

      <div className="space-y-6">
        {pdfFile && (
          <div className="border border-green-400/30 bg-green-400/5 p-3 flex items-center gap-3 success-glow">
            <CheckIcon className="w-3.5 h-3.5 text-green-400 shrink-0" />
            <span className="font-mono text-[13px] text-ink-text truncate flex-1">{pdfFile.name}</span>
            <span className="font-mono text-[12px] text-ink-muted">{formatBytes(pdfFile.size)}</span>
          </div>
        )}

        <p className="font-mono text-[13px] text-ink-subtle text-center">
          Scan the QR code with the Self app
        </p>

        <div className="flex justify-center">
          {selfApp ? (
            <SelfQRcodeWrapper
              selfApp={selfApp}
              onSuccess={() => {
                console.log("[INFO]: Verification successful, proof captured");
                onSuccess();
              }}
              onError={(data) => {
                const reason = data?.reason || data?.error_code || "Unknown error";
                setProofError(`Verification failed: ${reason}`);
                console.error("[ERROR]: Verification error:", data);
              }}
              size={280}
              darkMode={true}
            />
          ) : (
            <div className="w-[280px] h-[280px] border border-ink-border flex items-center justify-center">
              <p className="font-mono text-[13px] text-ink-muted">Loading QR Code...</p>
            </div>
          )}
        </div>

        {showFallback && !proofError && (
          <div className="flex justify-center animate-fadeInUp">
            <button
              onClick={onSuccess}
              className="font-mono text-[12px] text-ink-muted hover:text-ink-subtle border border-ink-border hover:border-ink-border-strong px-4 py-2 transition-all duration-200 uppercase tracking-[0.12em]"
            >
              Verification complete? Continue &rarr;
            </button>
          </div>
        )}

        {proofError && (
          <div className="space-y-3">
            <p className="font-mono text-[13px] text-red-400 text-center">{proofError}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setProofError(null)}
                className="border border-ink-border-strong hover:border-ink-subtle px-4 py-2 font-mono text-[12px] text-ink-subtle hover:text-ink-bright transition-all duration-200 uppercase tracking-[0.15em]"
              >
                Try again
              </button>
              <button
                onClick={onBack}
                className="border border-ink-border hover:border-ink-subtle px-4 py-2 font-mono text-[12px] text-ink-muted hover:text-ink-bright transition-all duration-200 uppercase tracking-[0.15em]"
              >
                Go back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
