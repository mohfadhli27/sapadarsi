"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Menu,
  X,
  Home,
  LogIn,
  LogOut,
  Shield,
  FileText,
  ChevronRight,
} from "lucide-react";
import { useAuthStore } from "@/src/stores/auth-store";
import { useAuth } from "@/src/hooks/use-auth";
import { getConsultationServices } from "@/src/config/consultation-services";
import { getBrand } from "@/src/config/brand";
import { isSapabidan } from "@/src/config/app-variant";
import { SapabidanMark } from "@/src/components/shared/sapabidan-mark";
import { Logo } from "@/src/components/shared/logo";
import { cn } from "@/src/lib/utils";

interface MobileMenuProps {
  onLoginClick: () => void;
}

function NavItem({
  icon: Icon,
  label,
  onClick,
  href,
  active,
  destructive,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  onClick?: () => void;
  href?: string;
  active?: boolean;
  destructive?: boolean;
}) {
  const className = cn(
    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium tracking-[-0.01em] transition-colors",
    active && "bg-primary/[0.08] text-foreground",
    !active && !destructive && "text-foreground/90 hover:bg-muted/50",
    destructive && "text-destructive hover:bg-destructive/[0.06]"
  );

  const content = (
    <>
      <Icon
        className={cn(
          "h-[1.125rem] w-[1.125rem] shrink-0",
          active ? "text-primary" : destructive ? "text-destructive" : "text-muted-foreground"
        )}
        strokeWidth={2}
      />
      <span className="min-w-0 flex-1">{label}</span>
      {href ? <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/30" /> : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} onClick={onClick} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}

function NavSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1">
      <h2 className="px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <div className="space-y-0.5">{children}</div>
    </section>
  );
}

export function MobileMenu({ onLoginClick }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const reducedMotion = useReducedMotion();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const { logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const brand = getBrand();
  const consultationServices = getConsultationServices();

  useEffect(() => setMounted(true), []);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => closeButtonRef.current?.focus(), 50);

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.clearTimeout(t);
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  function handleNav(href: string, available: boolean) {
    if (!available) return;
    close();
    if (isAuthenticated) {
      router.push(href);
    } else {
      setTimeout(() => onLoginClick(), 120);
    }
  }

  const drawerTransition = reducedMotion
    ? { duration: 0.15 }
    : { type: "spring" as const, stiffness: 420, damping: 38, mass: 0.8 };

  const drawer =
    mounted && typeof document !== "undefined"
      ? createPortal(
          <AnimatePresence>
            {open ? (
              <div className="fixed inset-0 z-[200]">
                <motion.button
                  type="button"
                  className="absolute inset-0 bg-foreground/20 backdrop-blur-[2px]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reducedMotion ? 0.1 : 0.18 }}
                  onClick={close}
                  aria-label="Tutup menu"
                />

                <motion.aside
                  role="dialog"
                  aria-modal="true"
                  aria-label="Menu navigasi"
                  id="sapabidan-mobile-nav"
                  className="absolute inset-y-0 left-0 flex w-[min(88vw,20rem)] flex-col border-r border-border/50 bg-background"
                  initial={{ x: reducedMotion ? 0 : "-100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: reducedMotion ? 0 : "-100%" }}
                  transition={drawerTransition}
                >
                  <div className="shrink-0 border-b border-border/40">
                    <div className="flex items-center justify-between gap-2 px-3 py-2">
                      {isSapabidan ? (
                        <SapabidanMark size={28} />
                      ) : (
                        <Logo size="sm" showText />
                      )}
                      <button
                        ref={closeButtonRef}
                        type="button"
                        onClick={close}
                        className="app-icon-btn -mr-1 shrink-0"
                        aria-label="Tutup menu"
                      >
                        <X className="h-5 w-5" strokeWidth={2} />
                      </button>
                    </div>

                    {isAuthenticated && user ? (
                      <button
                        type="button"
                        onClick={() => {
                          router.push("/profil");
                          close();
                        }}
                        className="flex w-full items-center gap-2.5 border-t border-border/30 px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold leading-tight text-foreground">
                            {user.name}
                          </p>
                          <p className="data-mono truncate text-[11px] leading-tight text-muted-foreground">
                            {user.medicalRecordNumber
                              ? user.medicalRecordNumber.replace(/^RM\s*/i, "RM ")
                              : user.email}
                          </p>
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/35" />
                      </button>
                    ) : (
                      <div className="border-t border-border/30 px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            close();
                            setTimeout(() => onLoginClick(), 120);
                          }}
                          className="flex h-10 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-95 active:opacity-90"
                        >
                          <LogIn className="h-4 w-4" strokeWidth={2.25} />
                          Masuk atau daftar
                        </button>
                      </div>
                    )}
                  </div>

                  <nav className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-3">
                    <NavSection title="Menu">
                      <NavItem
                        icon={Home}
                        label="Beranda"
                        href="/"
                        onClick={close}
                        active={pathname === "/"}
                      />
                    </NavSection>

                    <NavSection title="Konsultasi">
                      {consultationServices.map((item) => (
                        <NavItem
                          key={item.id}
                          icon={item.icon}
                          label={item.label.replace(/^Konsultasi\s+/i, "")}
                          onClick={() => handleNav(item.href, item.available)}
                          active={pathname.startsWith(item.href)}
                        />
                      ))}
                    </NavSection>

                    <NavSection title="Informasi">
                      <NavItem
                        icon={Shield}
                        label="Kebijakan privasi"
                        href="/kebijakan-privasi"
                        onClick={close}
                        active={pathname === "/kebijakan-privasi"}
                      />
                      <NavItem
                        icon={FileText}
                        label="Syarat & ketentuan"
                        href="/syarat-ketentuan"
                        onClick={close}
                        active={pathname === "/syarat-ketentuan"}
                      />
                    </NavSection>
                  </nav>

                  {isAuthenticated ? (
                    <div className="shrink-0 border-t border-border/50 px-3 py-2">
                      <NavItem
                        icon={LogOut}
                        label="Keluar"
                        destructive
                        onClick={() => {
                          logout();
                          close();
                        }}
                      />
                    </div>
                  ) : null}

                  <div className="shrink-0 border-t border-border/50 px-3 py-2 pb-2">
                    <p className="text-center text-[10px] leading-snug text-muted-foreground">
                      {brand.heroSubtitle}
                    </p>
                  </div>
                </motion.aside>
              </div>
            ) : null}
          </AnimatePresence>,
          document.body
        )
      : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="app-icon-btn"
        aria-label="Buka menu"
        aria-expanded={open}
        aria-controls="sapabidan-mobile-nav"
      >
        <Menu className="h-5 w-5" strokeWidth={2} />
      </button>
      {drawer}
    </>
  );
}
