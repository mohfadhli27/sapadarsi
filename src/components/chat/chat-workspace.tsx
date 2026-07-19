"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send } from "lucide-react";
import Link from "next/link";
import { Header } from "@/src/components/layout/header";
import { MobileNav } from "@/src/components/layout/mobile-nav";
import { ChatBubble } from "@/src/components/shared/chat-bubble";
import { TypingIndicator } from "@/src/components/shared/typing-indicator";
import { PhaseStatusBar } from "@/src/components/shared/phase-status-bar";
import { PractitionerCarousel } from "@/src/components/shared/practitioner-carousel";
import { LiveDoctorPicker } from "@/src/components/doctor/live-doctor-picker";
import { PatientDoctorWelcome } from "@/src/components/doctor/patient-doctor-welcome";
import { Button } from "@/src/components/ui/button";
import { useAuthStore } from "@/src/stores/auth-store";
import { useAuthStoresHydrated } from "@/src/hooks/use-auth-hydrated";
import { useChatStore } from "@/src/stores/chat-store";
import { useConsultationChat } from "@/src/hooks/use-consultation-chat";
import { useDoctorConsultationChat } from "@/src/hooks/use-doctor-consultation-chat";
import { useChatStream } from "@/src/hooks/use-chat-stream";
import { usePharmacyThreads } from "@/src/hooks/use-pharmacy-threads";
import { useAgentThreads } from "@/src/hooks/use-agent-threads";
import type { AgentRole } from "@/src/types/chat";
import { isValidAgentRole } from "@/src/config/agents";
import { cn } from "@/src/lib/utils";

const ROLE_LABEL: Record<AgentRole, string> = {
  dokter: "Dokter",
  bidan: "Bidan",
  apoteker: "Apotek",
};

export function ChatWorkspace({ role }: { role: AgentRole }) {
  const router = useRouter();
  const hydrated = useAuthStoresHydrated();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const {
    messages,
    phase,
    isStreaming,
    streamingText,
    recommendedDoctors,
    selectedDoctor,
    consultationSessionId,
    resetChat,
  } = useChatStore();

  const { sendMessage: sendBidan, selectPractitioner } = useConsultationChat("bidan");
  const doctorChat = useDoctorConsultationChat();
  const { sendMessage: sendApotekStream } = useChatStream();
  const pharmacy = usePharmacyThreads(user?.patientId);
  const agentThreads = useAgentThreads(user?.patientId, role);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) {
      router.replace(`/?auth=login`);
    }
  }, [hydrated, isAuthenticated, router]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isStreaming, streamingText]);

  useEffect(() => {
    return () => {
      resetChat();
    };
  }, [resetChat]);

  const displayMessages =
    role === "apoteker" ? pharmacy.sessionMessages : messages;

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);
    try {
      if (role === "dokter") {
        await doctorChat.sendMessage(text);
      } else if (role === "bidan") {
        await sendBidan(text);
      } else {
        const thread = agentThreads.ensureActiveThread();
        await sendApotekStream(text, "apoteker", {
          sessionId: pharmacy.activeSessionId ?? undefined,
          conversationId: thread.id,
          onComplete: (msgs) => agentThreads.syncThreadMessages(thread.id, msgs),
        });
        await pharmacy.refreshAfterMessage();
      }
    } finally {
      setSending(false);
    }
  }, [
    input,
    sending,
    role,
    doctorChat,
    sendBidan,
    sendApotekStream,
    agentThreads,
    pharmacy,
  ]);

  if (!isValidAgentRole(role)) {
    return <p className="p-6 text-destructive">Layanan tidak dikenal</p>;
  }

  const showDoctorWelcome =
    role === "dokter" && !consultationSessionId && messages.length === 0;
  const showBidanPicker =
    role === "bidan" && phase === "selecting_practitioner" && recommendedDoctors.length > 0;
  const showDoctorPicker =
    role === "dokter" &&
    (phase === "selecting_doctor" || recommendedDoctors.length > 0) &&
    phase !== "live" &&
    phase !== "waiting";

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <Header />

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col lg:flex-row">
        {role === "dokter" && (
          <aside className="hidden w-72 shrink-0 border-r bg-muted/20 p-4 lg:block">
            <Button className="mb-4 w-full" onClick={() => doctorChat.startNew()}>
              Konsultasi baru
            </Button>
            <p className="text-xs text-muted-foreground">
              Pilih riwayat dokter atau mulai konsultasi baru dari panel ini.
            </p>
          </aside>
        )}

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b px-4 py-2 lg:hidden">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <p className="text-sm font-semibold">Konsultasi {ROLE_LABEL[role]}</p>
          </div>

          <PhaseStatusBar
            phase={phase}
            doctorName={selectedDoctor?.doctorName ?? doctorChat.selectedDoctorName}
          />

          {showDoctorWelcome ? (
            <PatientDoctorWelcome onNewConsultation={() => void doctorChat.startNew()} />
          ) : (
            <>
              <div className="chat-scrollbar min-h-0 flex-1 overflow-y-auto py-4">
                {displayMessages.map((msg) => (
                  <ChatBubble
                    key={msg.id}
                    role={msg.role}
                    content={msg.content}
                    timestamp={msg.timestamp}
                    senderName={msg.senderName}
                  />
                ))}
                {isStreaming && !streamingText && <TypingIndicator />}
                {isStreaming && streamingText && (
                  <ChatBubble role="assistant" content={streamingText} />
                )}
                <div ref={endRef} />
              </div>

              {showBidanPicker && (
                <div className="border-t bg-muted/20 py-3">
                  <PractitionerCarousel
                    title="Pilih Bidan / Perawat"
                    practitioners={recommendedDoctors}
                    onSelect={(p) => void selectPractitioner(p)}
                    variant="bidan"
                    selectLabel="Pilih"
                  />
                </div>
              )}

              {showDoctorPicker && consultationSessionId && user?.patientId && (
                <div className="border-t bg-muted/20 py-3">
                  <LiveDoctorPicker
                    sessionId={consultationSessionId}
                    patientId={user.patientId}
                    doctors={recommendedDoctors}
                    onSelect={(d) => void doctorChat.selectDoctor(d)}
                    loading={isStreaming}
                    selectedCode={selectedDoctor?.doctorCode}
                    onDoctorsUpdate={(docs) => useChatStore.getState().setRecommendedDoctors(docs)}
                  />
                </div>
              )}

              <div className="border-t bg-background p-4 pb-20 lg:pb-4">
                <form
                  className="mx-auto flex max-w-3xl gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleSend();
                  }}
                >
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    rows={1}
                    placeholder={`Tulis pesan untuk ${ROLE_LABEL[role].toLowerCase()}...`}
                    className={cn(
                      "min-h-11 flex-1 resize-none rounded-xl border border-border/80 bg-muted/30 px-4 py-2.5 text-sm",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                    )}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleSend();
                      }
                    }}
                  />
                  <Button type="submit" size="icon" className="h-11 w-11 shrink-0 rounded-xl" disabled={sending || !input.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>

      <MobileNav />
    </div>
  );
}
