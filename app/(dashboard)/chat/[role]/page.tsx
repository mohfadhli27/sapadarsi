"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Baby, Pill, Stethoscope } from "lucide-react";
import { useChatStore } from "@/src/stores/chat-store";
import { useChatStream } from "@/src/hooks/use-chat-stream";
import { usePharmacyThreads } from "@/src/hooks/use-pharmacy-threads";
import { uploadPharmacyPrescriptionPdf, usePharmacyOrders } from "@/src/hooks/use-pharmacy-orders";
import { useDoctorConsultationChat } from "@/src/hooks/use-doctor-consultation-chat";
import { useMidwifeConsultationChat } from "@/src/hooks/use-midwife-consultation-chat";
import { ChatBubble } from "@/src/components/shared/chat-bubble";
import { ChatInput } from "@/src/components/shared/chat-input";
import { TypingIndicator } from "@/src/components/shared/typing-indicator";
import { LiveDoctorPicker } from "@/src/components/doctor/live-doctor-picker";
import { LivePractitionerPicker } from "@/src/components/bidan/live-practitioner-picker";
import { PatientDoctorSidebar } from "@/src/components/doctor/patient-doctor-sidebar";
import { PatientMidwifeSidebar } from "@/src/components/bidan/patient-midwife-sidebar";
import { PatientPharmacySidebar } from "@/src/components/apoteker/patient-pharmacy-sidebar";
import { PharmacyOrderDecisionCard } from "@/src/components/apoteker/pharmacy-order-decision-card";
import { PharmacyReceiptCard } from "@/src/components/apoteker/pharmacy-receipt-card";
import { ConsultationSummaryCard } from "@/src/components/doctor/consultation-summary-card";
import { PrescriptionCard } from "@/src/components/doctor/prescription-card";
import { MobileSidebarDrawer } from "@/src/components/shared/mobile-sidebar-drawer";
import { useChatWorkspace } from "@/src/components/shared/chat-workspace-context";
import { Button } from "@/src/components/ui/button";
import { isSapabidan } from "@/src/config/app-variant";
import { AGENTS, isAgentRoleAvailable } from "@/src/config/agents";
import { ROUTES } from "@/src/config/routes";
import { useAuthStore } from "@/src/stores/auth-store";
import { parseDoctorDisplayName } from "@/src/lib/doctor-display";
import { cn } from "@/src/lib/utils";
import type { AgentRole } from "@/src/types/chat";

const validRoles: AgentRole[] = ["dokter", "bidan", "apoteker"];

const PHARMACY_STARTERS = [
  "Saya ingin menebus resep obat",
  "Upload resep dari dokter/bidan",
  "Cek status pesanan obat saya",
  "Apa fungsi paracetamol dan bagaimana cara pakainya?",
];

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const role = params.role as string;

  const {
    messages,
    phase,
    isStreaming,
    streamingText,
    recommendedDoctors,
    sessionSummary,
    sessionPrescription,
    selectedDoctor,
    consultationSessionId,
    setActiveAgent,
    resetChat,
    setMessages,
    setRecommendedDoctors,
  } = useChatStore();
  const patientId = useAuthStore((s) => s.user?.patientId);
  const { sendMessage: sendStreamMessage } = useChatStream();
  const {
    sendMessage: sendDoctorTriage,
    sendLiveMessage: sendDoctorLiveMessage,
    selectDoctor,
    completeSession: completeDoctorSession,
    isCompletingSession: isDoctorCompletingSession,
    tryResumeLastSession: tryResumeDoctorSession,
    startNewConsultation: startNewDoctorConsultation,
    loadDoctorSessions,
    openDoctorSession,
  } = useDoctorConsultationChat();
  const {
    sendMessage: sendMidwifeTriage,
    sendLiveMessage: sendMidwifeLiveMessage,
    selectPractitioner,
    completeSession: completeMidwifeSession,
    isCompletingSession: isMidwifeCompletingSession,
    tryResumeLastSession: tryResumeMidwifeSession,
    startNewConsultation: startNewMidwifeConsultation,
    loadMidwifeSessions,
    openMidwifeSession,
  } = useMidwifeConsultationChat();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [completingConsultation, setCompletingConsultation] = useState(false);
  const { sidebarOpen, closeSidebar } = useChatWorkspace();

  const isDoctor = role === "dokter";
  const isBidan = role === "bidan";
  const isApoteker = role === "apoteker";
  const pharmacy = usePharmacyThreads(isApoteker ? patientId : undefined);
  const pharmacyOrders = usePharmacyOrders(
    isApoteker ? patientId : undefined,
    isApoteker ? pharmacy.activeSessionId : null
  );
  const isCompletingSession = isDoctor
    ? isDoctorCompletingSession
    : isMidwifeCompletingSession;

  const isEndingConsultation = completingConsultation || isCompletingSession;

  const isValidRole = validRoles.includes(role as AgentRole);
  const agent = isValidRole ? AGENTS[role] : null;
  const roleAllowed = isValidRole && (!isSapabidan || isAgentRoleAvailable(role));

  useEffect(() => {
    if (isSapabidan && role !== "bidan") {
      router.replace(ROUTES.chat("bidan"));
      return;
    }

    if (!isValidRole || (isSapabidan && !isAgentRoleAvailable(role))) {
      router.replace(ROUTES.home);
      return;
    }

    setActiveAgent(role as AgentRole);

    if (role === "dokter") {
      void tryResumeDoctorSession().then((sessionId) => {
        if (sessionId) {
          setSelectedSessionId(sessionId);
          return;
        }
        void loadDoctorSessions().then((sessions) => {
          const active = sessions.find(
            (s) =>
              s.status === "active" ||
              s.status === "waiting_approval" ||
              s.uiPhase === "live" ||
              s.uiPhase === "waiting"
          );
          if (active) setSelectedSessionId(active.sessionId);
        });
      });
    } else if (role === "bidan") {
      void tryResumeMidwifeSession().then((sessionId) => {
        if (sessionId) {
          setSelectedSessionId(sessionId);
          return;
        }
        void loadMidwifeSessions().then((sessions) => {
          const active = sessions.find(
            (s) =>
              s.status === "active" ||
              s.status === "waiting_approval" ||
              s.uiPhase === "live" ||
              s.uiPhase === "waiting"
          );
          if (active) setSelectedSessionId(active.sessionId);
        });
      });
    } else if (role === "apoteker") {
      resetChat();
    } else {
      resetChat();
    }
  }, [
    role,
    isValidRole,
    router,
    setActiveAgent,
    resetChat,
    tryResumeDoctorSession,
    tryResumeMidwifeSession,
    loadDoctorSessions,
    loadMidwifeSessions,
  ]);

  useEffect(() => {
    if (!isApoteker) return;
    setMessages(pharmacy.sessionMessages);
  }, [isApoteker, pharmacy.sessionMessages, setMessages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingText, recommendedDoctors, sessionSummary, isEndingConsultation, isApoteker, pharmacy.sessionMessages]);

  useEffect(() => {
    if (consultationSessionId) {
      setSelectedSessionId(consultationSessionId);
    }
  }, [consultationSessionId]);

  if (!roleAllowed || !agent) return null;

  function handleSend(content: string) {
    if (isDoctor) {
      if (phase === "live") {
        void sendDoctorLiveMessage(content);
      } else if (
        phase === "waiting" ||
        phase === "closed" ||
        phase === "rejected" ||
        phase === "selecting_doctor"
      ) {
        return;
      } else {
        void sendDoctorTriage(content);
      }
      return;
    }
    if (isBidan) {
      if (phase === "live") {
        void sendMidwifeLiveMessage(content);
      } else if (
        phase === "waiting" ||
        phase === "closed" ||
        phase === "rejected" ||
        phase === "selecting_practitioner"
      ) {
        return;
      } else {
        void sendMidwifeTriage(content);
      }
      return;
    }
    if (isApoteker) {
      void (async () => {
        let sid = pharmacy.activeSessionId;
        if (!sid) {
          sid = await pharmacy.createNewSession();
          if (!sid) return;
        }
        setMessages(pharmacy.sessionMessages);
        await sendStreamMessage(content, "apoteker", { sessionId: sid });
        await pharmacy.refreshAfterMessage();
      })();
      return;
    }
    sendStreamMessage(content, role as AgentRole);
  }

  async function handleSelectSession(sessionId: number) {
    setSelectedSessionId(sessionId);
    closeSidebar();
    if (isDoctor) {
      await openDoctorSession(sessionId);
    } else if (isBidan) {
      await openMidwifeSession(sessionId);
    }
  }

  async function handleNewConsultation() {
    setSelectedSessionId(null);
    if (isDoctor) {
      startNewDoctorConsultation();
    } else if (isBidan) {
      startNewMidwifeConsultation();
    }
    closeSidebar();
  }

  async function handlePharmacyPdfUpload(file: File) {
    if (!patientId) return;
    let sid = pharmacy.activeSessionId;
    if (!sid) {
      sid = await pharmacy.createNewSession();
      if (!sid) return;
    }
    await uploadPharmacyPrescriptionPdf({ sessionId: sid, patientId, file });
    await pharmacy.refreshAfterMessage();
    await pharmacyOrders.refresh();
  }

  async function handleNewPharmacyChat() {
    resetChat();
    closeSidebar();
    await pharmacy.createNewSession();
  }

  async function handleSelectPharmacySession(sessionId: number) {
    closeSidebar();
    await pharmacy.selectThread(sessionId);
  }

  const isInputDisabled =
    isStreaming ||
    isEndingConsultation ||
    phase === "waiting" ||
    phase === "closed" ||
    phase === "rejected" ||
    phase === "selecting_doctor" ||
    phase === "selecting_practitioner";

  async function handleCompleteConsultation() {
    if (isEndingConsultation) return;
    setCompletingConsultation(true);
    try {
      if (isDoctor) {
        await completeDoctorSession();
      } else if (isBidan) {
        await completeMidwifeSession();
      }
    } finally {
      setCompletingConsultation(false);
    }
  }

  const headerPractitioner = selectedDoctor?.doctorName
    ? parseDoctorDisplayName(selectedDoctor.doctorName)
    : null;

  const consultationChatMain = (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
      {selectedSessionId && headerPractitioner && (
        <div className="hidden border-b bg-muted/20 px-4 py-2 md:block">
          <p className="text-sm font-semibold">
            {headerPractitioner.prefix && `${headerPractitioner.prefix} `}
            {headerPractitioner.personName}
          </p>
          {headerPractitioner.gelar && (
            <p className="text-xs text-primary">{headerPractitioner.gelar}</p>
          )}
        </div>
      )}

      <div ref={scrollRef} className="chat-scrollbar min-h-0 flex-1 overflow-y-auto py-4">
        {messages.length === 0 && !consultationSessionId && phase === "triage" && (
          <div className="flex h-full min-h-[50vh] flex-col items-center justify-center gap-3 px-6 text-center">
            <div
              className={cn(
                "flex h-16 w-16 items-center justify-center rounded-full text-white shadow-md",
                isBidan ? "bg-pink-500" : "bg-emerald-500"
              )}
            >
              {isBidan ? <Baby className="h-7 w-7" /> : <Stethoscope className="h-7 w-7" />}
            </div>
            <h3 className="text-lg font-semibold text-foreground">Mulai ceritakan keluhan</h3>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              {isBidan
                ? "Ketik keluhan kehamilan, kesehatan ibu/anak, atau perawatan. Sistem akan merekomendasikan bidan & perawat RSI."
                : "Ketik keluhan Anda di bawah. Sistem akan merekomendasikan dokter yang tersedia."}
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <ChatBubble
            key={msg.id}
            role={msg.role}
            content={msg.content}
            timestamp={msg.timestamp}
            senderName={msg.senderName}
          />
        ))}

        {sessionPrescription && (isDoctor || isBidan) && patientId && (
          <PrescriptionCard prescription={sessionPrescription} patientId={patientId} />
        )}

        {phase === "waiting" && (
          <div className="mx-4 my-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-center dark:border-amber-900 dark:bg-amber-950/30">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
              Menunggu {selectedDoctor?.doctorName ?? (isBidan ? "bidan/perawat" : "dokter")} menyetujui
            </p>
            <p className="mt-1 text-xs text-amber-800/80 dark:text-amber-300/80">
              {isBidan
                ? "Permintaan dikirim ke Telegram tim bidan/perawat. Halaman ini akan terupdate setelah disetujui."
                : "Halaman ini akan terupdate otomatis setelah dokter mengonfirmasi."}
            </p>
          </div>
        )}

        {phase === "selecting_doctor" && isDoctor && consultationSessionId && patientId && (
          <LiveDoctorPicker
            sessionId={consultationSessionId}
            patientId={patientId}
            doctors={recommendedDoctors}
            onSelect={(doctor) => void selectDoctor(doctor)}
            loading={isStreaming}
            selectedCode={
              selectedDoctor
                ? `${selectedDoctor.doctorCode}:${selectedDoctor.unitId}`
                : undefined
            }
            onDoctorsUpdate={setRecommendedDoctors}
          />
        )}

        {phase === "selecting_practitioner" && isBidan && consultationSessionId && patientId && (
          <LivePractitionerPicker
            sessionId={consultationSessionId}
            patientId={patientId}
            practitioners={recommendedDoctors}
            onSelect={(practitioner) => void selectPractitioner(practitioner)}
            loading={isStreaming}
            selectedCode={
              selectedDoctor
                ? `${selectedDoctor.doctorCode}:${selectedDoctor.unitId}`
                : undefined
            }
            onPractitionersUpdate={setRecommendedDoctors}
          />
        )}

        {phase === "closed" && sessionSummary && (
          <ConsultationSummaryCard
            summary={sessionSummary}
            providerLabel={isBidan ? "Bidan/Perawat" : "Dokter"}
            downloadUrl={
              patientId && consultationSessionId
                ? isDoctor
                  ? `/api/doctors/consultations/${consultationSessionId}/summary?patientId=${patientId}`
                  : `/api/consultations/${consultationSessionId}/summary?patientId=${patientId}`
                : null
            }
          />
        )}

        {isEndingConsultation && (
          <TypingIndicator
            variant="doctor"
            senderName={selectedDoctor?.doctorName ?? (isBidan ? "Bidan/Perawat" : "Dokter")}
            label="Menyusun ringkasan hasil konsultasi..."
            showTypingDots
          />
        )}

        {isStreaming && !isEndingConsultation && streamingText && (
          <ChatBubble role="assistant" content={streamingText} />
        )}

        {isStreaming && !isEndingConsultation && !streamingText && <TypingIndicator />}
      </div>

      {phase === "live" && !isEndingConsultation && (
        <div className="border-t px-4 py-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            disabled={isStreaming}
            onClick={() => void handleCompleteConsultation()}
          >
            Selesaikan Konsultasi
          </Button>
        </div>
      )}

      <ChatInput
        onSend={handleSend}
        disabled={isInputDisabled}
        placeholder={
          phase === "waiting"
            ? isBidan
              ? "Menunggu bidan/perawat menyetujui konsultasi..."
              : "Menunggu dokter menyetujui konsultasi..."
            : phase === "selecting_doctor"
              ? "Pilih dokter dari daftar di atas"
              : phase === "selecting_practitioner"
                ? "Pilih bidan atau perawat dari daftar di atas"
                : phase === "live"
                  ? isEndingConsultation
                    ? "Menyelesaikan konsultasi..."
                    : selectedDoctor
                      ? `Kirim pesan ke ${selectedDoctor.doctorName}...`
                      : isBidan
                        ? "Ketik pesan untuk bidan/perawat..."
                        : "Ketik pesan untuk dokter..."
                  : phase === "closed"
                    ? "Konsultasi selesai — buka menu untuk konsultasi baru"
                    : "Ceritakan keluhan Anda..."
        }
      />
    </div>
  );

  if (isDoctor) {
    return (
      <div className="relative flex flex-1 overflow-hidden">
        <div className="hidden h-full shrink-0 md:flex md:w-72 lg:w-80">
          <PatientDoctorSidebar
            patientId={patientId}
            selectedSessionId={selectedSessionId ?? consultationSessionId}
            onSelectSession={(id) => void handleSelectSession(id)}
            onNewConsultation={handleNewConsultation}
            loadSessions={loadDoctorSessions}
          />
        </div>

        <MobileSidebarDrawer
          open={sidebarOpen}
          onClose={closeSidebar}
          title="Riwayat Konsultasi"
        >
          <PatientDoctorSidebar
            inDrawer
            patientId={patientId}
            selectedSessionId={selectedSessionId ?? consultationSessionId}
            onSelectSession={(id) => void handleSelectSession(id)}
            onNewConsultation={handleNewConsultation}
            loadSessions={loadDoctorSessions}
            onClose={closeSidebar}
          />
        </MobileSidebarDrawer>

        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col overflow-hidden transition-[filter,opacity] duration-200 md:transition-none",
            sidebarOpen && "max-md:pointer-events-none max-md:opacity-40"
          )}
        >
          {consultationChatMain}
        </div>
      </div>
    );
  }

  if (isBidan) {
    return (
      <div className="relative flex flex-1 overflow-hidden">
        <div className="hidden h-full shrink-0 md:flex md:w-72 lg:w-80">
          <PatientMidwifeSidebar
            patientId={patientId}
            selectedSessionId={selectedSessionId ?? consultationSessionId}
            onSelectSession={(id) => void handleSelectSession(id)}
            onNewConsultation={handleNewConsultation}
            loadSessions={loadMidwifeSessions}
          />
        </div>

        <MobileSidebarDrawer
          open={sidebarOpen}
          onClose={closeSidebar}
          title="Riwayat Konsultasi Bidan"
        >
          <PatientMidwifeSidebar
            inDrawer
            patientId={patientId}
            selectedSessionId={selectedSessionId ?? consultationSessionId}
            onSelectSession={(id) => void handleSelectSession(id)}
            onNewConsultation={handleNewConsultation}
            loadSessions={loadMidwifeSessions}
            onClose={closeSidebar}
          />
        </MobileSidebarDrawer>

        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col overflow-hidden transition-[filter,opacity] duration-200 md:transition-none",
            sidebarOpen && "max-md:pointer-events-none max-md:opacity-40"
          )}
        >
          {consultationChatMain}
        </div>
      </div>
    );
  }

  if (isApoteker) {
    const pharmacyChatMain = (
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
        <div ref={scrollRef} className="chat-scrollbar min-h-0 flex-1 overflow-y-auto py-4">
          {messages.length === 0 && !isStreaming && (
            <div className="flex h-full min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-white shadow-md">
                <Pill className="h-7 w-7" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-foreground">Asisten Apoteker DARSI</h3>
                <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                  Tanyakan info obat atau tebus resep — upload PDF resep dari dokter/bidan,
                  atau kirim resep digital langsung dari konsultasi DARSI.
                </p>
              </div>
              <div className="flex w-full max-w-md flex-col gap-2">
                {PHARMACY_STARTERS.map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    onClick={() => handleSend(starter)}
                    disabled={isStreaming}
                    className="rounded-xl border border-blue-500/20 bg-blue-50/50 px-4 py-3 text-left text-xs leading-relaxed text-foreground transition-colors hover:border-blue-500/35 hover:bg-blue-50 dark:bg-blue-950/20 dark:hover:bg-blue-950/40"
                  >
                    {starter}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) =>
            msg.kind === "pharmacy_receipt" && msg.pharmacyReceipt && pharmacy.activeSessionId ? (
              <div key={msg.id}>
                <ChatBubble
                  role="assistant"
                  content={msg.content}
                  timestamp={msg.timestamp}
                  variant="pharmacy"
                />
                <PharmacyReceiptCard
                  receipt={msg.pharmacyReceipt}
                  sessionId={pharmacy.activeSessionId}
                  patientId={patientId}
                />
              </div>
            ) : (
              <ChatBubble
                key={msg.id}
                role={msg.role}
                content={msg.content}
                timestamp={msg.timestamp}
                senderName={msg.senderName}
                variant={msg.role === "assistant" ? "pharmacy" : "default"}
              />
            )
          )}

          {pharmacyOrders.pendingDecision && patientId && pharmacy.activeSessionId && (
            <PharmacyOrderDecisionCard
              order={pharmacyOrders.pendingDecision}
              patientId={patientId}
              sessionId={pharmacy.activeSessionId}
              onDecisionComplete={() => {
                void pharmacy.refreshAfterMessage();
                void pharmacyOrders.refresh();
              }}
            />
          )}

          {isStreaming && streamingText && (
            <ChatBubble role="assistant" content={streamingText} variant="pharmacy" />
          )}
          {isStreaming && !streamingText && <TypingIndicator />}
        </div>

        <ChatInput
          onSend={handleSend}
          disabled={isStreaming}
          allowPdfUpload
          onUploadPdf={handlePharmacyPdfUpload}
          uploadDisabled={isStreaming}
          placeholder="Tanya obat atau upload resep PDF..."
        />
      </div>
    );

    return (
      <div className="relative flex flex-1 overflow-hidden">
        <div className="hidden h-full shrink-0 md:flex md:w-72 lg:w-80">
          <PatientPharmacySidebar
            threads={pharmacy.threads}
            selectedSessionId={pharmacy.activeSessionId}
            loading={pharmacy.loading}
            onSelectSession={(id) => void handleSelectPharmacySession(id)}
            onNewChat={() => void handleNewPharmacyChat()}
          />
        </div>

        <MobileSidebarDrawer
          open={sidebarOpen}
          onClose={closeSidebar}
          title="Riwayat Chat Apotek"
        >
          <PatientPharmacySidebar
            inDrawer
            threads={pharmacy.threads}
            selectedSessionId={pharmacy.activeSessionId}
            loading={pharmacy.loading}
            onSelectSession={(id) => void handleSelectPharmacySession(id)}
            onNewChat={() => void handleNewPharmacyChat()}
            onClose={closeSidebar}
          />
        </MobileSidebarDrawer>

        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col overflow-hidden transition-[filter,opacity] duration-200 md:transition-none",
            sidebarOpen && "max-md:pointer-events-none max-md:opacity-40"
          )}
        >
          {pharmacyChatMain}
        </div>
      </div>
    );
  }

  return null;
}
