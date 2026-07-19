type HistoryRow = { sender_type: string; message_text: string };

export type PharmacyIntent =
  | "interaction"
  | "dose_safety"
  | "drug_info"
  | "follow_up"
  | "prescription_upload_help"
  | "prescription_order_status"
  | "prescription_order_decision"
  | "general";

const DRUG_KEYWORDS = [
  "paracetamol",
  "parasetamol",
  "ibuprofen",
  "amoxicillin",
  "amoksisilin",
  "antibiotik",
  "omeprazole",
  "omeprazol",
  "metformin",
  "amlodipine",
  "amlodipin",
  "captopril",
  "azithromycin",
  "azitromisin",
  "dexamethasone",
  "dekametason",
  "cetirizine",
  "setirizin",
  "loratadine",
  "loratadin",
  "vitamin",
  "obat batuk",
  "obat flu",
];

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function patientFirstName(fullName?: string): string | null {
  if (!fullName?.trim()) return null;
  const first = fullName.trim().split(/\s+/)[0];
  if (!first || first.length < 2) return null;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

export function extractDrugsFromText(text: string): string[] {
  const m = normalizeText(text);
  const found: string[] = [];
  for (const drug of DRUG_KEYWORDS) {
    if (m.includes(drug)) {
      found.push(drug === "parasetamol" ? "paracetamol" : drug);
    }
  }
  return [...new Set(found)];
}

function isFollowUpMessage(message: string): boolean {
  const m = normalizeText(message);
  if (m.length > 100) return false;
  return (
    /\b(itu|tadi|yang tadi|maksudnya|maksud saya|sekali minum|sekaligus)\b/.test(m) ||
    (/\b(\d+)\s*(tablet|pil|kaplet|kapsul)\b/.test(m) &&
      extractDrugsFromText(m).length === 0)
  );
}

export function detectPharmacyIntent(
  message: string,
  history: HistoryRow[]
): PharmacyIntent {
  const m = normalizeText(message);
  const drugsInMessage = extractDrugsFromText(m);

  if (
    /\b(upload|unggah|kirim)\b.*\b(resep|pdf)\b/.test(m) ||
    /\bmenebus resep\b|\btebus resep\b/.test(m)
  ) {
    return "prescription_upload_help";
  }

  if (
    /\b(status|sudah diproses|sudah siap|pesanan obat|order obat)\b/.test(m) &&
    /\b(resep|obat|pesanan|order)\b/.test(m)
  ) {
    return "prescription_order_status";
  }

  if (
    /\b(antar|delivery|ambil sendiri|pickup|batalkan pesanan)\b/.test(m) &&
    /\b(obat|resep|pesanan)\b/.test(m)
  ) {
    return "prescription_order_decision";
  }

  if (
    /\b(\d+)\s*(tablet|pil|kaplet|kapsul)\b/.test(m) ||
    /\bsekaligus\b|\bsekali minum\b|\boverdosis\b|\bkebanyakan\b/.test(m)
  ) {
    return "dose_safety";
  }

  if (isFollowUpMessage(message) && drugsInMessage.length === 0) {
    return "follow_up";
  }

  if (
    drugsInMessage.length >= 2 &&
    /\b(boleh|bisa|aman|bersamaan|bareng|dicampur|minum)\b/.test(m)
  ) {
    return "interaction";
  }

  if (drugsInMessage.length >= 2) return "interaction";
  if (drugsInMessage.length === 1) return "drug_info";
  return "general";
}

/** Obat yang relevan untuk query saat ini — tidak selalu semua obat dari riwayat chat. */
export function inferFocusDrugs(message: string, history: HistoryRow[]): string[] {
  const intent = detectPharmacyIntent(message, history);
  const inMessage = extractDrugsFromText(message);

  if (inMessage.length > 0) {
    if (intent === "dose_safety" || intent === "follow_up") {
      return inMessage.slice(0, 1);
    }
    return inMessage;
  }

  if (intent === "follow_up" || intent === "dose_safety") {
    const userMsgs = history
      .filter((h) => h.sender_type === "patient")
      .slice(-4)
      .reverse();

    for (const row of userMsgs) {
      const drugs = extractDrugsFromText(row.message_text);
      if (drugs.length === 1) return drugs;
      if (drugs.length > 1 && intent === "dose_safety") {
        return [drugs[0]];
      }
    }
  }

  return inMessage;
}

export function buildSearchQuery(message: string, focusDrugs: string[]): string {
  if (focusDrugs.length === 0) return message;
  const m = normalizeText(message);
  const missing = focusDrugs.filter((d) => !m.includes(d));
  if (missing.length === 0) return message;
  return `${message} ${missing.join(" ")}`;
}

export function buildIntentGuidance(input: {
  intent: PharmacyIntent;
  focusDrugs: string[];
  patientFirstName?: string | null;
  isFollowUp: boolean;
}): string {
  const nameHint = input.patientFirstName
    ? `Sapa dengan nama depan pasien ("Halo ${input.patientFirstName}," atau variasinya). Jangan pakai sapaan generik yang sama setiap kali.`
    : "Sapa hangat tanpa template yang repetitif.";

  const focusHint =
    input.focusDrugs.length > 0
      ? `Fokus HANYA pada: ${input.focusDrugs.join(", ")}. Jangan bahas obat lain yang tidak ditanyakan.`
      : "Jawab sesuai pertanyaan, jangan menambah obat yang tidak relevan.";

  const lines = ["[INTERNAL — panduan gaya jawaban]", nameHint, focusHint];

  switch (input.intent) {
    case "interaction":
      lines.push(
        "Mode: perbandingan/interaksi obat.",
        "Gunakan format kartu obat apple-to-apple (4 poin identik per obat) + section Interaksi.",
        "Hanya untuk obat yang ditanyakan sekarang."
      );
      break;
    case "dose_safety":
      lines.push(
        "Mode: pertanyaan dosis/keamanan.",
        "Jawab LANGSUNG di awal (Boleh/Tidak + alasan singkat).",
        "JANGAN ulang template lengkap. JANGAN bahas obat lain.",
        "Tanpa section Interaksi kecuali pasien tanya interaksi.",
        "Format singkat: sapaan → jawaban langsung → 2-3 poin risiko/panduan → penutup."
      );
      break;
    case "follow_up":
      lines.push(
        "Mode: tindak lanjut percakapan.",
        "Baca riwayat chat untuk konteks, tapi jawab HANYA pertanyaan terbaru.",
        "Jangan mengulang penjelasan panjang dari jawaban sebelumnya.",
        "Format singkat dan langsung ke inti."
      );
      break;
    case "drug_info":
      lines.push(
        "Mode: info satu obat.",
        "Satu kartu obat (4 poin) atau jawaban naratif ringkas.",
        "Tanpa section interaksi jika tidak ditanya."
      );
      break;
    default:
      lines.push(
        "Mode: umum.",
        "Jawab natural sesuai pertanyaan, tanpa memaksa template panjang."
      );
  }

  if (input.isFollowUp) {
    lines.push("Ini pertanyaan lanjutan — gunakan riwayat chat, jangan mulai dari nol.");
  }

  return lines.join("\n");
}
