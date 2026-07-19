"use client";

import { ArrowRight } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import type { SuggestNewConsultation } from "@/src/types/chat";

type Props = {
  suggestion: SuggestNewConsultation;
  onStart: (complaint: string) => void;
  loading?: boolean;
};

export function NewConsultationPrompt({ suggestion, onStart, loading }: Props) {
  return (
    <div className="mx-4 mb-2 ml-14 max-w-md rounded-xl border border-primary/20 bg-primary/5 p-3">
      <p className="text-xs font-medium text-foreground">Konsultasi baru di DARSI</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Keluhan: <span className="text-foreground">{suggestion.complaint}</span>
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        Akan diarahkan ke {suggestion.unitHint}
      </p>
      <Button
        type="button"
        size="sm"
        className="mt-2 h-8 w-full text-xs"
        disabled={loading}
        onClick={() => onStart(suggestion.complaint)}
      >
        Ajukan konsultasi {suggestion.label}
        <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
