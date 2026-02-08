interface StepIndicatorProps {
  label: string;
  sublabel?: string;
}

export default function StepIndicator({ label, sublabel }: StepIndicatorProps) {
  return (
    <div className="mb-10">
      <div className="flex items-center gap-3">
        <span className="text-ink-muted font-mono text-[15px] select-none" aria-hidden>&mdash;</span>
        <h2 className="font-display text-[26px] font-medium tracking-normal text-ink-text">{label}</h2>
      </div>
      {sublabel && (
        <p className="font-sans text-base text-ink-muted mt-2 pl-[27px] leading-relaxed">{sublabel}</p>
      )}
    </div>
  );
}
