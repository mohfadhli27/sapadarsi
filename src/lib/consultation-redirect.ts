export type SuggestNewConsultation = {
  complaint: string;
  label: string;
  unitHint: string;
};

const TOPIC_RULES: Array<{
  pattern: RegExp;
  label: string;
  complaint: string;
  unitHint: string;
  outsideSpecialties: RegExp[];
}> = [
  {
    pattern: /jantung|nyeri dada|berdebar|aritmia|kardiolog/i,
    label: "keluhan jantung",
    complaint: "Konsultasi keluhan jantung — ingin pemeriksaan dan saran dokter spesialis jantung",
    unitHint: "Poli Jantung",
    outsideSpecialties: [/tht|telinga|hidung|tenggorok/i, /mata|oftalmolog/i, /anak(?!.*dalam)/i],
  },
  {
    pattern: /telinga|teliga|hidung|tenggorok|sinus|tht/i,
    label: "keluhan THT",
    complaint: "Konsultasi keluhan telinga/hidung/tenggorok — ingin pemeriksaan dokter THT",
    unitHint: "Poli THT",
    outsideSpecialties: [/jantung|kardiolog/i, /mata|oftalmolog/i],
  },
  {
    pattern: /mata|penglihatan|rabun|mata merah/i,
    label: "keluhan mata",
    complaint: "Konsultasi keluhan mata — ingin pemeriksaan dokter spesialis mata",
    unitHint: "Poli Mata",
    outsideSpecialties: [/tht|telinga/i, /jantung|kardiolog/i],
  },
];

const VAGUE_FOLLOW_UP =
  /^(bagaimana|gimana|caranya|bagaimana caranya|lalu bagaimana|terus bagaimana|lalu|terus|ok|oke|baik)\??$/i;

function matchTopic(text: string) {
  return TOPIC_RULES.find((rule) => rule.pattern.test(text)) ?? null;
}

function isOutsideSpecialty(
  topic: (typeof TOPIC_RULES)[number],
  doctorSpecialty?: string | null,
  unitName?: string | null
): boolean {
  const specialty = `${doctorSpecialty ?? ""} ${unitName ?? ""}`;
  return topic.outsideSpecialties.some((s) => s.test(specialty));
}

function collectContextText(input: {
  latestMessage: string;
  initialComplaint?: string | null;
  history?: Array<{ role: string; text: string }>;
}): string {
  const historyText = (input.history ?? [])
    .slice(-12)
    .map((h) => h.text)
    .join(" ");
  return [input.latestMessage, input.initialComplaint ?? "", historyText].join(" ");
}

export function isVagueFollowUpQuestion(message: string): boolean {
  return VAGUE_FOLLOW_UP.test(message.trim());
}

export function resolveNewConsultationSuggestion(input: {
  latestMessage: string;
  initialComplaint?: string | null;
  doctorSpecialty?: string | null;
  unitName?: string | null;
  history?: Array<{ role: string; text: string }>;
}): SuggestNewConsultation | null {
  const specialty = input.doctorSpecialty ?? input.unitName ?? "";
  const contextText = collectContextText(input);
  const latest = input.latestMessage.trim();

  let topic = matchTopic(latest);
  if (!topic && isVagueFollowUpQuestion(latest)) {
    topic = matchTopic(contextText);
  }
  if (!topic) return null;
  if (!isOutsideSpecialty(topic, input.doctorSpecialty, input.unitName)) return null;

  return {
    complaint: topic.complaint,
    label: topic.label,
    unitHint: topic.unitHint,
  };
}

export function isLikelyOutOfScopeConsultation(input: {
  latestMessage: string;
  initialComplaint?: string | null;
  doctorSpecialty?: string | null;
  unitName?: string | null;
  history?: Array<{ role: string; text: string }>;
}): boolean {
  return resolveNewConsultationSuggestion(input) !== null;
}

export function hasRecentSimilarRedirect(
  history: Array<{ role: string; text: string }> | undefined,
  label: string
): boolean {
  const recentDoctor = (history ?? [])
    .filter((h) => h.role === "doctor" || h.role === "coordinator")
    .slice(-3);
  return recentDoctor.some(
    (h) =>
      /konsultasi baru|ajukan konsultasi/i.test(h.text) &&
      h.text.toLowerCase().includes(label.toLowerCase())
  );
}
