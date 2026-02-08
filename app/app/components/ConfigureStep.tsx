"use client";

import { useState, useMemo } from "react";
import { CheckDef } from "../types";
import { checkDefinitions } from "../data/checks";
import { PassportIcon, PdfIcon } from "./Icons";
import StepIndicator from "./StepIndicator";

interface ConfigureStepProps {
  onContinue: (checks: CheckDef[]) => void;
  onBack: () => void;
}

const categories = ["identity", "document", "cross-check"] as const;

export default function ConfigureStep({ onContinue, onBack }: ConfigureStepProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedChecks = useMemo(
    () => checkDefinitions.filter((c) => selected.has(c.id)),
    [selected]
  );

  const inferredSources = useMemo(() => {
    const sources = new Set<"passport" | "pdf">();
    for (const check of selectedChecks) {
      for (const r of check.requires) sources.add(r);
    }
    return Array.from(sources);
  }, [selectedChecks]);

  const grouped = useMemo(() => {
    const map: Record<string, CheckDef[]> = {};
    for (const cat of categories) {
      map[cat] = checkDefinitions.filter((c) => c.category === cat);
    }
    return map;
  }, []);

  return (
    <div className="animate-fadeInUp">
      <StepIndicator label="Custom Builder" sublabel="Select the checks to include in your proof." />

      <div className="space-y-6">
        {categories.map((cat) => (
          <div key={cat}>
            <h3 className="font-mono text-[13px] uppercase tracking-[0.15em] text-ink-muted mb-3">
              {cat}
            </h3>
            <div className="space-y-1">
              {grouped[cat].map((check) => (
                <button
                  key={check.id}
                  type="button"
                  onClick={() => toggle(check.id)}
                  className="flex items-center gap-3 py-2 px-3 -mx-3 w-full text-left cursor-pointer hover:bg-ink-surface/40 transition-colors duration-150 group"
                >
                  <span
                    className={`w-4 h-4 border flex items-center justify-center shrink-0 transition-colors duration-150 ${
                      selected.has(check.id)
                        ? "border-ink-bright bg-ink-bright"
                        : "border-ink-border-strong group-hover:border-ink-subtle"
                    }`}
                  >
                    {selected.has(check.id) && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-ink-bg">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </span>
                  <span className="font-mono text-[15px] text-ink-text group-hover:text-ink-bright transition-colors duration-150">
                    {check.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom bar */}
      <div className="border-t border-ink-border-strong mt-8 pt-5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-ink-muted">
          {inferredSources.includes("passport") && (
            <div className="flex items-center gap-1.5 font-mono text-[13px] uppercase tracking-wide">
              <PassportIcon className="w-3.5 h-3.5" />
              <span>passport</span>
            </div>
          )}
          {inferredSources.includes("passport") && inferredSources.includes("pdf") && (
            <span className="text-ink-muted mx-1">+</span>
          )}
          {inferredSources.includes("pdf") && (
            <div className="flex items-center gap-1.5 font-mono text-[13px] uppercase tracking-wide">
              <PdfIcon className="w-3.5 h-3.5" />
              <span>pdf</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="font-mono text-[15px] text-ink-muted hover:text-ink-bright transition-colors duration-200"
          >
            back
          </button>
          <button
            onClick={() => onContinue(selectedChecks)}
            disabled={selected.size === 0}
            className={`font-mono text-[15px] px-5 py-2 border transition-all duration-200 ${
              selected.size === 0
                ? "border-ink-border-strong text-ink-muted cursor-not-allowed opacity-40"
                : "border-ink-bright text-ink-bright hover:bg-ink-bright hover:text-ink-bg"
            }`}
          >
            continue
          </button>
        </div>
      </div>
    </div>
  );
}
