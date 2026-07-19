import { dbQuery } from "@/src/lib/db";
import { verifyPassword } from "@/src/lib/password";

export async function deletePatientAccount(input: {
  patientId: number;
  password: string;
}) {
  const account = await dbQuery<{
    patient_id: number;
    password_hash: string;
  }>(
    `select patient_id, password_hash
     from pasienkonsul.darsi_patient_accounts
     where patient_id = $1
     limit 1`,
    [input.patientId]
  );

  const row = account.rows[0];
  if (!row) {
    throw new Error("Akun tidak ditemukan");
  }

  if (!verifyPassword(input.password, row.password_hash)) {
    throw new Error("Password salah");
  }

  await dbQuery(
    `delete from pasienkonsul.darsi_patient_accounts where patient_id = $1`,
    [input.patientId]
  );

  return { success: true as const };
}
