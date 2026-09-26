"use server";

import { revalidatePath } from "next/cache";
import crypto from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { requireAdmin, requireUser } from "@/lib/auth";
import { one, transaction } from "@/lib/db";
import { flash, int, str } from "@/lib/flash";
import { LedgerError, post, recordRevenue } from "@/lib/ledger";
import { notify } from "@/lib/notify";
import { isBlockedBetween, isMatch } from "@/lib/users";
import { clp } from "@/lib/money";
import { saveUpload, UploadError } from "@/lib/uploads";
import {
  CANCEL_FREE_HOURS, CLUB, DEPOSIT_RATE, DESTINATIONS, PARK_STREAMS, PASSPORT_REWARD_CLP, STAMPS, clpToFils, productById, splitVat,
} from "@/lib/park-catalog";
import { clubStatus, coupleOf, parkDiscount, partnerOf, pilotVenue, slotsFor, type ParkBooking } from "@/lib/park";

class BusinessError extends Error {}

function attempt(fn: (conn: DatabaseSync) => void): string | null {
  try {
    transaction(fn);
    return null;
  } catch (e) {
    if (e instanceof LedgerError || e instanceof BusinessError || e instanceof UploadError) return e.message;
    console.error(e);
    return "No se pudo completar la operación.";
  }
}

/** Registra un ingreso del Park (importe CLP con IVA; negativo para devoluciones). */
function parkRevenue(conn: DatabaseSync, stream: string, gross: number, userId: number | null, ref: string) {
  const { net, vat } = splitVat(Math.abs(gross));
  const sign = gross < 0 ? -1 : 1;
  recordRevenue(conn, stream, sign * clpToFils(net), sign * clpToFils(vat), userId, ref);
}

const token = (n = 12) => crypto.randomBytes(n).toString("base64url");
const isIdentityVerified = (userId: number) => !!one("SELECT 1 FROM verifications WHERE user_id = ? AND type = 'identity' AND status = 'approved'", userId);

// ── Reservas ─────────────────────────────────────────────────────────────────

export async function bookPark(fd: FormData) {
  const user = await requireUser();
  const product = productById(str(fd, "product", 20));
  const back = `/park/reservar${product ? `?p=${product.id}` : ""}`;
  if (!product) flash("/park/reservar", "Elige una experiencia.", "error");
  if (user.role === "admin") flash(back, "Las cuentas de administración no hacen reservas.", "error");
  const venue = pilotVenue();
  if (!venue) flash("/park", "No hay locales abiertos.", "error");

  const date = str(fd, "date", 10);
  const hour = int(fd, "hour");
  const minor = fd.get("minor") === "on";
  const minorNames = str(fd, "minor_names", 120);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) flash(back, "Elige una fecha.", "error");
  const slotAt = `${date} ${String(hour).padStart(2, "0")}:00:00`;
  const when = new Date(`${date}T${String(hour).padStart(2, "0")}:00:00`).getTime();
  if (!(when > Date.now() + 3_600_000)) flash(back, "Elige una fecha y hora futuras.", "error");
  if (when > Date.now() + 90 * 86_400_000) flash(back, "Se puede reservar con hasta 90 días de antelación.", "error");

  // Pareja de 14 a 17 años: reserva a cargo del tutor, de día, sin alcohol y con identidad verificada
  if (minor) {
    if (!product.minors) flash(back, "Esta experiencia no está disponible para menores de edad.", "error");
    if (!isIdentityVerified(user.id)) flash("/verificacion", "Para reservar como tutor necesitas tu verificación de identidad aprobada.", "error");
    if (minorNames.length < 3) flash(back, "Indica los nombres y edades de la pareja menor de edad.", "error");
    if (fd.get("guardian") !== "on") flash(back, "Debes aceptar la responsabilidad como tutor.", "error");
  }
  const slot = slotsFor(venue.id, product, date, minor).find((s) => s.hour === hour);
  if (!slot) flash(back, minor ? "Las reservas con menores de edad son solo de día." : "Horario fuera de la apertura del local.", "error");
  if (slot.left <= 0) flash(back, "Ese horario ya está completo. Elige otro.", "error");

  // Con quién: la pareja vinculada, un match de TWO LOVE o un nombre
  const couple = coupleOf(user.id);
  let partnerId = int(fd, "partner") || null;
  if (partnerId && partnerId !== partnerOf(couple, user.id) && (!isMatch(user.id, partnerId) || isBlockedBetween(user.id, partnerId))) partnerId = null;
  const partnerName = minor ? "" : str(fd, "partner_name", 60);
  const destination = product.id === "viaje" ? (DESTINATIONS.includes(str(fd, "destination", 20)) ? str(fd, "destination", 20) : DESTINATIONS[0]) : null;

  const { rate } = parkDiscount(user.id, user.tier);
  const discount = Math.round(product.price * rate);
  const total = product.price - discount;
  const deposit = Math.round(total * DEPOSIT_RATE);
  let id = 0;
  const err = attempt((conn) => {
    // Cupo verificado de nuevo dentro de la transacción (dos reservas simultáneas no exceden la capacidad)
    const taken = (conn.prepare("SELECT COUNT(*) AS n FROM park_bookings WHERE venue_id = ? AND product = ? AND slot_at = ? AND status IN ('reservada','en_curso')")
      .get(venue.id, product.id, slotAt) as { n: number }).n;
    if (taken >= product.capacity) throw new BusinessError("Ese horario ya está completo. Elige otro.");
    const r = conn.prepare(`INSERT INTO park_bookings (user_id, venue_id, product, slot_at, partner_id, partner_name, destination, minor, minor_names, photo_consent, price, discount, total, deposit, paid, qr, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(user.id, venue.id, product.id, slotAt, minor ? null : partnerId, partnerName, destination, minor ? 1 : 0, minor ? minorNames : "",
        fd.get("photos") === "on" && !minor ? 1 : 0, product.price, discount, total, deposit, deposit, "TLP-" + token(9), str(fd, "notes", 400));
    id = Number(r.lastInsertRowid);
    post(conn, user.id, "park", -clpToFils(deposit), `TWO LOVE Park · ${product.name} · anticipo 30 %`, `park:${id}`);
    parkRevenue(conn, product.stream, deposit, user.id, `park:${id}`);
    if (!minor) notify(conn, partnerId, "reserva", `${user.name.split(" ")[0]} te invita a TWO LOVE Park`, `Cita para el ${slotAt.slice(0, 16)}: ${product.name}`, "/park/mis-citas");
  });
  if (err) flash(back, err, "error");
  revalidatePath("/park/mis-citas");
  flash(`/park/mis-citas#b${id}`, `¡Reserva confirmada! Anticipo de ${clp(deposit)} cobrado. Muestra tu código QR al llegar.`);
}

function loadBooking(id: number) {
  return one<ParkBooking>("SELECT * FROM park_bookings WHERE id = ?", id);
}

export async function cancelPark(fd: FormData) {
  const user = await requireUser();
  const b = loadBooking(int(fd, "booking"));
  if (!b || (b.user_id !== user.id) || b.status !== "reservada") flash("/park/mis-citas", "No se puede cancelar.", "error");
  const refundable = new Date(b.slot_at.replace(" ", "T")).getTime() - Date.now() > CANCEL_FREE_HOURS * 3_600_000;
  const p = productById(b.product);
  const err = attempt((conn) => {
    conn.prepare("UPDATE park_bookings SET status = 'cancelada' WHERE id = ?").run(b.id);
    if (refundable && b.paid) {
      post(conn, user.id, "reembolso", clpToFils(b.paid), `TWO LOVE Park · devolución del anticipo`, `park:${b.id}`);
      parkRevenue(conn, p?.stream ?? "park_pase", -b.paid, user.id, `park:${b.id}`);
    }
    notify(conn, b.partner_id, "reserva", "Cita en TWO LOVE Park cancelada", `Reserva del ${b.slot_at.slice(0, 16)}`, "/park/mis-citas");
  });
  if (err) flash("/park/mis-citas", err, "error");
  revalidatePath("/park/mis-citas");
  flash("/park/mis-citas", refundable ? "Reserva cancelada. Anticipo devuelto a tu billetera." : "Reserva cancelada. Con menos de 48 h el anticipo no se devuelve.");
}

// ── Pareja y contador de días ────────────────────────────────────────────────

export async function createCouple(fd: FormData) {
  const user = await requireUser();
  const since = str(fd, "since", 10);
  if (coupleOf(user.id)) flash("/park/pasaporte", "Ya tienes una pareja vinculada.", "error");
  const d = new Date(`${since}T00:00:00Z`).getTime();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since) || !(d <= Date.now()) || d < Date.now() - 70 * 365 * 86_400_000) flash("/park/pasaporte", "Indica la fecha en que empezasteis.", "error");
  const code = "TLP-" + crypto.randomBytes(4).toString("hex").toUpperCase();
  transaction((conn) => {
    conn.prepare("INSERT INTO park_couples (user_a, partner_name, since, code) VALUES (?, ?, ?, ?)").run(user.id, str(fd, "partner_name", 60), since, code);
  });
  revalidatePath("/park/pasaporte");
  flash("/park/pasaporte", `Contador creado. Comparte el código ${code} con tu pareja para unirla.`);
}

export async function joinCouple(fd: FormData) {
  const user = await requireUser();
  const code = str(fd, "code", 20).toUpperCase();
  if (coupleOf(user.id)) flash("/park/pasaporte", "Ya tienes una pareja vinculada.", "error");
  const c = one<{ id: number; user_a: number; user_b: number | null }>("SELECT id, user_a, user_b FROM park_couples WHERE code = ? AND status = 'activa'", code);
  if (!c || c.user_b || c.user_a === user.id || isBlockedBetween(user.id, c.user_a)) flash("/park/pasaporte", "Código no válido.", "error");
  transaction((conn) => {
    conn.prepare("UPDATE park_couples SET user_b = ? WHERE id = ?").run(user.id, c.id);
    notify(conn, c.user_a, "match", `${user.name.split(" ")[0]} se ha unido a vuestro contador de pareja 💞`, "Ahora compartís pasaporte, Club y recordatorios.", "/park/pasaporte");
  });
  revalidatePath("/park/pasaporte");
  flash("/park/pasaporte", "¡Pareja vinculada! Ya compartís contador y recordatorios.");
}

export async function endCouple() {
  const user = await requireUser();
  const c = coupleOf(user.id);
  if (!c) flash("/park/pasaporte", "No hay pareja vinculada.", "error");
  transaction((conn) => {
    conn.prepare("UPDATE park_couples SET status = 'finalizada' WHERE id = ?").run(c.id);
  });
  revalidatePath("/park/pasaporte");
  flash("/park/pasaporte", "Contador de pareja cerrado.");
}

// ── Two Love Club ────────────────────────────────────────────────────────────

export async function joinClub() {
  const user = await requireUser();
  const status = clubStatus(user.id, user.tier);
  if (status.included) flash("/park/pasaporte", "Tu membresía TWO LOVE ya incluye el Club.", "error");
  if (status.active && !status.own) flash("/park/pasaporte", "Tu pareja ya tiene el Club activo: lo compartís.", "error");
  const err = attempt((conn) => {
    // Renovar suma 30 días al periodo vigente (o desde hoy si ya venció)
    const cur = conn.prepare("SELECT expires_at FROM park_club WHERE user_id = ?").get(user.id) as { expires_at: string } | undefined;
    const from = Math.max(Date.now(), cur ? new Date(cur.expires_at.replace(" ", "T") + "Z").getTime() : 0);
    const expires = new Date(from + 30 * 86_400_000).toISOString().replace("T", " ").slice(0, 19);
    conn.prepare(`INSERT INTO park_club (user_id, expires_at) VALUES (?, ?)
      ON CONFLICT(user_id) DO UPDATE SET expires_at = excluded.expires_at, status = 'activa'`).run(user.id, expires);
    post(conn, user.id, "park_club", -clpToFils(CLUB.price), "Two Love Club · 1 mes", `park_club:${user.id}`);
    parkRevenue(conn, "park_club", CLUB.price, user.id, `park_club:${user.id}`);
  });
  if (err) flash("/park/pasaporte", err, "error");
  revalidatePath("/park/pasaporte");
  flash("/park/pasaporte", "¡Bienvenidos al Two Love Club! 10 % de descuento y beneficios mensuales activados.");
}

export async function cancelClub() {
  const user = await requireUser();
  transaction((conn) => {
    conn.prepare("UPDATE park_club SET status = 'cancelada' WHERE user_id = ?").run(user.id);
  });
  revalidatePath("/park/pasaporte");
  flash("/park/pasaporte", "No se renovará el Club. Mantienes los beneficios hasta el fin del periodo pagado.");
}

// ── Operación del local (administración) ─────────────────────────────────────

const ADMIN_BACK = "/admin/park";

export async function parkCheckIn(fd: FormData) {
  await requireAdmin();
  const b = loadBooking(int(fd, "booking"));
  if (!b || b.status !== "reservada") flash(ADMIN_BACK, "Reserva no válida.", "error");
  const method = str(fd, "method", 10) === "local" ? "local" : "wallet";
  const rest = b.total - b.paid;
  const p = productById(b.product);
  const err = attempt((conn) => {
    if (rest > 0) {
      if (method === "wallet") post(conn, b.user_id, "park", -clpToFils(rest), `TWO LOVE Park · ${p?.name ?? ""} · saldo`, `park:${b.id}`);
      parkRevenue(conn, p?.stream ?? "park_pase", rest, b.user_id, `park:${b.id}`);
    }
    conn.prepare("UPDATE park_bookings SET status = 'en_curso', paid = total, checked_in_at = datetime('now') WHERE id = ?").run(b.id);
  });
  if (err) flash(ADMIN_BACK, `${err} Cobra el saldo en el local.`, "error");
  revalidatePath(ADMIN_BACK);
  flash(ADMIN_BACK, `Check-in de ${b.qr} registrado.`);
}

export async function parkComplete(fd: FormData) {
  await requireAdmin();
  const b = loadBooking(int(fd, "booking"));
  if (!b || b.status !== "en_curso") flash(ADMIN_BACK, "Reserva no válida.", "error");
  const p = productById(b.product);
  transaction((conn) => {
    const album = b.photo_consent ? token(18) : null;
    conn.prepare("UPDATE park_bookings SET status = 'completada', completed_at = datetime('now'), album = COALESCE(album, ?) WHERE id = ?").run(album, b.id);
    for (const uid of [b.user_id, b.partner_id]) {
      if (!uid) continue;
      for (const s of p?.stamps ?? []) conn.prepare("INSERT OR IGNORE INTO park_stamps (user_id, stamp, booking_id) VALUES (?, ?, ?)").run(uid, s, b.id);
      // Pasaporte completo: una Cita Clásica de regalo (una sola vez)
      const n = (conn.prepare("SELECT COUNT(*) AS n FROM park_stamps WHERE user_id = ?").get(uid) as { n: number }).n;
      const ref = `park_passport:${uid}`;
      if (n >= STAMPS.length && !conn.prepare("SELECT 1 FROM wallet_tx WHERE ref = ?").get(ref)) {
        post(conn, uid, "bono", clpToFils(PASSPORT_REWARD_CLP), "Pasaporte del amor completo: Cita Clásica de regalo", ref);
        notify(conn, uid, "sistema", "¡Pasaporte del amor completo! 🎉", "Tienes una Cita Clásica de regalo en tu billetera.", "/park/pasaporte");
      }
    }
    notify(conn, b.user_id, "reserva", "Gracias por vuestra cita en TWO LOVE Park 💞", p?.stamps.length ? "Nuevos sellos en vuestro pasaporte." : "", b.photo_consent ? "/park/mis-citas" : "/park/pasaporte");
  });
  revalidatePath(ADMIN_BACK);
  flash(ADMIN_BACK, "Cita completada: sellos entregados.");
}

export async function parkNoShow(fd: FormData) {
  await requireAdmin();
  const b = loadBooking(int(fd, "booking"));
  if (!b || b.status !== "reservada") flash(ADMIN_BACK, "Reserva no válida.", "error");
  transaction((conn) => {
    conn.prepare("UPDATE park_bookings SET status = 'no_show' WHERE id = ?").run(b.id);
    notify(conn, b.user_id, "reserva", "No pudimos recibiros en TWO LOVE Park", "El anticipo queda retenido según las condiciones de reserva.", "/park/mis-citas");
  });
  revalidatePath(ADMIN_BACK);
  flash(ADMIN_BACK, "Marcada como no presentada.");
}

export async function parkCancelAdmin(fd: FormData) {
  await requireAdmin();
  const b = loadBooking(int(fd, "booking"));
  if (!b || b.status !== "reservada") flash(ADMIN_BACK, "Reserva no válida.", "error");
  const p = productById(b.product);
  const err = attempt((conn) => {
    conn.prepare("UPDATE park_bookings SET status = 'cancelada' WHERE id = ?").run(b.id);
    if (b.paid) {
      post(conn, b.user_id, "reembolso", clpToFils(b.paid), "TWO LOVE Park · devolución del anticipo", `park:${b.id}`);
      parkRevenue(conn, p?.stream ?? "park_pase", -b.paid, b.user_id, `park:${b.id}`);
    }
    notify(conn, b.user_id, "reserva", "El local ha cancelado tu cita en TWO LOVE Park", "Te hemos devuelto el anticipo íntegro.", "/park/mis-citas");
  });
  if (err) flash(ADMIN_BACK, err, "error");
  revalidatePath(ADMIN_BACK);
  flash(ADMIN_BACK, "Reserva cancelada y anticipo devuelto.");
}

export async function parkSale(fd: FormData) {
  await requireAdmin();
  const venue = pilotVenue();
  const stream = str(fd, "stream", 30);
  const amount = int(fd, "amount");
  const couples = Math.max(0, int(fd, "couples"));
  const machine = int(fd, "machine") || null;
  if (!venue || !PARK_STREAMS.includes(stream)) flash(ADMIN_BACK, "Línea de ingreso no válida.", "error");
  if (amount <= 0 || amount > 100_000_000) flash(ADMIN_BACK, "Importe no válido.", "error");
  if (machine && !one("SELECT 1 FROM park_machines WHERE id = ?", machine)) flash(ADMIN_BACK, "Máquina no válida.", "error");
  transaction((conn) => {
    const id = Number(conn.prepare("INSERT INTO park_sales (venue_id, stream, machine_id, amount, couples, note) VALUES (?, ?, ?, ?, ?, ?)")
      .run(venue.id, stream, machine, amount, couples, str(fd, "note", 200)).lastInsertRowid);
    parkRevenue(conn, stream, amount, null, `park_sale:${id}`);
  });
  revalidatePath(ADMIN_BACK);
  flash(`${ADMIN_BACK}#caja`, "Venta registrada en caja.");
}

export async function parkPhotos(fd: FormData) {
  await requireAdmin();
  const b = loadBooking(int(fd, "booking"));
  if (!b || !b.photo_consent || !["en_curso", "completada"].includes(b.status)) flash(ADMIN_BACK, "Sin consentimiento de fotos para esta reserva.", "error");
  const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 8);
  if (!files.length) flash(ADMIN_BACK, "Selecciona las fotos.", "error");
  let paths: string[] = [];
  try {
    paths = (await Promise.all(files.map((f) => saveUpload(f, "private")))).filter((x): x is string => !!x);
  } catch (e) {
    flash(ADMIN_BACK, e instanceof UploadError ? e.message : "No se pudieron guardar las fotos.", "error");
  }
  transaction((conn) => {
    conn.prepare("UPDATE park_bookings SET album = COALESCE(album, ?) WHERE id = ?").run(token(18), b.id);
    for (const p of paths) conn.prepare("INSERT INTO park_photos (booking_id, file_path) VALUES (?, ?)").run(b.id, p);
    notify(conn, b.user_id, "reserva", "Vuestras fotos de TWO LOVE Park ya están listas 📸", "Descárgalas desde el álbum (QR) durante 30 días.", "/park/mis-citas");
  });
  revalidatePath(ADMIN_BACK);
  flash(ADMIN_BACK, `${paths.length} fotos añadidas al álbum.`);
}
