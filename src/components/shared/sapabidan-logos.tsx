"use client";

import { cn } from "@/src/lib/utils";

type SapabidanLogosProps = {
  size?: "sm" | "md";
  className?: string;
  /** Paksa hanya ikon (tanpa nama mitra) — default responsif per lebar layar. */
  iconsOnly?: boolean;
};

const PARTNERS = [
  {
    src: "/logos/yarsis-logo.png",
    alt: "Yayasan Rumah Sakit Islam Surabaya",
    name: "Yayasan Rumah Sakit Islam Surabaya",
  },
  {
    src: "/logos/unusa-logo.png",
    alt: "Universitas Nahdlatul Ulama Surabaya",
    name: "Universitas Nahdlatul Ulama Surabaya",
  },
  {
    src: "/logos/ibi-logo.png",
    alt: "Ikatan Bidan Indonesia",
    name: "Ikatan Bidan Indonesia",
  },
] as const;

const sizeMap = {
  sm: {
    logoClass: "h-9 w-9 sm:h-10 sm:w-10 md:h-[26px] md:w-[26px]",
    gap: "gap-2 sm:gap-2.5 md:gap-3",
    partner: "flex items-center gap-1 md:gap-2",
    name: "hidden md:block line-clamp-2 max-w-[6.5rem] text-[9px] font-semibold leading-snug text-foreground lg:max-w-[7.5rem] lg:text-[10px]",
    divider: "mx-1.5 hidden h-6 w-px shrink-0 bg-border/70 md:block md:mx-2 md:h-6",
  },
  md: {
    logoClass: "h-6 w-6 sm:h-7 sm:w-7 md:h-[30px] md:w-[30px]",
    gap: "gap-2 sm:gap-3 md:gap-5",
    partner: "flex items-center gap-2 md:gap-2.5",
    name: "hidden md:block line-clamp-2 max-w-[7.5rem] text-[9px] font-semibold leading-snug text-foreground sm:max-w-[9rem] sm:text-[10px] lg:max-w-[10.5rem] lg:text-[11px]",
    divider: "mx-2 hidden h-6 w-px shrink-0 bg-border/70 md:block md:mx-2.5",
  },
};

/** Kolaborasi mitra — di HP kecil hanya logo; teks muncul mulai layar md ke atas. */
export function SapabidanLogos({ size = "sm", className, iconsOnly }: SapabidanLogosProps) {
  const s = sizeMap[size];

  return (
    <div
      className={cn("flex min-w-0 max-w-full flex-nowrap items-center justify-center", s.gap, className)}
      aria-label="Kolaborasi mitra Sapabidan"
    >
      {PARTNERS.map((partner, index) => (
        <div key={partner.name} className="flex min-w-0 shrink items-center">
          {index > 0 && !iconsOnly && <div className={s.divider} aria-hidden />}
          <div className={cn("flex min-w-0 shrink-0 items-center", s.partner)} title={partner.name}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={partner.src}
              alt={partner.alt}
              width={size === "md" ? 30 : 36}
              height={size === "md" ? 30 : 36}
              className={cn("shrink-0 object-contain", s.logoClass)}
            />
            {!iconsOnly && <p className={s.name}>{partner.name}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
