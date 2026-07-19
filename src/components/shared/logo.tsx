"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { isSapabidan } from "@/src/config/app-variant";
import { SapabidanLogos } from "@/src/components/shared/sapabidan-logos";
import { cn } from "@/src/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  showDarsi?: boolean;
  className?: string;
}

const sizeMap = {
  sm: {
    yarsis: 28,
    darsi: 22,
    rsiText: "text-[8px] leading-[1.15]",
    darsiText: "text-sm",
    dividerH: "h-6",
  },
  md: {
    yarsis: 34,
    darsi: 28,
    rsiText: "text-[9px] leading-[1.2]",
    darsiText: "text-base",
    dividerH: "h-8",
  },
  lg: {
    yarsis: 42,
    darsi: 34,
    rsiText: "text-[10px] leading-[1.2]",
    darsiText: "text-lg",
    dividerH: "h-9",
  },
};

export function Logo({ size = "md", showText = true, showDarsi = true, className }: LogoProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const s = sizeMap[size];

  useEffect(() => setMounted(true), []);

  if (isSapabidan) {
    return (
      <SapabidanLogos
        size={size === "lg" ? "md" : size === "md" ? "md" : "sm"}
        className={className}
      />
    );
  }

  const darsiSrc =
    mounted && resolvedTheme === "dark" ? "/logos/Dark.svg" : "/logos/Light.svg";

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="flex items-center gap-1.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logos/yarsis-logo.png"
          alt="Yarsis"
          width={s.yarsis}
          height={s.yarsis}
          className="shrink-0"
        />
        <div className={cn("font-semibold uppercase tracking-wide text-foreground", s.rsiText)}>
          <div>RS Islam</div>
          <div className="text-muted-foreground">Surabaya - A. Yani</div>
        </div>
      </div>

      {showDarsi && (
        <>
          <div className={cn("w-px shrink-0 bg-border", s.dividerH)} />

          <div className="flex items-center gap-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={darsiSrc}
              alt="DARSI"
              width={s.darsi}
              height={s.darsi}
              className="shrink-0"
              suppressHydrationWarning
            />
            {showText && (
              <span className={cn("font-bold tracking-tight text-foreground", s.darsiText)}>
                DARSI
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function YarsisLogo({ size = 80, className }: { size?: number; className?: string }) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src="/logos/yarsis-logo.png"
      alt="Yayasan Rumah Sakit Islam Surabaya"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
    />
  );
}
