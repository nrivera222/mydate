import "server-only";
import type { DatabaseSync } from "node:sqlite";
import { all, one } from "./db";
import { tierById } from "./catalog";
import { notify } from "./notify";
import {
  ALBUM_DAYS, CLOSE_HOUR, CLUB, MINORS_UNTIL_HOUR, OPEN_HOUR, milestones, productById, type ParkProduct, type StampId,
} from "./park-catalog";

export type ParkBooking = {
  id: number; user_id: number; venue_id: number; product: string; slot_at: string; partner_id: number | null; partner_name: string;
  destination: string | null; minor: number; minor_names: string; photo_consent: number; price: number; discount: number; total: number;
  deposit: number; paid: number; status: string; qr: string; album: string | null; notes: string; created_at: string;
  checked_in_at: string | null; completed_at: string | null;
};

export type Couple = { id: number; user_a: number; user_b: number | null; partner_name: string; since: string; code: string; partner: string | null };

export const pilotVenue = () => one<{ id: number; name: string; city: string; opens_on: string }>("SELECT id, name, city, opens_on FROM park_venues WHERE status = 'abierto' ORDER BY id LIMIT 1");

/** Club activo propio, de la pareja, o incluido por membresía Diamond/Royal Black. */
export function clubStatus(userId: number, tier: string) {
  if (tierById(tier).rank >= CLUB.includedFromTier) return { active: true, included: true, expires: null as string | null, renew: false };
  const partner = coupleOf(userId);
  const ids = [userId, partner?.user_a === userId ? partner.user_b : partner?.user_a].filter((x): x is number => !!x);
  const row = one<{ expires_at: string; status: string; user_id: number }>(
    `SELECT expires_at, status, user_id FROM park_club WHERE user_id IN (${ids.map(() => "?").join(",")}) AND datetime(expires_at) > datetime('now') ORDER BY expires_at DESC LIMIT 1`, ...ids,
  );
  return { active: !!row, included: false, expires: row?.expires_at ?? null, renew: row?.status === "activa", own: row?.user_id === userId };
}

/** Descuento del ecosistema en el Park: el mayor entre el de la membresía TWO LOVE y el del Club. */
export function parkDiscount(userId: number, tier: string) {
  const t = tierById(tier).giftDiscount;
  const c = clubStatus(userId, tier).active ? CLUB.discount : 0;
  return { rate: Math.max(t, c), source: c >= t && c > 0 ? "club" : t > 0 ? "tier" : null };
}

export function coupleOf(userId: number) {
  return one<Couple>(
    `SELECT c.*, CASE WHEN c.user_a = ? THEN ub.name ELSE ua.name END AS partner FROM park_couples c
     JOIN users ua ON ua.id = c.user_a LEFT JOIN users ub ON ub.id = c.user_b
     WHERE c.status = 'activa' AND (c.user_a = ? OR c.user_b = ?) ORDER BY c.id DESC LIMIT 1`, userId, userId, userId,
  );
}
export const partnerOf = (c: Couple | undefined, userId: number) => (c ? (c.user_a === userId ? c.user_b : c.user_a) : null);

export const stampsOf = (userId: number) =>
  all<{ stamp: StampId; created_at: string }>("SELECT stamp, created_at FROM park_stamps WHERE user_id = ?", userId);

/** Franjas horarias del día con cupo para un producto. */
export function slotsFor(venueId: number, product: ParkProduct, date: string, minor = false) {
  const lastStart = (minor ? MINORS_UNTIL_HOUR : CLOSE_HOUR) - Math.ceil(product.minutes / 60);
  const taken = all<{ h: string; n: number }>(
    `SELECT substr(slot_at, 12, 2) AS h, COUNT(*) AS n FROM park_bookings
     WHERE venue_id = ? AND product = ? AND substr(slot_at, 1, 10) = ? AND status IN ('reservada','en_curso') GROUP BY h`, venueId, product.id, date,
  );
  const used = new Map(taken.map((x) => [Number(x.h), x.n]));
  const out: { hour: number; left: number }[] = [];
  for (let h = OPEN_HOUR; h <= lastStart; h++) out.push({ hour: h, left: product.capacity - (used.get(h) ?? 0) });
  return out;
}

/** Avisos de hitos de la pareja (cumplemes, día 100…) en los próximos 7 días; una vez por hito. */
export function remindMilestones(conn: DatabaseSync, userId: number) {
  const c = conn.prepare("SELECT id, user_a, user_b, since FROM park_couples WHERE status = 'activa' AND (user_a = ? OR user_b = ?) LIMIT 1").get(userId, userId) as
    | { id: number; user_a: number; user_b: number | null; since: string } | undefined;
  if (!c) return;
  for (const m of milestones(c.since).filter((x) => x.days <= 7)) {
    const r = conn.prepare("INSERT OR IGNORE INTO park_reminders (couple_id, key) VALUES (?, ?)").run(c.id, `${m.key}:${m.date}`);
    if (!r.changes) continue;
    const p = productById(m.product);
    for (const uid of [c.user_a, c.user_b]) {
      notify(conn, uid, "reserva", m.days === 0 ? "Hoy es vuestro hito en TWO LOVE Park 💞" : "Se acerca un hito de pareja 💞",
        `${m.label.replace("{n}", String(m.n))} · ${m.date}${p ? ` · ${p.name}` : ""}`, `/park/reservar?p=${m.product}`);
    }
  }
}

/** Reserva de un álbum por QR, si sigue vigente (ALBUM_DAYS desde la cita). */
export function albumByToken(tokenValue: string) {
  if (!/^[\w-]{16,40}$/.test(tokenValue)) return undefined;
  return one<ParkBooking & { venue: string }>(
    `SELECT b.*, v.name AS venue FROM park_bookings b JOIN park_venues v ON v.id = b.venue_id
     WHERE b.album = ? AND b.photo_consent = 1 AND datetime(COALESCE(b.completed_at, b.checked_in_at, b.slot_at), '+${ALBUM_DAYS} days') > datetime('now')`, tokenValue,
  );
}
