import "server-only";
import { all, one } from "./db";
import { VERIFICATION_TYPES, type VerificationType } from "./catalog";

export type Profile = {
  user_id: number;
  name: string;
  email: string;
  tier: string;
  created_at: string;
  last_active_at: string;
  gender: string;
  seeking: string;
  birth_year: number | null;
  city: string;
  country: string;
  nationality: string;
  languages: string;
  archetype: string;
  occupation: string;
  net_worth: string;
  intent: string;
  interests: string;
  bio: string;
  age_min: number;
  age_max: number;
  real_dating: number;
  companion_provider: number;
  incognito: number;
  photo_path: string | null;
  traits: string;
  hue: number;
};

const PROFILE_SELECT = `SELECT p.*, u.name, u.email, u.tier, u.created_at, u.last_active_at FROM profiles p JOIN users u ON u.id = p.user_id`;

export function getProfile(userId: number) {
  return one<Profile>(`${PROFILE_SELECT} WHERE p.user_id = ?`, userId);
}

export function listProfiles(where = "1=1", ...params: (string | number)[]) {
  return all<Profile>(`${PROFILE_SELECT} WHERE u.role = 'user' AND u.status = 'active' AND ${where}`, ...params);
}

export const csv = (s: string | null | undefined) => (s ? s.split(",").map((x) => x.trim()).filter(Boolean) : []);

export function age(p: Pick<Profile, "birth_year">) {
  return p.birth_year ? new Date().getFullYear() - p.birth_year : null;
}

export type VerificationRow = { id: number; type: VerificationType; status: string; created_at: string; reviewed_at: string | null; notes: string | null };

/** Último estado de cada tipo de verificación del usuario. */
export function verificationStatus(userId: number) {
  const rows = all<VerificationRow>(
    `SELECT v.id, v.type, v.status, v.created_at, v.reviewed_at, v.notes FROM verifications v
     WHERE v.user_id = ? AND v.id = (SELECT MAX(id) FROM verifications WHERE user_id = v.user_id AND type = v.type)`,
    userId,
  );
  const map = Object.fromEntries(VERIFICATION_TYPES.map((t) => [t.id, null])) as Record<VerificationType, VerificationRow | null>;
  for (const r of rows) map[r.type] = r;
  const approved = VERIFICATION_TYPES.filter((t) => map[t.id]?.status === "approved").length;
  return { map, approved, total: VERIFICATION_TYPES.length, complete: approved === VERIFICATION_TYPES.length };
}

export function isFullyVerified(userId: number) {
  const r = one<{ n: number }>(
    `SELECT COUNT(DISTINCT type) AS n FROM verifications v
     WHERE user_id = ? AND status = 'approved' AND id = (SELECT MAX(id) FROM verifications WHERE user_id = v.user_id AND type = v.type)`,
    userId,
  );
  return (r?.n ?? 0) === VERIFICATION_TYPES.length;
}

export function ratingSummary(userId: number) {
  return one<{ avg: number | null; n: number }>("SELECT AVG(stars) AS avg, COUNT(*) AS n FROM ratings WHERE ratee_id = ?", userId) ?? { avg: null, n: 0 };
}

export function isBlockedBetween(a: number, b: number) {
  return !!one("SELECT 1 FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)", a, b, b, a);
}

export function isMatch(a: number, b: number) {
  const n = one<{ n: number }>(
    "SELECT COUNT(*) AS n FROM likes WHERE ((from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)) AND kind != 'pass'",
    a, b, b, a,
  );
  return (n?.n ?? 0) === 2;
}

export function walletBalance(userId: number) {
  return one<{ balance: number; held: number }>("SELECT balance, held FROM wallets WHERE user_id = ?", userId) ?? { balance: 0, held: 0 };
}
