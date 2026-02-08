"use client";

import { useState, useEffect, useRef } from "react";
import StepIndicator from "./StepIndicator";

interface ProvingStepProps {
  status: string;
}

interface Stage {
  id: string;
  label: string;
  state: "done" | "active" | "pending";
}

const STAGE_LABELS = [
  "Extracting PDF signature",
  "Validating certificate chain",
  "Computing ZK circuit",
  "Submitting to Succinct network",
  "Awaiting proof generation",
];

function mapStatusToActiveStage(status: string): number {
  const s = status.toLowerCase();
  if (s.includes("upload") || s.includes("extract") || s.includes("signature")) return 0;
  if (s.includes("valid") || s.includes("certif")) return 1;
  if (s.includes("circuit") || s.includes("compil") || s.includes("computing")) return 2;
  if (s.includes("submit") || s.includes("request") || s.includes("sending")) return 3;
  if (s.includes("prov") || s.includes("generat") || s.includes("await") || s.includes("poll")) return 4;
  // Default: progress based on time
  return -1;
}

export default function ProvingStep({ status }: ProvingStepProps) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [timedStage, setTimedStage] = useState(0);
  const prevStatus = useRef(status);

  // Reveal lines one by one with typewriter timing
  useEffect(() => {
    if (visibleCount < STAGE_LABELS.length) {
      const delay = visibleCount === 0 ? 300 : 600 + Math.random() * 400;
      const timer = setTimeout(() => setVisibleCount((c) => c + 1), delay);
      return () => clearTimeout(timer);
    }
  }, [visibleCount]);

  // Advance timed stage based on elapsed time (fallback if status doesn't change)
  useEffect(() => {
    const timer = setTimeout(() => {
      setTimedStage((s) => Math.min(s + 1, STAGE_LABELS.length - 1));
    }, 3000);
    return () => clearTimeout(timer);
  }, [timedStage]);

  // Bump timed stage when status text changes
  useEffect(() => {
    if (status !== prevStatus.current) {
      prevStatus.current = status;
      const mapped = mapStatusToActiveStage(status);
      if (mapped >= 0) {
        setTimedStage((s) => Math.max(s, mapped));
      }
    }
  }, [status]);

  const activeIdx = Math.max(mapStatusToActiveStage(status), timedStage);

  const stages: Stage[] = STAGE_LABELS.map((label, i) => ({
    id: String(i),
    label,
    state: i < activeIdx ? "done" : i === activeIdx ? "active" : "pending",
  }));

  return (
    <div className="animate-fadeInUp">
      <StepIndicator label="Generating Proof" sublabel="Building a zero-knowledge proof on the Succinct network." />

      {/* Marching ants bordered container */}
      <div className="relative bg-ink-surface">
        <svg
          className="proving-zone-border absolute inset-0 w-full h-full pointer-events-none"
          preserveAspectRatio="none"
        >
          <rect
            x="0.5"
            y="0.5"
            width="99%"
            height="99%"
            fill="none"
            stroke="#3a3a3a"
            strokeWidth="1"
          />
        </svg>

        <div className="p-8 space-y-0">
          {/* Terminal-style stage lines */}
          <div className="space-y-3">
            {stages.map((stage, i) => {
              if (i >= visibleCount) return null;

              return (
                <div
                  key={stage.id}
                  className="proving-stage-line flex items-center justify-between gap-4"
                  style={{ animationDelay: `${i * 0.1}s` }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-sm text-ink-muted shrink-0">
                      [{String(i + 1).padStart(2, "0")}]
                    </span>
                    <span
                      className={`font-mono text-[15px] truncate ${
                        stage.state === "done"
                          ? "text-ink-subtle"
                          : stage.state === "active"
                          ? "text-yellow-400"
                          : "text-ink-muted/70"
                      }`}
                    >
                      {stage.label}
                    </span>
                  </div>

                  <span className="shrink-0 font-mono text-sm">
                    {stage.state === "done" && (
                      <span className="text-green-400">done</span>
                    )}
                    {stage.state === "active" && (
                      <span className="text-yellow-400 stage-dot-active">
                        &#9679;
                      </span>
                    )}
                    {stage.state === "pending" && (
                      <span className="text-ink-muted/70">&mdash;</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Separator + status footer */}
          <div className="mt-6 pt-4 border-t border-ink-border-strong">
            <p className="font-mono text-sm text-ink-muted truncate">
              {status}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
