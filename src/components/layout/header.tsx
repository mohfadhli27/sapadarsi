"use client";

import { Menu, LogOut, User } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Logo } from "@/src/components/shared/logo";
import { useUIStore } from "@/src/stores/ui-store";
import { useAuth } from "@/src/hooks/use-auth";
import { ThemeToggle } from "@/src/components/layout/theme-toggle";

export function Header() {
  const { toggleSidebar } = useUIStore();
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border/50 bg-background/90 px-4 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 lg:hidden" onClick={toggleSidebar}>
          <Menu className="h-4 w-4" />
        </Button>
        <Logo size="sm" />
      </div>

      <div className="flex items-center gap-1.5">
        <ThemeToggle />
        {user && (
          <>
            <div className="hidden items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 sm:flex">
              <User className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs font-medium">{user.name}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={logout} className="h-8 w-8">
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
