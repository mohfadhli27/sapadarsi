/** Parse nama lengkap dokter RSI (termasuk gelar) untuk tampilan UI. */
export type DoctorDisplayParts = {
  fullName: string;
  prefix: string;
  personName: string;
  gelar: string;
};

export function parseDoctorDisplayName(fullName: string): DoctorDisplayParts {
  const full = fullName.trim();
  if (!full) {
    return { fullName: "Dokter", prefix: "", personName: "Dokter", gelar: "" };
  }

  let rest = full;
  let prefix = "";
  if (/^(dr\.|prof\.|drg\.)/i.test(rest)) {
    const m = rest.match(/^((?:Prof\.\s*)?(?:Dr\.\s*)?(?:dr\.|drg\.))\s*/i);
    if (m) {
      prefix = m[1].trim();
      rest = rest.slice(m[0].length).trim();
    }
  }

  const commaIdx = rest.indexOf(",");
  if (commaIdx > 0) {
    return {
      fullName: full,
      prefix,
      personName: rest.slice(0, commaIdx).trim(),
      gelar: rest.slice(commaIdx + 1).trim(),
    };
  }

  const gelarMatch = rest.match(/\b((?:Sp|Subsp)\.[^\s]+(?:\([^)]*\))?.*)$/i);
  if (gelarMatch && gelarMatch.index && gelarMatch.index > 0) {
    return {
      fullName: full,
      prefix,
      personName: rest.slice(0, gelarMatch.index).trim(),
      gelar: gelarMatch[1].trim(),
    };
  }

  return { fullName: full, prefix, personName: rest, gelar: "" };
}

export function normalizeDoctorNameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/^(prof\.|dr\.|drg\.)\s*/gi, "")
    .replace(/[^a-z0-9]/g, "");
}
