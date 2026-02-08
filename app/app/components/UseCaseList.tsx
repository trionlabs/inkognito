import { UseCase } from "../types";
import { useCases } from "../data/use-cases";
import StepIndicator from "./StepIndicator";

interface UseCaseListProps {
  onSelect: (uc: UseCase) => void;
  onHover?: (uc: UseCase) => void;
  onHoverEnd?: () => void;
}

export default function UseCaseList({ onSelect, onHover, onHoverEnd }: UseCaseListProps) {
  return (
    <div className="animate-fadeInUp">
      <StepIndicator label="Select Use Case" sublabel="Choose what you want to prove." />
      <div>
        {useCases.map((uc, i) => (
          <button
            key={uc.id}
            disabled={uc.comingSoon}
            onClick={() => onSelect(uc)}
            onMouseEnter={() => !uc.comingSoon && onHover?.(uc)}
            onMouseLeave={() => onHoverEnd?.()}
            className={`w-full text-left group py-5 pl-4 border-l-2 transition-all duration-200 ${
              i > 0 ? "border-t border-t-ink-border-strong" : ""
            } ${
              i === useCases.length - 1 ? "border-b border-b-ink-border-strong" : ""
            } ${
              uc.comingSoon
                ? "border-l-transparent opacity-30 cursor-not-allowed"
                : "border-l-transparent cursor-pointer hover:border-l-ink-subtle hover:bg-ink-surface/30"
            }`}
          >
            <div>
                <div className="flex items-baseline gap-3 mb-1">
                  <span className="font-display text-[24px] font-medium text-ink-text group-hover:text-ink-bright transition-colors duration-200">
                    {uc.label}
                  </span>
                  {uc.sources.length > 0 && (
                    <span className="flex items-center gap-3 text-ink-muted">
                      {uc.sources.includes("passport") && (
                        <span className="flex items-center gap-1">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="3" width="20" height="18" rx="2" />
                            <circle cx="12" cy="11" r="3" />
                            <path d="M6 21v-1a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v1" />
                          </svg>
                          <span className="font-mono text-[12px] uppercase tracking-wider">passport</span>
                        </span>
                      )}
                      {uc.sources.includes("pdf") && (
                        <span className="flex items-center gap-1">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="9" y1="13" x2="15" y2="13" />
                            <line x1="9" y1="17" x2="15" y2="17" />
                          </svg>
                          <span className="font-mono text-[12px] uppercase tracking-wider">pdf</span>
                        </span>
                      )}
                    </span>
                  )}
                </div>
                <p className="text-[15px] text-ink-muted leading-relaxed font-sans">
                  {uc.description}
                </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
