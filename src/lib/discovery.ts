import "server-only";
import { all } from "./db";
import { VERIFICATION_TYPES, tierById } from "./catalog";
import { age, csv, listProfiles, type Profile } from "./users";
import { compatibility } from "./matching";

export function fullyVerifiedIds(): Set<number> {
  const rows = all<{ user_id: number }>(
    `SELECT user_id FROM verifications v
     WHERE status = 'approved' AND id = (SELECT MAX(id) FROM verifications WHERE user_id = v.user_id AND type = v.type)
     GROUP BY user_id HAVING COUNT(DISTINCT type) = ?`,
    VERIFICATION_TYPES.length,
  );
  return new Set(rows.map((r) => r.user_id));
}

export function hiddenFor(userId: number) {
  const blocked = all<{ id: number }>("SELECT blocked_id AS id FROM blocks WHERE blocker_id = ? UNION SELECT blocker_id FROM blocks WHERE blocked_id = ?", userId, userId);
  return new Set(blocked.map((b) => b.id));
}

export type Candidate = Profile & { score: number; breakdown: ReturnType<typeof compatibility>["breakdown"] };

/** Candidatos compatibles para citas reales, con filtros y orden por compatibilidad. */
export function discover(me: Profile, filters: { archetype?: string; city?: string; intent?: string; netWorth?: string; minScore?: number; includeSeen?: boolean }) {
  const verified = fullyVerifiedIds();
  const hidden = hiddenFor(me.user_id);
  const reacted = new Set(all<{ to_id: number }>("SELECT to_id FROM likes WHERE from_id = ?", me.user_id).map((r) => r.to_id));
  const likedMe = new Set(all<{ from_id: number }>("SELECT from_id FROM likes WHERE to_id = ? AND kind != 'pass'", me.user_id).map((r) => r.from_id));
  const mySeeking = csv(me.seeking);

  return listProfiles("p.user_id != ? AND p.real_dating = 1", me.user_id)
    .filter((p) => verified.has(p.user_id) && !hidden.has(p.user_id))
    .filter((p) => filters.includeSeen || !reacted.has(p.user_id))
    .filter((p) => !p.incognito || likedMe.has(p.user_id))
    .filter((p) => mySeeking.includes(p.gender) && csv(p.seeking).includes(me.gender))
    .filter((p) => {
      const a = age(p);
      return a == null || (a >= me.age_min && a <= me.age_max);
    })
    .filter((p) => !filters.archetype || p.archetype === filters.archetype)
    .filter((p) => !filters.city || p.city === filters.city)
    .filter((p) => !filters.intent || p.intent === filters.intent)
    .filter((p) => !filters.netWorth || p.net_worth === filters.netWorth)
    .map((p) => ({ ...p, ...compatibility(me, p) }))
    .filter((p) => p.score >= (filters.minScore ?? 0))
    // Prioridad de visibilidad: los niveles superiores reciben un pequeño impulso en el orden
    .sort((a, b) => b.score + tierById(b.tier).rank * 2 - (a.score + tierById(a.tier).rank * 2));
}
