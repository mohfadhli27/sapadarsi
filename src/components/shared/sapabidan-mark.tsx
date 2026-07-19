"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/src/lib/utils";

type SapabidanMarkProps = {
  size?: number;
  className?: string;
  showWordmark?: boolean;
  wordmarkClassName?: string;
};

/** Logo mark Sapabidan — memakai logo DARSI */
export function SapabidanMark({
  size = 72,
  className,
  showWordmark = false,
  wordmarkClassName,
}: SapabidanMarkProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const src =
    mounted && resolvedTheme === "dark" ? "/logos/Dark.svg" : "/logos/Light.svg";

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      {mounted ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={src}
          alt="Sapabidan"
          width={size}
          height={size}
          className="shrink-0 object-contain"
        />
      ) : (
        <div
          className="shrink-0 rounded-full bg-emerald-500/15"
          style={{ width: size, height: size }}
          aria-hidden
        />
      )}
      {showWordmark && (
        <span
          className={cn(
            "font-bold tracking-tight text-emerald-700 dark:text-emerald-400",
            wordmarkClassName
          )}
        >
          Sapabidan
        </span>
      )}
    </div>
  );
}
