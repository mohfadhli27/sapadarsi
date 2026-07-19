/** Normalisasi pesan DB → tampilan panel monitor staf. */
export type MonitorSenderType = "patient" | "staff" | "agent" | "system";

export type MonitorMessageDto = {
  id: number;
  senderType: MonitorSenderType;
  text: string;
  isTakeover: boolean;
  createdAt: string;
};

export function mapVisibleMessageForMonitor(m: {
  id: number;
  role: string;
  text: string;
  senderType?: string;
  isTakeover?: boolean;
  createdAt: Date | string;
}): MonitorMessageDto {
  let senderType: MonitorSenderType;
  if (m.role === "user") {
    senderType = "patient";
  } else if (m.role === "doctor") {
    senderType = "staff";
  } else if (m.role === "coordinator" || m.role === "assistant") {
    senderType = "agent";
  } else if (m.senderType === "patient") {
    senderType = "patient";
  } else if (
    m.senderType === "staff" ||
    m.senderType === "doctor" ||
    m.senderType === "ai"
  ) {
    senderType = "staff";
  } else if (m.senderType === "agent") {
    senderType = "agent";
  } else {
    senderType = "system";
  }

  return {
    id: m.id,
    senderType,
    text: m.text,
    isTakeover: Boolean(m.isTakeover),
    createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : String(m.createdAt),
  };
}

export function mapSseMessageForMonitor(m: {
  id: number;
  role: string;
  text: string;
  isTakeover?: boolean;
  createdAt: string | Date;
}): MonitorMessageDto {
  return mapVisibleMessageForMonitor(m);
}

export function isMonitorModeratable(senderType: MonitorSenderType): boolean {
  return senderType === "staff" || senderType === "agent";
}
