"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, MessageCircle, User } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { ROUTES } from "@/src/config/routes";

const navItems = [
  { label: "Beranda", href: ROUTES.home, icon: LayoutDashboard },
  { label: "Chat", href: ROUTES.chat("dokter"), icon: MessageCircle },
  { label: "Profil", href: ROUTES.profile, icon: User },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-border bg-background/95 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/60 lg:hidden">
      {navItems.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(item.href);

        return (
          <Link
            key={item.label}
            href={item.href}
            className={cn(
              "flex flex-col items-center gap-1 px-3 py-1 text-[10px] font-medium transition-colors",
              isActive ? "text-primary" : "text-muted-foreground"
            )}
          >
            <item.icon className="h-5 w-5" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
