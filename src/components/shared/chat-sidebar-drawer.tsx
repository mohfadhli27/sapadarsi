"use client";

import type { ReactNode } from "react";
import { useChatWorkspace } from "@/src/components/shared/chat-workspace-context";

type ChatSidebarDrawerProps = {
  sidebar: ReactNode;
  main: ReactNode;
};

export function ChatSidebarDrawer({ sidebar, main }: ChatSidebarDrawerProps) {
  const { sidebarOpen, closeSidebar } = useChatWorkspace();

  return (
    <div className="relative flex h-full min-h-0 w-full flex-1 overflow-hidden md:grid md:grid-cols-[260px_minmax(0,1fr)] lg:grid-cols-[280px_minmax(0,1fr)]">
      {/* Desktop — sidebar selalu tampil */}
      <div className="hidden h-full min-h-0 md:flex">{sidebar}</div>

      {/* Mobile — drawer overlay */}
      {sidebarOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-50 bg-black/50 md:hidden"
            aria-label="Tutup menu"
            onClick={closeSidebar}
          />
          <div className="fixed inset-y-0 left-0 z-50 flex w-[min(88vw,320px)] flex-col border-r bg-background shadow-xl md:hidden">
            {sidebar}
          </div>
        </>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{main}</div>
    </div>
  );
}
