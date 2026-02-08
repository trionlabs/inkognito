"use client";

import { useState } from "react";
import { ProveResult, UseCase } from "../types";
import { ShieldIcon, ArrowRightIcon, CopyIcon } from "./Icons";
import StepIndicator from "./StepIndicator";

interface DoneStepProps {
  success: boolean;
  proveError: string | null;
  proveResult: ProveResult | null;
  networkStatus: string;
  useCase: UseCase | null;
  onReset: () => void;
}

function truncateId(id: string) {
  if (id.length <= 16) return id;
  return `${id.slice(0, 10)}...${id.slice(-6)}`;
}

function statusLabel(s: string) {
  if (s === "fulfilled") return "Fulfilled";
  if (s === "failed") return "Failed";
  if (s === "assigned") return "Proving...";
  return "Pending";
}

function statusColor(s: string) {
  if (s === "fulfilled") return "text-green-400";
  if (s === "failed") return "text-red-400";
  return "text-ink-muted";
}

function statusDotColor(s: string) {
  if (s === "fulfilled") return "bg-green-400";
  if (s === "failed") return "bg-red-400";
  return "bg-ink-muted animate-pulse";
}

export default function DoneStep({ success, proveError, proveResult, networkStatus, useCase, onReset }: DoneStepProps) {
  const identity = proveResult?.identity;
  const [copied, setCopied] = useState(false);

  const copyRequestId = () => {
    if (!proveResult?.requestId) return;
    navigator.clipboard.writeText(proveResult.requestId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="animate-fadeInUp">
      <StepIndicator label="Results" sublabel="Your proof has been generated and submitted." />

      <div className="space-y-6">
        {success && proveResult ? (
          <>
            {/* Verified Identity Card */}
            {identity ? (
              <div className="border border-ink-border border-l-green-400/40 bg-ink-surface/60 animate-fadeInUp">
                {/* VERIFIED header */}
                <div className="px-6 py-4 border-b border-ink-border flex items-center gap-3">
                  <ShieldIcon className="w-3.5 h-3.5 text-green-400" />
                  <span className="font-mono text-sm uppercase tracking-[0.25em] text-green-400">
                    Verified
                  </span>
                </div>

                {/* Identity data grid */}
                <div className="px-6 py-5 grid grid-cols-2 gap-x-8 gap-y-5">
                  {identity.given_name && (
                    <div>
                      <p className="font-mono text-sm text-ink-muted uppercase tracking-[0.15em] mb-1.5">Name</p>
                      <p className="font-mono text-base text-ink-bright">
                        {identity.given_name} {identity.surname}
                      </p>
                    </div>
                  )}
                  {identity.nationality && (
                    <div>
                      <p className="font-mono text-sm text-ink-muted uppercase tracking-[0.15em] mb-1.5">Nationality</p>
                      <p className="font-mono text-base text-ink-bright">{identity.nationality}</p>
                    </div>
                  )}
                  {identity.dob && (
                    <div>
                      <p className="font-mono text-sm text-ink-muted uppercase tracking-[0.15em] mb-1.5">Date of Birth</p>
                      <p className="font-mono text-base text-ink-bright">{identity.dob}</p>
                    </div>
                  )}
                  {identity.older_than && (
                    <div>
                      <p className="font-mono text-sm text-ink-muted uppercase tracking-[0.15em] mb-1.5">Age Verified</p>
                      <p className="font-mono text-base text-ink-bright">{identity.older_than}+</p>
                    </div>
                  )}
                </div>

                {/* ZK proof checks */}
                {useCase && useCase.checks.length > 0 && (
                  <div className="px-6 py-4 border-t border-ink-border">
                    <p className="font-mono text-sm text-ink-muted uppercase tracking-[0.15em] mb-2.5">
                      ZK proof verifies
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {useCase.checks.map((check) => (
                        <span
                          key={check}
                          className="font-mono text-sm text-green-400/80 border border-green-400/20 px-2.5 py-1"
                        >
                          {check}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="border border-ink-border border-l-green-400/40 bg-ink-surface/60 px-6 py-4 animate-fadeInUp">
                <div className="flex items-center gap-3">
                  <ShieldIcon className="w-3.5 h-3.5 text-green-400" />
                  <span className="font-mono text-sm uppercase tracking-[0.25em] text-green-400">
                    Verified — Proof submitted successfully
                  </span>
                </div>
              </div>
            )}

            {/* Succinct Prover Network Card */}
            <div
              className="border border-ink-border bg-ink-surface/40 animate-fadeInUp"
              style={{ animationDelay: "0.15s" }}
            >
              <div className="px-6 py-4 flex items-center justify-between border-b border-ink-border">
                <div className="flex items-center gap-2.5">
                  <ShieldIcon className="w-3.5 h-3.5 text-ink-muted" />
                  <span className="font-mono text-sm uppercase tracking-[0.2em] text-ink-subtle">
                    Succinct Prover Network
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${statusDotColor(networkStatus)}`} />
                  <span className={`font-mono text-sm ${statusColor(networkStatus)}`}>
                    {statusLabel(networkStatus)}
                  </span>
                </div>
              </div>

              <div className="px-6 py-4 space-y-4">
                {/* Request ID - copyable */}
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm text-ink-muted uppercase tracking-[0.1em]">Request ID</span>
                  <div className="relative flex items-center gap-2">
                    <code className="font-mono text-sm text-ink-subtle">
                      {truncateId(proveResult.requestId)}
                    </code>
                    <button
                      onClick={copyRequestId}
                      className="text-ink-muted hover:text-ink-subtle transition-colors duration-150"
                      title="Copy full request ID"
                    >
                      <CopyIcon className="w-3 h-3" />
                    </button>
                    {copied && (
                      <span className="copy-tooltip absolute -top-6 right-0 font-mono text-xs text-ink-bright bg-ink-surface border border-ink-border-strong px-2 py-0.5">
                        Copied!
                      </span>
                    )}
                  </div>
                </div>

                <a
                  href={proveResult.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group w-full border border-ink-border-strong hover:border-ink-subtle py-3 font-mono text-base text-ink-text hover:text-ink-bright transition-all duration-200 uppercase tracking-[0.15em] flex items-center justify-center gap-2"
                >
                  <span>View on Succinct Explorer</span>
                  <ArrowRightIcon className="w-3 h-3 transition-transform duration-200 group-hover:translate-x-0.5" />
                </a>
              </div>
            </div>
          </>
        ) : (
          <div className="border border-ink-border bg-ink-surface/40 p-8 text-center space-y-3">
            <p className="font-mono text-base text-red-400">Proof generation failed</p>
            {proveError && (
              <p className="font-mono text-sm text-ink-muted">{proveError}</p>
            )}
          </div>
        )}

        {/* Start Over button */}
        <button
          onClick={onReset}
          className="w-full border border-ink-border-strong hover:border-ink-subtle py-3 font-mono text-base text-ink-subtle hover:text-ink-bright transition-all duration-200 uppercase tracking-[0.15em] animate-fadeInUp"
          style={{ animationDelay: "0.3s" }}
        >
          Start over
        </button>
      </div>
    </div>
  );
}
