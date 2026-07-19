"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/src/lib/utils";

type CollaborationLogosProps = {
  size?: "sm" | "md";
  className?: string;
};

export function CollaborationLogos({ size = "md", className }: CollaborationLogosProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const yarsisSize = size === "sm" ? 28 : 36;
  const darsiSize = size === "sm" ? 22 : 28;

  const darsiSrc =
    mounted && resolvedTheme === "dark" ? "/logos/Dark.svg" : "/logos/Light.svg";

  return (
    <div className={cn("flex items-center justify-center gap-3", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logos/yarsis-logo.png"
        alt="Yarsis"
        width={yarsisSize}
        height={yarsisSize}
        className="shrink-0"
      />
      <div className="h-7 w-px bg-border/70" aria-hidden />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={darsiSrc}
        alt="DARSI"
        width={darsiSize}
        height={darsiSize}
        className="shrink-0"
        suppressHydrationWarning
      />
      <span className="text-sm font-bold tracking-tight text-foreground">DARSI</span>
    </div>
  );
}
