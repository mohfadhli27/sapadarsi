export function calcPatientAge(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    years -= 1;
  }
  return years;
}

export function extractPatientFirstName(name?: string | null): string | null {
  const first = name?.trim().split(/\s+/)[0];
  return first && first.length > 1 ? first : null;
}

/** Panggilan sopan RS — gelar + nama depan, mis. "Ibu Dewi", "Bapak Budi". */
export function resolvePatientHonorific(input: {
  sex?: string | null;
  birthDate?: string | null;
  name?: string | null;
}): string {
  const age = calcPatientAge(input.birthDate);
  const sex = input.sex?.trim().toUpperCase();
  const firstName = extractPatientFirstName(input.name);

  if (age !== null && age < 17) {
    return firstName ? `Adik ${firstName}` : "Adik";
  }
  if (sex === "L") {
    return firstName ? `Bapak ${firstName}` : "Bapak";
  }
  if (sex === "P") {
    return firstName ? `Ibu ${firstName}` : "Ibu";
  }
  return firstName ? `Bapak/Ibu ${firstName}` : "Bapak/Ibu";
}

/** Singkatan — dipakai jarang; lebih baik hilangkan vocative daripada pakai Bu/Pak berulang. */
export function resolvePatientShortHonorific(input: {
  sex?: string | null;
  birthDate?: string | null;
}): string {
  const age = calcPatientAge(input.birthDate);
  const sex = input.sex?.trim().toUpperCase();

  if (age !== null && age < 17) return "Adik";
  if (sex === "L") return "Pak";
  if (sex === "P") return "Bu";
  return "Bu/Pak";
}

export function extractDoctorSpecialtyLabel(
  unitName?: string | null,
  doctorName?: string | null
): string {
  const fromName = doctorName?.match(/Sp\.[A-Za-z.-]+/i)?.[0];
  if (fromName) return fromName;
  if (unitName?.toLowerCase().includes("tht")) return "Spesialis THT";
  if (unitName?.toLowerCase().includes("jantung")) return "Spesialis Jantung";
  if (unitName?.toLowerCase().includes("mata")) return "Spesialis Mata";
  if (unitName?.toLowerCase().includes("anak")) return "Spesialis Anak";
  if (unitName?.toLowerCase().includes("penyakit dalam")) return "Spesialis Penyakit Dalam";
  return unitName ?? "poli ini";
}
