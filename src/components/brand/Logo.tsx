import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary-soft text-primary",
        className,
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 3v18" strokeLinecap="round" />
        <path d="M5 7h14" strokeLinecap="round" />
        <path d="M5 7l-2.5 5a3 3 0 0 0 5 0L5 7z" strokeLinejoin="round" />
        <path d="M19 7l-2.5 5a3 3 0 0 0 5 0L19 7z" strokeLinejoin="round" />
        <path d="M8 21h8" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function Logo({
  className,
  showTagline = false,
}: {
  className?: string;
  showTagline?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <LogoMark />
      <div className="leading-tight">
        <span className="block font-display text-lg font-semibold tracking-tight">
          Juris<span className="text-primary">IA</span>
        </span>
        {showTagline ? (
          <span className="block text-xs text-muted-foreground">
            A inteligência que transforma o atendimento jurídico.
          </span>
        ) : null}
      </div>
    </div>
  );
}
