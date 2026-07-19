/**
 * Konteks thread konsultasi untuk agent — riwayat lengkap sesi (termasuk edit staf).
 */

export type AgentThreadRow = {
  sender_type: string;
  message_text: string | null;
  edited_text?: string | null;
  hidden_at?: Date | null;
  staff_actor?: string | null;
};

export function effectiveThreadText(row: AgentThreadRow): string {
  const edited = row.edited_text?.trim();
  if (edited) return edited;
  return (row.message_text ?? "").trim();
}

export function filterVisibleThreadRows<T extends AgentThreadRow>(rows: T[]): T[] {
  return rows.filter((r) => !r.hidden_at && effectiveThreadText(r).length > 0);
}

export type MidwifeHistoryEntry = {
  role: "patient" | "midwife" | "coordinator";
  text: string;
};

export function mapMidwifeHistoryFromThread(rows: AgentThreadRow[]): MidwifeHistoryEntry[] {
  return filterVisibleThreadRows(rows)
    .filter((m) => m.sender_type !== "system")
    .map((m) => {
      let role: MidwifeHistoryEntry["role"];
      if (m.sender_type === "patient") role = "patient";
      else if (m.sender_type === "agent") role = "coordinator";
      else role = "midwife";
      return { role, text: effectiveThreadText(m) };
    });
}

export function formatThreadForPrompt(
  entries: Array<{ label: string; text: string }>
): string {
  if (!entries.length) return "";
  return entries.map((e) => `${e.label}: ${e.text}`).join("\n");
}

export function midwifeHistoryToPromptLines(history: MidwifeHistoryEntry[]): string {
  return formatThreadForPrompt(
    history.map((h) => ({
      label: h.role === "patient" ? "Pasien" : h.role === "midwife" ? "Bidan" : "Koordinator",
      text: h.text,
    }))
  );
}
