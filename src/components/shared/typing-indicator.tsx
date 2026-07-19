import { cn } from "@/src/lib/utils";
import { Bot, Stethoscope } from "lucide-react";

type TypingIndicatorProps = {
  label?: string;
  variant?: "bot" | "doctor";
  /** Tampilkan animasi titik mengetik (untuk proses di dalam bubble chat). */
  showTypingDots?: boolean;
  senderName?: string;
};

export function TypingIndicator({
  label,
  variant = "bot",
  showTypingDots = true,
  senderName,
}: TypingIndicatorProps) {
  const isDoctor = variant === "doctor";

  return (
    <div className="flex gap-3 px-4 py-2">
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isDoctor ? "bg-emerald-600 text-white" : "bg-accent text-accent-foreground"
        )}
      >
        {isDoctor ? <Stethoscope className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div
        className={cn(
          "flex max-w-[85%] flex-col justify-center gap-1.5 rounded-2xl rounded-bl-md px-4 py-3 lg:max-w-[78%]",
          isDoctor
            ? "border border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40"
            : "border border-border bg-card"
        )}
      >
        {senderName && (
          <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
            {senderName}
          </p>
        )}
        {label && (
          <p className="text-sm leading-relaxed text-foreground">{label}</p>
        )}
        {showTypingDots && (
          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={cn(
                  "inline-block h-2 w-2 rounded-full",
                  isDoctor ? "bg-emerald-600/70" : "bg-muted-foreground/60",
                  "animate-bounce"
                )}
                style={{ animationDelay: `${i * 150}ms`, animationDuration: "1s" }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
