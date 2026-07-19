"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/src/components/layout/theme-toggle";
import { MedicalDisclaimer } from "@/src/components/shared/medical-disclaimer";
import { Logo } from "@/src/components/shared/logo";
import { ChatWorkspaceProvider } from "@/src/components/shared/chat-workspace-context";
import { FloatingChatSidebarButton } from "@/src/components/shared/floating-chat-sidebar-button";
import { DoctorChatNavbar } from "@/src/components/doctor/doctor-chat-navbar";
import { BidanChatNavbar } from "@/src/components/bidan/bidan-chat-navbar";
import { PharmacyChatNavbar } from "@/src/components/apoteker/pharmacy-chat-navbar";

function DefaultChatNavbar() {
  const router = useRouter();

  return (
    <nav className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b border-border/40 bg-background/95 px-4 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <Logo size="sm" showText={false} />
      </div>
      <ThemeToggle />
    </nav>
  );
}

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const role = params?.role as string | undefined;
  const isDoctor = role === "dokter";
  const isBidan = role === "bidan";
  const isApoteker = role === "apoteker";

  return (
    <ChatWorkspaceProvider>
      <div className="flex h-dvh flex-col">
        {isDoctor ? (
          <DoctorChatNavbar />
        ) : isBidan ? (
          <BidanChatNavbar />
        ) : isApoteker ? (
          <PharmacyChatNavbar />
        ) : (
          <DefaultChatNavbar />
        )}
        {isDoctor && <FloatingChatSidebarButton variant="doctor" />}
        {isBidan && <FloatingChatSidebarButton variant="bidan" />}
        {isApoteker && <FloatingChatSidebarButton variant="apoteker" />}
        {!isDoctor && !isBidan && !isApoteker && <MedicalDisclaimer />}
        <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    </ChatWorkspaceProvider>
  );
}
