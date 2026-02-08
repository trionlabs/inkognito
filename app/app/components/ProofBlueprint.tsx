import { useEffect, useRef, useState } from "react";
import { BlueprintState, UseCase } from "../types";
import { PassportIcon, PdfIcon, CheckIcon, ShieldIcon } from "./Icons";

interface ProofBlueprintProps {
  state: BlueprintState;
  networkStatus: string;
  hoveredUseCase?: UseCase | null;
}

type Mode = "idle" | "preview" | "active";

export default function ProofBlueprint({ state, networkStatus, hoveredUseCase }: ProofBlueprintProps) {
  const { useCase: activeUseCase, pdfUploaded, passportScanned, proofStatus } = state;

  // 50ms debounce on hover to prevent flicker when sweeping between cards
  const [debouncedHover, setDebouncedHover] = useState<UseCase | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (hoveredUseCase) {
      // Instant fill on hover-in
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      setDebouncedHover(hoveredUseCase);
    } else {
      // 50ms delay on hover-out
      hoverTimerRef.current = setTimeout(() => {
        setDebouncedHover(null);
      }, 50);
    }
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, [hoveredUseCase]);

  const displayUseCase = activeUseCase ?? debouncedHover ?? null;
  const mode: Mode = activeUseCase ? "active" : debouncedHover ? "preview" : "idle";

  // Border style per mode
  const outerBorder = mode === "active"
    ? "border-solid border-ink-border-strong"
    : mode === "preview"
      ? "border-solid border-ink-border-strong"
      : "border-solid border-ink-border";

  // Section content opacity per mode
  const contentOpacity = mode === "active" ? "opacity-100" : mode === "preview" ? "opacity-65" : "";

  // Section background per mode
  const sectionBg = mode === "active"
    ? "bg-ink-surface/40"
    : mode === "preview"
      ? "bg-ink-surface/20"
      : "bg-transparent";

  const statusDot = (s: string) => {
    if (s === "fulfilled") return "bg-green-400";
    if (s === "failed") return "bg-red-400";
    return "bg-yellow-400 animate-pulse";
  };

  const statusLabel = (s: string) => {
    if (s === "fulfilled") return "Fulfilled";
    if (s === "failed") return "Failed";
    if (s === "assigned") return "Proving...";
    return "Pending";
  };

  const requiresPassport = displayUseCase?.sources.includes("passport") ?? false;
  const requiresPdf = displayUseCase?.sources.includes("pdf") ?? false;
  const hasSources = displayUseCase ? displayUseCase.sources.length > 0 : false;
  const hasChecks = displayUseCase ? displayUseCase.checks.length > 0 : false;

  return (
    <div className="w-[400px] shrink-0 hidden lg:block">
      <div className="sticky top-8">
        <div className={`border ${outerBorder} transition-colors duration-200`}>
          {/* Header */}
          <div className="px-4 py-3 border-b border-ink-border">
            <div className="flex items-center gap-2 mb-1">
              <ShieldIcon className="w-3 h-3 text-ink-muted" />
              <span className="font-mono text-[11px] text-ink-muted uppercase tracking-[0.12em]">
                Proof Blueprint
              </span>
            </div>
            {displayUseCase ? (
              <p className={`font-mono text-[15px] text-ink-bright transition-all duration-200 ${contentOpacity}`}>
                {displayUseCase.label}
              </p>
            ) : (
              <p className="font-mono text-[15px] text-ink-muted blueprint-idle-text">
                Select a use case
              </p>
            )}
          </div>

          {/* SEC.01 — Inputs */}
          <div
            className={`px-4 py-3 border-b border-ink-border ${sectionBg} transition-all duration-200 ease-out`}
            style={{ transitionDelay: "0ms" }}
          >
            <span className="font-mono text-[11px] text-ink-muted uppercase tracking-[0.12em]">
              SEC.01 &mdash; inputs
            </span>
            <div className={`mt-2 transition-all duration-200 ease-out`} style={{ transitionDelay: "0ms" }}>
              {mode === "idle" ? (
                <p className="font-mono text-[13px] text-ink-muted italic blueprint-idle-text">
                  Awaiting selection...
                </p>
              ) : hasSources ? (
                <div className={`space-y-1.5 ${contentOpacity} transition-opacity duration-200`}>
                  {requiresPassport && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <PassportIcon className="w-3 h-3 text-ink-muted" />
                        <span className="font-mono text-[13px] text-ink-subtle">Passport</span>
                      </div>
                      {mode === "active" ? (
                        passportScanned ? (
                          <CheckIcon className="w-3 h-3 text-green-400" />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-ink-border-strong" />
                        )
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-ink-border" />
                      )}
                    </div>
                  )}
                  {requiresPdf && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <PdfIcon className="w-3 h-3 text-ink-muted" />
                        <span className="font-mono text-[13px] text-ink-subtle">PDF Document</span>
                      </div>
                      {mode === "active" ? (
                        pdfUploaded ? (
                          <CheckIcon className="w-3 h-3 text-green-400" />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-ink-border-strong" />
                        )
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-ink-border" />
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className={`font-mono text-[13px] text-ink-muted italic ${contentOpacity} transition-opacity duration-200`}>
                  Configured at next step
                </p>
              )}
            </div>
          </div>

          {/* SEC.02 — Checks */}
          <div
            className={`px-4 py-3 border-b border-ink-border ${sectionBg} transition-all duration-200 ease-out`}
            style={{ transitionDelay: "40ms" }}
          >
            <span className="font-mono text-[11px] text-ink-muted uppercase tracking-[0.12em]">
              SEC.02 &mdash; checks
            </span>
            <div className="mt-2 transition-all duration-200 ease-out" style={{ transitionDelay: "40ms" }}>
              {mode === "idle" ? (
                <p className="font-mono text-[13px] text-ink-muted italic blueprint-idle-text">
                  Verification steps will appear here
                </p>
              ) : hasChecks ? (
                <div className={`flex flex-wrap gap-1.5 ${contentOpacity} transition-opacity duration-200`}>
                  {displayUseCase!.checks.map((check, i) => (
                    <span
                      key={i}
                      className={`font-mono text-[12px] text-ink-muted px-2 py-0.5 rounded-sm transition-all duration-200 ${
                        mode === "active"
                          ? "bg-ink-bg border border-solid border-ink-border"
                          : "bg-ink-bg/50 border border-solid border-ink-border"
                      }`}
                    >
                      {check}
                    </span>
                  ))}
                </div>
              ) : (
                <p className={`font-mono text-[13px] text-ink-muted italic ${contentOpacity} transition-opacity duration-200`}>
                  Configured at next step
                </p>
              )}
            </div>
          </div>

          {/* SEC.03 — Output */}
          <div
            className={`px-4 py-3 border-b border-ink-border ${sectionBg} transition-all duration-200 ease-out`}
            style={{ transitionDelay: "80ms" }}
          >
            <span className="font-mono text-[11px] text-ink-muted uppercase tracking-[0.12em]">
              SEC.03 &mdash; output
            </span>
            <div className="mt-1 transition-all duration-200 ease-out" style={{ transitionDelay: "80ms" }}>
              {mode === "idle" ? (
                <p className="font-mono text-[13px] text-ink-muted italic blueprint-idle-text">
                  Proof output specification
                </p>
              ) : (
                <p className={`font-mono text-[13px] text-ink-subtle ${contentOpacity} transition-opacity duration-200`}>
                  {displayUseCase!.outputDescription}
                </p>
              )}
            </div>
          </div>

          {/* SEC.04 — Status */}
          <div
            className={`px-4 py-3 ${sectionBg} transition-all duration-200 ease-out`}
            style={{ transitionDelay: "120ms" }}
          >
            <span className="font-mono text-[11px] text-ink-muted uppercase tracking-[0.12em]">
              SEC.04 &mdash; status
            </span>
            <div className="mt-1.5 transition-all duration-200 ease-out" style={{ transitionDelay: "120ms" }}>
              {mode === "idle" ? (
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full border border-ink-border-strong" />
                  <span className="font-mono text-[13px] text-ink-muted blueprint-idle-text">
                    Protocol idle
                  </span>
                </div>
              ) : mode === "preview" ? (
                <div className={`flex items-center gap-2 ${contentOpacity} transition-opacity duration-200`}>
                  <span className="w-1.5 h-1.5 rounded-full border border-ink-border-strong" />
                  <span className="font-mono text-[13px] text-ink-subtle">
                    Ready when selected
                  </span>
                </div>
              ) : (
                /* active mode */
                (proofStatus === "proving" || proofStatus === "done" || proofStatus === "error") ? (
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${statusDot(proofStatus === "proving" ? "assigned" : networkStatus)}`} />
                    <span className={`font-mono text-[13px] ${
                      proofStatus === "done" && networkStatus === "fulfilled"
                        ? "text-green-400"
                        : proofStatus === "error" || networkStatus === "failed"
                          ? "text-red-400"
                          : "text-yellow-400"
                    }`}>
                      {proofStatus === "proving"
                        ? "Generating proof..."
                        : proofStatus === "error"
                          ? "Proof failed"
                          : statusLabel(networkStatus)}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full border border-ink-border-strong" />
                    <span className="font-mono text-[13px] text-ink-subtle">
                      Awaiting inputs
                    </span>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
