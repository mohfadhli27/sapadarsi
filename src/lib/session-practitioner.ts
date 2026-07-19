import { dbQuery } from "@/src/lib/db";

/** Nama tenaga medis yang ditugaskan pada sesi (dokter/bidan/perawat). */
export async function resolveSessionPractitionerName(
  sessionId: number,
  fallback = "Tenaga Kesehatan"
): Promise<string> {
  const result = await dbQuery<{ doctor_name: string | null }>(
    `select doctor_name from doctor_consultation_meta where session_id = $1 limit 1`,
    [sessionId]
  );
  const name = result.rows[0]?.doctor_name?.trim();
  return name || fallback;
}

export async function isSessionTakeoverActive(sessionId: number): Promise<boolean> {
  const result = await dbQuery<{ doctor_takeover_active: boolean | null }>(
    `select doctor_takeover_active from doctor_consultation_meta where session_id = $1 limit 1`,
    [sessionId]
  );
  return Boolean(result.rows[0]?.doctor_takeover_active);
}
