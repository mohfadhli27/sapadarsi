import { dbQuery } from "@/src/lib/db";
import { verifyPassword } from "@/src/lib/password";

type AccountRow = {
  patient_id: number;
  email: string;
  username: string;
  password_hash: string;
  no_rm: string;
  nama: string | null;
};

function normalizeIdentifier(identifier: string) {
  return identifier.trim().toLowerCase();
}

export async function authenticatePatient(input: {
  identifier: string;
  password: string;
}) {
  const identifier = normalizeIdentifier(input.identifier);

  const result = await dbQuery<AccountRow>(
    `select a.patient_id, a.email, a.username, a.password_hash, p.no_rm, p.nama
     from pasienkonsul.darsi_patient_accounts a
     join pasienkonsul.b_ms_pasien p on p.id = a.patient_id
     where lower(a.email) = $1 or lower(a.username) = $1
     limit 1`,
    [identifier]
  );

  const account = result.rows[0];
  if (!account) {
    return { error: "invalid_credentials" as const };
  }

  if (!verifyPassword(input.password, account.password_hash)) {
    return { error: "invalid_credentials" as const };
  }

  return {
    patientId: Number(account.patient_id),
    noRm: account.no_rm,
    name: account.nama!,
    email: account.email,
    username: account.username,
  };
}
