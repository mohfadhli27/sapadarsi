"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { ChatBubble } from "@/src/components/shared/chat-bubble";
import { useStaffAuth, useStaffFetch } from "@/src/hooks/use-staff-auth";
import { useConsultationSse } from "@/src/hooks/use-consultation-sse";
import { StaffPrescriptionPanel } from "@/src/components/staff/staff-prescription-panel";
import { StaffTakeoverControl } from "@/src/components/staff/staff-takeover-control";
import { StaffApprovalActions } from "@/src/components/staff/staff-approval-actions";
import type { ConsultationPrescription } from "@/src/types/prescription";
import {
  SESSION_STATUS_LABEL,
  getPhaseBadgeClass,
} from "@/src/lib/consultation-labels";
import {
  isMonitorModeratable,
  mapSseMessageForMonitor,
  type MonitorMessageDto,
} from "@/src/lib/monitor-messages";
import { cn } from "@/src/lib/utils";

type MonitorMessage = MonitorMessageDto;

export type StaffMonitorData = {
  session: { id: number; status: string; initial_complaint: string | null };
  meta: {
    doctor_name: string | null;
    unit_name: string | null;
    monitor_token: string;
    prescription?: ConsultationPrescription | null;
    doctor_takeover_active?: boolean;
  };
  patient: { nama: string | null; no_rm: string } | null;
  messages: MonitorMessage[];
  staffActor?: string;
};

type StaffMonitorPanelProps = {
  sessionId: number;
  onBack?: () => void;
  /** When set, use token-based API (bypass login) instead of staff auth */
  bypassToken?: string;
};

function MessageActions({
  msg,
  canModerate,
  isEditing,
  onEdit,
  onHide,
}: {
  msg: MonitorMessage;
  canModerate: boolean;
  isEditing: boolean;
  onEdit: () => void;
  onHide: () => void;
}) {
  const [confirmHide, setConfirmHide] = useState(false);
  const isPatient = msg.senderType === "patient";
  const isAiSide = isMonitorModeratable(msg.senderType);

  if (!canModerate || isPatient) return null;

  if (confirmHide) {
    return (
      <div className="mx-2 mb-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 lg:mx-4">
        <p className="flex items-start gap-2 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Sembunyikan pesan ini dari pasien? Tindakan tidak bisa dibatalkan.
        </p>
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="destructive" className="h-8" onClick={onHide}>
            Ya, sembunyikan
          </Button>
          <Button size="sm" variant="outline" className="h-8" onClick={() => setConfirmHide(false)}>
            Batal
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2 px-2 pb-1 lg:px-4">
      {isAiSide && (
        <Button
          size="sm"
          variant={isEditing ? "secondary" : "outline"}
          className="h-8 gap-1.5 rounded-lg text-xs"
          onClick={onEdit}
        >
          <Pencil className="h-3.5 w-3.5" />
          {isEditing ? "Sedang diedit" : "Edit pesan"}
        </Button>
      )}
      <Button
        size="sm"
        variant="outline"
        className="h-8 gap-1.5 rounded-lg text-xs text-destructive hover:bg-destructive/5 hover:text-destructive"
        onClick={() => setConfirmHide(true)}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Sembunyikan
      </Button>
    </div>
  );
}

function EditMessagePanel({
  text,
  onChange,
  onSave,
  onCancel,
  saving,
}: {
  text: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  saving?: boolean;
}) {
  return (
    <div className="mx-2 mb-3 rounded-xl border border-primary/30 bg-primary/5 p-3 lg:mx-4">
      <p className="mb-2 text-xs font-semibold text-primary">Edit pesan sebelum dikirim ke pasien</p>
      <textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className="w-full resize-none rounded-xl border border-border/80 bg-background px-3 py-2.5 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
        placeholder="Tulis ulang pesan dengan bahasa yang lebih tepat..."
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" className="h-9 gap-1.5" disabled={!text.trim() || saving} onClick={onSave}>
          <Check className="h-4 w-4" />
          Simpan perubahan
        </Button>
        <Button size="sm" variant="outline" className="h-9 gap-1.5" onClick={onCancel}>
          <X className="h-4 w-4" />
          Batal
        </Button>
      </div>
    </div>
  );
}

export function StaffMonitorPanel({ sessionId, onBack, bypassToken }: StaffMonitorPanelProps) {
  const { staff } = useStaffAuth();
  const staffFetch = useStaffFetch();
  const sessionToken = useStaffAuth().sessionToken;
  const [data, setData] = useState<StaffMonitorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [takeoverText, setTakeoverText] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isBypass = Boolean(bypassToken);
  const actor = data?.meta?.doctor_name ?? staff?.displayName ?? data?.staffActor ?? "Dokter";

  const bypassFetch = useCallback(
    async (input: RequestInfo, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      headers.set("Content-Type", "application/json");
      return fetch(input, { ...init, headers });
    },
    []
  );

  const apiFetch = isBypass ? bypassFetch : staffFetch;
  const apiBase = isBypass
    ? `/api/staff/monitor/${bypassToken}`
    : `/api/staff/consultations/${sessionId}`;

  const load = useCallback(async () => {
    try {
      const res = await apiFetch(apiBase);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Gagal memuat");
      setData({
        ...json,
        messages: Array.isArray(json.messages) ? json.messages : [],
      });
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat");
    } finally {
      setLoading(false);
    }
  }, [apiBase, apiFetch]);

  const streamUrl = isBypass
    ? `/api/staff/monitor/${bypassToken}/stream`
    : sessionToken
      ? `/api/staff/consultations/${sessionId}/stream?token=${encodeURIComponent(sessionToken)}`
      : null;

  const sseEnabled = isBypass ? Boolean(bypassToken) : Boolean(sessionId && sessionToken);

  useConsultationSse(streamUrl, sseEnabled, {
    onStatus: (statusData) => {
      setData((prev) =>
        prev
          ? {
              ...prev,
              session: { ...prev.session, status: statusData.status },
              meta: {
                ...prev.meta,
                doctor_takeover_active:
                  statusData.doctorTakeoverActive ?? prev.meta.doctor_takeover_active,
              },
            }
          : prev
      );
    },
    onMessages: (messages) => {
      setData((prev) =>
        prev
          ? {
              ...prev,
              messages: messages.map(mapSseMessageForMonitor),
            }
          : prev
      );
    },
    onPrescription: () => {
      void load();
    },
  });

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.messages.length]);

  async function postAction(body: Record<string, unknown>) {
    setActionLoading(true);
    try {
      const res = await apiFetch(apiBase, {
        method: "POST",
        body: JSON.stringify({ actor, ...body }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Gagal");

      if (body.action === "edit_message" && body.messageId && body.editedText) {
        const messageId = Number(body.messageId);
        const editedText = String(body.editedText);
        setData((prev) =>
          prev
            ? {
                ...prev,
                messages: prev.messages.map((m) =>
                  m.id === messageId ? { ...m, text: editedText } : m
                ),
              }
            : prev
        );
      }

      if (body.action === "takeover" && body.message) {
        setData((prev) =>
          prev
            ? {
                ...prev,
                meta: { ...prev.meta, doctor_takeover_active: true },
              }
            : prev
        );
      }

      await load();
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
        Memuat sesi konsultasi...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center text-destructive">
        {error || "Sesi tidak ditemukan"}
      </div>
    );
  }

  const { session, meta, patient, messages } = data;
  const statusLabel = SESSION_STATUS_LABEL[session.status] ?? session.status;
  const canTakeover = session.status === "active";
  const takeoverActive = Boolean(meta.doctor_takeover_active);
  const canModerate = session.status === "active";
  const canPrescribe = session.status === "active" || session.status === "completed";
  const existingPrescription = meta.prescription ?? null;

  const sidebar = (
    <aside className="flex flex-col gap-4 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto">
      {onBack && (
        <Button variant="ghost" size="sm" className="-ml-2 w-fit gap-1" onClick={onBack}>
          <ChevronLeft className="h-4 w-4" />
          Kembali ke daftar pasien
        </Button>
      )}

      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Pasien · Sesi #{session.id}
            </p>
            <h2 className="mt-1 text-lg font-bold">{patient?.nama ?? "Pasien"}</h2>
            <p className="text-sm text-muted-foreground">No. RM {patient?.no_rm ?? "-"}</p>
          </div>
          <span
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold",
              getPhaseBadgeClass("", session.status)
            )}
          >
            {statusLabel}
          </span>
        </div>

        <div className="mt-4 rounded-xl bg-muted/30 px-3 py-2.5 text-sm">
          <p className="text-xs font-medium text-muted-foreground">Keluhan awal</p>
          <p className="mt-0.5 leading-relaxed">{session.initial_complaint ?? "-"}</p>
        </div>

        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
          <p>{meta.unit_name}</p>
          <p className="font-medium text-foreground">{meta.doctor_name}</p>
        </div>

        {session.status === "active" && (
          <p
            className={cn(
              "mt-3 inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium",
              takeoverActive
                ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
            )}
          >
            {takeoverActive ? "Mode ambil alih — asisten AI nonaktif" : "Asisten AI menjawab otomatis"}
          </p>
        )}
      </div>

      {session.status === "waiting_approval" && (
        <StaffApprovalActions
          disabled={actionLoading}
          showTelegramHint
          onApprove={async () => {
            await postAction({ action: "approve" });
          }}
          onReject={async (reason) => {
            await postAction({ action: "reject", reason });
          }}
        />
      )}

      {canPrescribe && (
        <StaffPrescriptionPanel
          sessionId={session.id}
          patientName={patient?.nama}
          doctorName={meta.doctor_name}
          existing={existingPrescription}
          disabled={actionLoading}
          onSave={async (payload) => {
            const res = await apiFetch(apiBase, {
              method: "POST",
              body: JSON.stringify({ actor, ...payload }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message ?? "Gagal menyimpan resep");
            await load();
          }}
        />
      )}
    </aside>
  );

  const chatPanel = (
    <section className="flex min-h-[min(70vh,720px)] flex-1 flex-col overflow-hidden rounded-2xl border bg-card shadow-sm lg:min-h-[calc(100dvh-8.5rem)]">
      <div className="shrink-0 border-b px-4 py-3 lg:px-5">
        <p className="text-sm font-semibold">Percakapan dengan pasien</p>
        <p className="text-xs text-muted-foreground">
          {messages.length} pesan · pembaruan realtime
          {!takeoverActive && canTakeover && " · edit/sembunyikan jika respons AI kurang tepat"}
        </p>
      </div>

      <div className="chat-scrollbar min-h-0 flex-1 overflow-y-auto py-3">
        {messages.length === 0 && (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Belum ada pesan dalam sesi ini
          </p>
        )}

        <div className="w-full px-4 sm:px-6 lg:px-8">
          {messages.map((msg) => {
            const isEditing = editId === msg.id;
            const bubbleRole =
              msg.senderType === "patient"
                ? "user"
                : msg.senderType === "agent"
                  ? "coordinator"
                  : msg.senderType === "staff"
                    ? "doctor"
                    : "assistant";

            return (
              <div key={msg.id} className={cn("group", isEditing && "bg-primary/5")}>
                <ChatBubble
                  role={bubbleRole}
                  content={msg.text}
                  senderName={
                    msg.senderType === "staff"
                      ? (meta.doctor_name ?? actor)
                      : msg.senderType === "agent"
                        ? "Koordinator Poli"
                        : undefined
                  }
                  timestamp={new Date(msg.createdAt)}
                />

                <MessageActions
                  msg={msg}
                  canModerate={canModerate}
                  isEditing={isEditing}
                  onEdit={() => {
                    setEditId(msg.id);
                    setEditText(msg.text);
                  }}
                  onHide={() => void postAction({ action: "hide_message", messageId: msg.id })}
                />

                {isEditing && (
                  <EditMessagePanel
                    text={editText}
                    onChange={setEditText}
                    saving={actionLoading}
                    onCancel={() => {
                      setEditId(null);
                      setEditText("");
                    }}
                    onSave={() =>
                      void postAction({
                        action: "edit_message",
                        messageId: msg.id,
                        editedText: editText,
                      }).then(() => {
                        setEditId(null);
                        setEditText("");
                      })
                    }
                  />
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {canTakeover && (
        <div className="shrink-0 border-t">
          <StaffTakeoverControl
            takeoverActive={takeoverActive}
            doctorName={meta.doctor_name ?? actor}
            actionLoading={actionLoading}
            message={takeoverText}
            onMessageChange={setTakeoverText}
            onEnableTakeover={() => void postAction({ action: "enable_takeover" })}
            onDisableTakeover={() => void postAction({ action: "disable_takeover" })}
            onSendMessage={() =>
              void postAction({ action: "takeover", message: takeoverText }).then(() =>
                setTakeoverText("")
              )
            }
          />
        </div>
      )}
    </section>
  );

  return (
    <div className="flex flex-1 flex-col gap-4 lg:grid lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)] lg:items-stretch lg:gap-5 xl:grid-cols-[minmax(300px,360px)_minmax(0,1fr)]">
      {sidebar}
      {chatPanel}
    </div>
  );
}
