import { cn } from "@/src/lib/utils";
import { formatTime } from "@/src/lib/utils";
import { Bot, Pill, Trash2, User, Stethoscope, UserRound } from "lucide-react";
import { MarkdownContent } from "@/src/components/shared/markdown-content";
import { Button } from "@/src/components/ui/button";

interface ChatBubbleProps {
  role: "user" | "assistant" | "doctor" | "coordinator" | "system";
  content: string;
  timestamp?: Date;
  senderName?: string;
  onDelete?: () => void;
  deleting?: boolean;
  variant?: "default" | "pharmacy";
}

export function ChatBubble({
  role,
  content,
  timestamp,
  senderName,
  onDelete,
  deleting,
  variant = "default",
}: ChatBubbleProps) {
  const isUser = role === "user";
  const isSystem = role === "system";
  const isDoctor = role === "doctor";
  const isCoordinator = role === "coordinator";
  const isAssistant = role === "assistant";
  const isStaffReply = isDoctor || (isAssistant && Boolean(senderName));

  const isPharmacyAssistant = isAssistant && variant === "pharmacy";

  if (isSystem) {
    return (
      <div className="flex justify-center px-4 py-2">
        <p className="rounded-lg bg-muted px-4 py-2 text-xs text-muted-foreground">
          {content}
        </p>
      </div>
    );
  }

  const displayName =
    isStaffReply
      ? senderName ?? (isDoctor ? "Dokter" : "Asisten")
      : isCoordinator
        ? senderName ?? "Koordinator Poli"
        : undefined;

  return (
    <div
      className={cn(
        "group flex gap-3 px-4 py-2",
        isUser ? "flex-row-reverse" : ""
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser
            ? "bg-primary text-primary-foreground"
            : isStaffReply
              ? "bg-emerald-600 text-white"
              : isPharmacyAssistant
                ? "bg-blue-600 text-white"
                : "bg-accent text-accent-foreground"
        )}
      >
        {isUser ? (
          <User className="h-4 w-4" />
        ) : isStaffReply ? (
          <Stethoscope className="h-4 w-4" />
        ) : isCoordinator ? (
          <UserRound className="h-4 w-4" />
        ) : isPharmacyAssistant ? (
          <Pill className="h-4 w-4" />
        ) : (
          <Bot className="h-4 w-4" />
        )}
      </div>

      <div
        className={cn(
          "relative max-w-[85%] rounded-2xl px-4 py-3 lg:max-w-[78%] lg:px-5 lg:py-4",
          isUser
            ? "rounded-br-md bg-primary text-primary-foreground"
            : isStaffReply
              ? "rounded-bl-md border border-emerald-200 bg-emerald-50 text-foreground dark:border-emerald-900 dark:bg-emerald-950/40"
              : isPharmacyAssistant
                ? "rounded-bl-md border border-blue-200 bg-blue-50/80 text-foreground dark:border-blue-900 dark:bg-blue-950/30"
                : "rounded-bl-md border border-border bg-card text-card-foreground"
        )}
      >
        {onDelete && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={deleting}
            onClick={onDelete}
            className={cn(
              "absolute -top-2 h-7 w-7 rounded-full opacity-0 shadow-sm transition-opacity group-hover:opacity-100",
              isUser ? "-left-2 bg-background text-destructive" : "-right-2 bg-background text-destructive"
            )}
            aria-label="Hapus pesan"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
        {displayName && (
          <p
            className={cn(
              "mb-1 text-[11px] font-semibold",
              isStaffReply ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"
            )}
          >
            {displayName}
          </p>
        )}
        {isUser ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed lg:text-base">{content}</p>
        ) : (
          <MarkdownContent
            content={content}
            className="text-sm leading-relaxed lg:text-base"
          />
        )}
        {timestamp && (
          <p
            className={cn(
              "mt-1 text-[10px]",
              isUser ? "text-primary-foreground/70" : "text-muted-foreground"
            )}
          >
            {formatTime(timestamp)}
          </p>
        )}
      </div>
    </div>
  );
}
