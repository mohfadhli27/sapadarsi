"use client";

import { SapabidanLogos } from "@/src/components/shared/sapabidan-logos";
import { SapabidanMark } from "@/src/components/shared/sapabidan-mark";

export function SapabidanFooter() {
  const year = new Date().getFullYear();

  return (
    <div className="flex w-full flex-col items-center gap-5 text-center">
      <SapabidanMark size={48} showWordmark wordmarkClassName="text-lg" />
      <SapabidanLogos size="sm" className="max-w-full justify-center" iconsOnly />
      <div className="space-y-1 text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
        <p>
          &copy; {year} Sapabidan &mdash; Layanan Konsultasi Bidan Digital
        </p>
        <p>
          Kolaborasi Yayasan Rumah Sakit Islam Surabaya, Universitas Nahdlatul Ulama
          Surabaya, dan Ikatan Bidan Indonesia
        </p>
      </div>
    </div>
  );
}
