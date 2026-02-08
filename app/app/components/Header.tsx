"use client";

interface HeaderProps {
  onLogoClick?: () => void;
}

export default function Header({ onLogoClick }: HeaderProps) {
  return (
    <header className="w-full px-10 xl:px-20 pt-6 pb-0">
      <button
        onClick={onLogoClick}
        className="group -ml-2 px-2 py-1.5 rounded-md transition-colors hover:bg-ink-bright/[0.03] active:bg-ink-bright/[0.06] focus:outline-none focus-visible:ring-1 focus-visible:ring-ink-border-strong"
        aria-label="Go to home"
      >
        <span className="font-display italic text-[26px] font-medium text-ink-bright group-hover:text-white transition-colors">
          inkognito
        </span>
      </button>

      <p className="mt-4 font-sans text-[15px] text-ink-subtle italic tracking-normal">
        Compose proofs from your identity and private documents
      </p>

      <div className="mt-5 h-px bg-ink-border" />
    </header>
  );
}
