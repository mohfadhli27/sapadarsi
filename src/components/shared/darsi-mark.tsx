"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { isSapabidan } from "@/src/config/app-variant";
import { SapabidanMark } from "@/src/components/shared/sapabidan-mark";
import { cn } from "@/src/lib/utils";

interface DarsiMarkProps {
  size?: number;
  className?: string;
}

/** Hero mark — logo DARSI atau Sapabidan (tanpa duplikasi teks) */
export function DarsiMark({ size = 72, className }: DarsiMarkProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (isSapabidan) {
    return <SapabidanMark size={size} className={className} />;
  }

  const src =
    mounted && resolvedTheme === "dark" ? "/logos/Dark.svg" : "/logos/Light.svg";

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt="DARSI"
      width={size}
      height={size}
      className={cn("shrink-0 object-contain", className)}
      suppressHydrationWarning
    />
  );
}
