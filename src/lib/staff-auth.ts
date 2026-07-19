import { randomBytes } from "crypto";
import { dbQuery } from "@/src/lib/db";
import { hashPassword, verifyPassword } from "@/src/lib/password";
import type { StaffUser } from "@/src/types/staff";

type StaffRow = {
  id: number;
  email: string;
  username: string;
  password_hash: string;
  role: string;
  doctor_code: string | null;
  display_name: string;
  unit_name: string | null;
  phone: string | null;
  notify_all: boolean;
  is_active: boolean;
};

const SESSION_DAYS = 14;

function normalizeIdentifier(identifier: string) {
  return identifier.trim().toLowerCase();
}

function mapStaff(row: StaffRow): StaffUser {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    role: row.role as StaffUser["role"],
    doctorCode: row.doctor_code,
    displayName: row.display_name,
    unitName: row.unit_name,
    phone: row.phone,
    notifyAll: row.notify_all,
  };
}

export async function authenticateStaff(input: {
  identifier: string;
  password: string;
}) {
  const identifier = normalizeIdentifier(input.identifier);

  const result = await dbQuery<StaffRow>(
    `select id, email, username, password_hash, role, doctor_code,
            display_name, unit_name, phone, notify_all, is_active
     from pasienkonsul.darsi_staff_accounts
     where (lower(email) = $1 or lower(username) = $1) and is_active = true
     limit 1`,
    [identifier]
  );

  const account = result.rows[0];
  if (!account || !verifyPassword(input.password, account.password_hash)) {
    return { error: "invalid_credentials" as const };
  }

  return { staff: mapStaff(account) };
}

export async function createStaffSession(staffId: number) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS);

  await dbQuery(
    `insert into pasienkonsul.staff_sessions (staff_id, token, expires_at)
     values ($1, $2, $3)`,
    [staffId, token, expiresAt.toISOString()]
  );

  return { token, expiresAt };
}

export async function getStaffBySessionToken(token: string): Promise<StaffUser | null> {
  const result = await dbQuery<StaffRow>(
    `select a.id, a.email, a.username, a.password_hash, a.role, a.doctor_code,
            a.display_name, a.unit_name, a.phone, a.notify_all, a.is_active
     from pasienkonsul.staff_sessions s
     join pasienkonsul.darsi_staff_accounts a on a.id = s.staff_id
     where s.token = $1
       and s.expires_at > current_timestamp
       and a.is_active = true
     limit 1`,
    [token]
  );

  const row = result.rows[0];
  return row ? mapStaff(row) : null;
}

export async function revokeStaffSession(token: string) {
  await dbQuery(`delete from pasienkonsul.staff_sessions where token = $1`, [token]);
}

export { hashPassword };
