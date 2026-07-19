"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="app-canvas min-h-dvh">
      <header className="app-chrome sticky top-0 z-40 border-b border-border/40">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3.5 sm:px-5">
          <Link href="/" className="app-icon-btn shrink-0" aria-label="Beranda">
            <ArrowLeft className="h-[1.125rem] w-[1.125rem]" strokeWidth={2} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-balance text-[1.125rem] font-semibold tracking-[-0.03em] text-foreground">
              {title}
            </h1>
            {updated ? (
              <p className="mt-0.5 text-xs text-muted-foreground">Diperbarui {updated}</p>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-7 pb-14 sm:px-5">
        <div className="surface-panel legal-sections p-5 sm:p-7">{children}</div>
      </main>
    </div>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-border/45 py-6 last:border-0 last:pb-0 first:pt-0">
      <h2 className="legal-section-title mb-3 flex items-baseline gap-2.5">
        <span className="legal-section-index data-mono text-[0.6875rem] font-medium text-primary/75" />
        <span className="text-[1.0625rem] font-semibold tracking-[-0.025em] text-foreground">
          {title}
        </span>
      </h2>
      <div className="legal-prose space-y-3">{children}</div>
    </section>
  );
}

export function LegalList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <span
            className="mt-[0.55rem] h-1 w-1 shrink-0 rounded-full bg-primary/60"
            aria-hidden
          />
          <span className="text-[0.9375rem] leading-[1.65] text-muted-foreground">{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function LegalNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-l-[3px] border-primary/70 bg-primary/[0.05] py-3 pl-4 pr-3 text-[0.9375rem] leading-relaxed text-foreground">
      {children}
    </div>
  );
}
