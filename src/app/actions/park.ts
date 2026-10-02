"use server";

import { revalidatePath } from "next/cache";
import crypto from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { requireAdmin, requireUser } from "@/lib/auth";
import { one, transaction } from "@/lib/db";
import { flash, int, list, str } from "@/lib/flash";
import { LedgerError, post, recordRevenue } from "@/lib/ledger";
import { notify } from "@/lib/notify";
import { isBlockedBetween, isMatch } from "@/lib/users";
import { clp } from "@/lib/money";
import { saveUpload, UploadError } from "@/lib/uploads";
import {
  CANCEL_FREE_HOURS, CLUB, DEPOSIT_RATE, VOUCHER_MONTHS, PARK_PRODUCTS, PARK_ZONES, SURVEY, hoursUntil, DESTINATIONS, PARK_STREAMS, PASSPORT_REWARD_CLP, STAMPS, clpToFils, productById, splitVat,
} from "@/lib/park-catalog";
import { clpPerAed } from "@/lib/settings";
import { flushOutbox, queueEmail } from "@/lib/email";
import { activeVoucher, checkCampaign, clubStatus, coupleOf, parkDiscount, partnerOf, pilotVenue, slotsFor, type ParkBooking } from "@/lib/park";

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
function parkRevenue(conn: DatabaseSync, stream: string, gross: number, userId: number | null, ref: string, rate = clpPerAed()) {
  const { net, vat } = splitVat(Math.abs(gross));
  const sign = gross < 0 ? -1 : 1;
  recordRevenue(conn, stream, sign * clpToFils(net, rate), sign * clpToFils(vat, rate), userId, ref);
}
/** Tipo de cambio de una reserva: el aplicado al crearla (cobros y devoluciones coherentes). */
const rateOf = (b: ParkBooking) => b.fx_rate ?? clpPerAed();

const token = (n = 12) => crypto.randomBytes(n).toString("base64url");
const isIdentityVerified = (userId: number) => !!one("SELECT 1 FROM verifications WHERE user_id = ? AND type = 'identity' AND status = 'approved'", userId);

// ── Reservas ─────────────────────────────────────────────────────────────────

export async function bookPark(fd: FormData) {
  const user = await requireUser({ park: true });
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
  // Hora local del local (Santiago), independiente de la zona horaria del servidor
  const ahead = hoursUntil(slotAt);
  if (!(ahead > 1)) flash(back, "Elige una fecha y hora futuras.", "error");
  if (ahead > 90 * 24) flash(back, "Se puede reservar con hasta 90 días de antelación.", "error");

  // Pareja de 14 a 17 años: reserva a cargo del tutor, de día, sin alcohol y con identidad verificada
  if (minor) {
    if (!product.minors) flash(back, "Esta experiencia no está disponible para menores de edad.", "error");
    if (!isIdentityVerified(user.id)) flash(user.scope === "park" ? "/park/pasaporte#identidad" : "/verificacion", "Para reservar como tutor necesitas tu verificación de identidad aprobada.", "error");
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

  // Tarjeta regalo: cubre la experiencia completa (sin anticipo ni descuento)
  const voucherCode = str(fd, "voucher", 20).toUpperCase();
  const voucher = voucherCode ? activeVoucher(voucherCode) : undefined;
  if (voucherCode && !voucher) flash(back, "Código de regalo no válido o caducado.", "error");
  if (voucher && voucher.product !== product.id) flash(back, `Este regalo es para «${productById(voucher.product)?.name ?? voucher.product}».`, "error");
  // Código de campaña: se aplica el mayor entre el descuento de la campaña y el de la membresía/Club (no se suman)
  const promoCode = str(fd, "promo", 20).toUpperCase();
  if (promoCode && voucher) flash(back, "Los códigos promocionales no se combinan con tarjetas regalo.", "error");
  const promo = promoCode ? checkCampaign(promoCode, product.id) : {};
  if (promo.error) flash(back, promo.error, "error");
  const { rate: memberRate } = parkDiscount(user.id, user.tier);
  const campaign = promo.campaign && promo.campaign.discount >= memberRate ? promo.campaign : undefined;
  const discountRate = campaign ? campaign.discount : memberRate;
  const discount = voucher ? 0 : Math.round(product.price * discountRate);
  const total = product.price - discount;
  const deposit = voucher ? 0 : Math.round(total * DEPOSIT_RATE);
  const rate = clpPerAed();
  let id = 0;
  const err = attempt((conn) => {
    // Cupo verificado de nuevo dentro de la transacción (dos reservas simultáneas no exceden la capacidad)
    const taken = (conn.prepare("SELECT COUNT(*) AS n FROM park_bookings WHERE venue_id = ? AND product = ? AND slot_at = ? AND status IN ('reservada','en_curso')")
      .get(venue.id, product.id, slotAt) as { n: number }).n;
    if (taken >= product.capacity) throw new BusinessError("Ese horario ya está completo. Elige otro.");
    if (campaign?.max_uses != null) {
      const used = (conn.prepare("SELECT COUNT(*) AS n FROM park_bookings WHERE campaign_id = ? AND status != 'cancelada'").get(campaign.id) as { n: number }).n;
      if (used >= campaign.max_uses) throw new BusinessError("Este código promocional ya se agotó.");
    }
    const r = conn.prepare(`INSERT INTO park_bookings (user_id, venue_id, product, slot_at, partner_id, partner_name, destination, minor, minor_names, photo_consent, price, discount, total, deposit, paid, qr, notes, fx_rate, voucher_id, campaign_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(user.id, venue.id, product.id, slotAt, minor ? null : partnerId, partnerName, destination, minor ? 1 : 0, minor ? minorNames : "",
        fd.get("photos") === "on" && !minor ? 1 : 0, product.price, discount, total, deposit, voucher ? total : deposit, "TLP-" + token(9), str(fd, "notes", 400), voucher ? voucher.fx_rate : rate, voucher?.id ?? null, campaign?.id ?? null);
    id = Number(r.lastInsertRowid);
    if (voucher) {
      // El pasivo de la tarjeta se reconoce como ingreso al canjearla
      const upd = conn.prepare("UPDATE park_vouchers SET status = 'canjeado', redeemed_by = ? WHERE id = ? AND status = 'activo'").run(user.id, voucher.id);
      if (!upd.changes) throw new BusinessError("Código de regalo no válido o caducado.");
      parkRevenue(conn, product.stream, voucher.amount, user.id, `park:${id}`, voucher.fx_rate);
      notify(conn, voucher.buyer_id, "regalo", `${user.name.split(" ")[0]} ha canjeado tu regalo de TWO LOVE Park 🎁`, `Cita para el ${slotAt.slice(0, 16)}: ${product.name}`, "/park/regalar");
    } else {
      post(conn, user.id, "park", -clpToFils(deposit, rate), `TWO LOVE Park · ${product.name} · anticipo 30 %`, `park:${id}`);
      parkRevenue(conn, product.stream, deposit, user.id, `park:${id}`, rate);
    }
    if (!minor) notify(conn, partnerId, "reserva", `${user.name.split(" ")[0]} te invita a TWO LOVE Park`, `Cita para el ${slotAt.slice(0, 16)}: ${product.name}`, "/park/mis-citas");
    const qr = (conn.prepare("SELECT qr FROM park_bookings WHERE id = ?").get(id) as { qr: string }).qr;
    queueEmail(conn, {
      to: user.email, subject: `Reserva confirmada · ${product.name} · ${slotAt.slice(0, 16)}`, ref: `park:${id}`,
      title: "¡Vuestra cita en TWO LOVE Park está reservada!",
      lines: [
        `${product.name}${destination ? ` · ${destination}` : ""} · ${slotAt.slice(0, 16)} (hora de Santiago) · ${venue.name}.`,
        voucher ? "Pagada con tarjeta regalo." : `Anticipo pagado: ${clp(deposit)} de ${clp(total)}. El resto se paga al llegar.`,
        `Cancelación gratuita hasta ${CANCEL_FREE_HOURS} h antes. Muestra este código en la entrada:`,
      ],
      highlight: qr, cta: { label: "Ver mis citas", href: `/park/mis-citas#b${id}` },
    });
  });
  if (err) flash(back, err, "error");
  await flushOutbox();
  revalidatePath("/park/mis-citas");
  if (voucher) flash(`/park/mis-citas#b${id}`, "¡Reserva confirmada con tu regalo! Muestra tu código QR al llegar.");
  flash(`/park/mis-citas#b${id}`, `¡Reserva confirmada! Anticipo de ${clp(deposit)} cobrado. Muestra tu código QR al llegar.`);
}

/** Devuelve lo pagado: a la billetera, o reactiva la tarjeta regalo con la que se pagó. */
function refundBooking(conn: DatabaseSync, b: ParkBooking, stream: string) {
  if (b.voucher_id) {
    const v = conn.prepare("SELECT amount, fx_rate FROM park_vouchers WHERE id = ?").get(b.voucher_id) as { amount: number; fx_rate: number };
    conn.prepare("UPDATE park_vouchers SET status = 'activo', redeemed_by = NULL WHERE id = ?").run(b.voucher_id);
    parkRevenue(conn, stream, -v.amount, b.user_id, `park:${b.id}`, v.fx_rate);
  } else if (b.paid) {
    post(conn, b.user_id, "reembolso", clpToFils(b.paid, rateOf(b)), "TWO LOVE Park · devolución del anticipo", `park:${b.id}`);
    parkRevenue(conn, stream, -b.paid, b.user_id, `park:${b.id}`, rateOf(b));
  }
}

function loadBooking(id: number) {
  return one<ParkBooking>("SELECT * FROM park_bookings WHERE id = ?", id);
}

export async function cancelPark(fd: FormData) {
  const user = await requireUser({ park: true });
  const b = loadBooking(int(fd, "booking"));
  if (!b || (b.user_id !== user.id) || b.status !== "reservada") flash("/park/mis-citas", "No se puede cancelar.", "error");
  const refundable = hoursUntil(b.slot_at) > CANCEL_FREE_HOURS;
  const p = productById(b.product);
  const err = attempt((conn) => {
    conn.prepare("UPDATE park_bookings SET status = 'cancelada' WHERE id = ?").run(b.id);
    if (refundable) refundBooking(conn, b, p?.stream ?? "park_pase");
    notify(conn, b.partner_id, "reserva", "Cita en TWO LOVE Park cancelada", `Reserva del ${b.slot_at.slice(0, 16)}`, "/park/mis-citas");
  });
  if (err) flash("/park/mis-citas", err, "error");
  revalidatePath("/park/mis-citas");
  if (refundable && b.voucher_id) flash("/park/mis-citas", "Reserva cancelada. Tu regalo vuelve a estar disponible.");
  flash("/park/mis-citas", refundable ? "Reserva cancelada. Anticipo devuelto a tu billetera." : "Reserva cancelada. Con menos de 48 h el anticipo no se devuelve.");
}

// ── Pareja y contador de días ────────────────────────────────────────────────

export async function createCouple(fd: FormData) {
  const user = await requireUser({ park: true });
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
  const user = await requireUser({ park: true });
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
  const user = await requireUser({ park: true });
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
  const user = await requireUser({ park: true });
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
    post(conn, user.id, "park_club", -clpToFils(CLUB.price, clpPerAed()), "Two Love Club · 1 mes", `park_club:${user.id}`);
    parkRevenue(conn, "park_club", CLUB.price, user.id, `park_club:${user.id}`);
  });
  if (err) flash("/park/pasaporte", err, "error");
  revalidatePath("/park/pasaporte");
  flash("/park/pasaporte", "¡Bienvenidos al Two Love Club! 10 % de descuento y beneficios mensuales activados.");
}

export async function cancelClub() {
  const user = await requireUser({ park: true });
  transaction((conn) => {
    conn.prepare("UPDATE park_club SET status = 'cancelada' WHERE user_id = ?").run(user.id);
  });
  revalidatePath("/park/pasaporte");
  flash("/park/pasaporte", "No se renovará el Club. Mantienes los beneficios hasta el fin del periodo pagado.");
}

// ── Operación del local (administración) ─────────────────────────────────────

const ADMIN_BACK = "/admin/park";
/** Vuelve al escáner de la puerta (con la reserva cargada) o a la agenda, según desde dónde se actuó. */
const backFor = (fd: FormData, qr?: string) =>
  str(fd, "back", 40) === "/admin/park/escaner" ? `/admin/park/escaner${qr ? `?qr=${encodeURIComponent(qr)}` : ""}` : ADMIN_BACK;

export async function parkCheckIn(fd: FormData) {
  await requireAdmin();
  const b = loadBooking(int(fd, "booking"));
  if (!b || b.status !== "reservada") flash(backFor(fd), "Reserva no válida.", "error");
  const method = str(fd, "method", 10) === "local" ? "local" : "wallet";
  const rest = b.total - b.paid;
  const p = productById(b.product);
  const err = attempt((conn) => {
    if (rest > 0) {
      if (method === "wallet") post(conn, b.user_id, "park", -clpToFils(rest, rateOf(b)), `TWO LOVE Park · ${p?.name ?? ""} · saldo`, `park:${b.id}`);
      parkRevenue(conn, p?.stream ?? "park_pase", rest, b.user_id, `park:${b.id}`, rateOf(b));
    }
    conn.prepare("UPDATE park_bookings SET status = 'en_curso', paid = total, checked_in_at = datetime('now') WHERE id = ?").run(b.id);
  });
  if (err) flash(backFor(fd, b.qr), `${err} Cobra el saldo en el local.`, "error");
  revalidatePath(ADMIN_BACK);
  flash(backFor(fd, b.qr), `Check-in de ${b.qr} registrado.`);
}

export async function parkComplete(fd: FormData) {
  await requireAdmin();
  const b = loadBooking(int(fd, "booking"));
  if (!b || b.status !== "en_curso") flash(backFor(fd), "Reserva no válida.", "error");
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
        post(conn, uid, "bono", clpToFils(PASSPORT_REWARD_CLP, clpPerAed()), "Pasaporte del amor completo: Cita Clásica de regalo", ref);
        notify(conn, uid, "sistema", "¡Pasaporte del amor completo! 🎉", "Tienes una Cita Clásica de regalo en tu billetera.", "/park/pasaporte");
      }
    }
    notify(conn, b.user_id, "reserva", "Gracias por vuestra cita en TWO LOVE Park 💞", p?.stamps.length ? "Nuevos sellos en vuestro pasaporte." : "", b.photo_consent ? "/park/mis-citas" : "/park/pasaporte");
  });
  revalidatePath(ADMIN_BACK);
  flash(backFor(fd, b.qr), "Cita completada: sellos entregados.");
}

export async function parkNoShow(fd: FormData) {
  await requireAdmin();
  const b = loadBooking(int(fd, "booking"));
  if (!b || b.status !== "reservada") flash(backFor(fd), "Reserva no válida.", "error");
  transaction((conn) => {
    conn.prepare("UPDATE park_bookings SET status = 'no_show' WHERE id = ?").run(b.id);
    notify(conn, b.user_id, "reserva", "No pudimos recibiros en TWO LOVE Park", "El anticipo queda retenido según las condiciones de reserva.", "/park/mis-citas");
  });
  revalidatePath(ADMIN_BACK);
  flash(backFor(fd, b.qr), "Marcada como no presentada.");
}

export async function parkCancelAdmin(fd: FormData) {
  await requireAdmin();
  const b = loadBooking(int(fd, "booking"));
  if (!b || b.status !== "reservada") flash(backFor(fd), "Reserva no válida.", "error");
  const p = productById(b.product);
  const err = attempt((conn) => {
    conn.prepare("UPDATE park_bookings SET status = 'cancelada' WHERE id = ?").run(b.id);
    refundBooking(conn, b, p?.stream ?? "park_pase");
    notify(conn, b.user_id, "reserva", "El local ha cancelado tu cita en TWO LOVE Park", "Te hemos devuelto el anticipo íntegro.", "/park/mis-citas");
    const to = conn.prepare("SELECT email FROM users WHERE id = ?").get(b.user_id) as { email: string };
    queueEmail(conn, {
      to: to.email, subject: "Tu cita en TWO LOVE Park ha sido cancelada", ref: `park:${b.id}`,
      title: "Hemos tenido que cancelar vuestra cita",
      lines: [`${p?.name ?? ""} · ${b.slot_at.slice(0, 16)}.`, b.voucher_id ? "Tu tarjeta regalo vuelve a estar disponible." : "Te hemos devuelto el anticipo íntegro a tu billetera TWO LOVE.", "Sentimos las molestias. Elige otro día cuando queráis."],
      cta: { label: "Reservar otra fecha", href: `/park/reservar?p=${b.product}` },
    });
  });
  if (err) flash(backFor(fd, b.qr), err, "error");
  await flushOutbox();
  revalidatePath(ADMIN_BACK);
  flash(backFor(fd, b.qr), "Reserva cancelada y anticipo devuelto.");
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

// ── Paso de cuenta "solo Park" al ecosistema completo (21+) ─────────────────

export async function upgradeToPrivate() {
  const user = await requireUser({ park: true });
  if (user.scope !== "park") flash("/descubrir", "Tu cuenta ya tiene acceso completo.");
  const p = one<{ birth_year: number | null }>("SELECT birth_year FROM profiles WHERE user_id = ?", user.id);
  if (!p?.birth_year || p.birth_year > new Date().getFullYear() - 21) flash("/park/pasaporte", "TWO LOVE Private es solo para mayores de 21 años.", "error");
  transaction((conn) => {
    conn.prepare("UPDATE users SET scope = 'full' WHERE id = ?").run(user.id);
    conn.prepare("UPDATE profiles SET real_dating = 1 WHERE user_id = ?").run(user.id);
    notify(conn, user.id, "sistema", "Bienvenido/a a TWO LOVE Private", "Completa tu perfil y tus 5 verificaciones para empezar a conectar.", "/verificacion");
  });
  revalidatePath("/", "layout");
  flash("/perfil/editar", "¡Ya tienes acceso completo a TWO LOVE! Completa tu perfil para empezar.");
}

// ── Tarjetas regalo: "Regala una cita" ──────────────────────────────────────

export async function buyVoucher(fd: FormData) {
  const user = await requireUser({ park: true });
  const product = productById(str(fd, "product", 20));
  const name = str(fd, "recipient_name", 60);
  const email = str(fd, "recipient_email", 160).toLowerCase();
  if (!product) flash("/park/regalar", "Elige una experiencia.", "error");
  if (user.role === "admin") flash("/park/regalar", "Las cuentas de administración no hacen reservas.", "error");
  if (name.length < 2) flash("/park/regalar", "Indica a quién va dirigido el regalo.", "error");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) flash("/park/regalar", "Email no válido.", "error");
  // Quien regala paga con su descuento de membresía/Club; la tarjeta cubre la experiencia completa
  const { rate: discountRate } = parkDiscount(user.id, user.tier);
  const amount = product.price - Math.round(product.price * discountRate);
  const rate = clpPerAed();
  const code = "TLG-" + crypto.randomBytes(4).toString("hex").toUpperCase();
  const err = attempt((conn) => {
    const id = Number(conn.prepare(`INSERT INTO park_vouchers (code, product, buyer_id, recipient_name, recipient_email, message, amount, fx_rate, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+${VOUCHER_MONTHS} months'))`).run(code, product.id, user.id, name, email, str(fd, "message", 300), amount, rate).lastInsertRowid);
    post(conn, user.id, "park", -clpToFils(amount, rate), `TWO LOVE Park · regalo ${product.name}`, `park_voucher:${id}`);
    // Si quien lo recibe ya tiene cuenta, le llega el aviso con el enlace para canjearlo
    const to = email ? (conn.prepare("SELECT id FROM users WHERE email = ? AND status = 'active'").get(email) as { id: number } | undefined) : undefined;
    if (to && to.id !== user.id) notify(conn, to.id, "regalo", `${user.name.split(" ")[0]} te regala una cita en TWO LOVE Park 🎁`, `${product.name} · código ${code}`, `/park/reservar?p=${product.id}&v=${code}`);
    if (email) {
      const msg = str(fd, "message", 300);
      queueEmail(conn, {
        to: email, subject: `${user.name.split(" ")[0]} te regala una cita en TWO LOVE Park 🎁`, ref: `park_voucher:${id}`,
        title: `${name}, tienes una cita de regalo`,
        lines: [
          `${user.name.split(" ")[0]} te regala «${product.name}» en TWO LOVE Park, el parque de citas de Santiago.`,
          ...(msg ? [`«${msg}»`] : []),
          `Vale ${VOUCHER_MONTHS} meses y cubre la experiencia completa. Al reservar, escribe este código:`,
        ],
        highlight: code,
        cta: to ? { label: "Reservar mi cita", href: `/park/reservar?p=${product.id}&v=${code}` } : { label: "Crear mi cuenta y reservar", href: "/park/registro" },
      });
    }
  });
  if (err) flash("/park/regalar", err, "error");
  await flushOutbox();
  revalidatePath("/park/regalar");
  flash("/park/regalar", `Regalo creado: ${code}. Compártelo con ${name}; vale ${VOUCHER_MONTHS} meses.`);
}

// ── Encuesta de validación (pública) ─────────────────────────────────────────

export async function submitSurvey(fd: FormData) {
  const back = "/park/encuesta";
  if (str(fd, "website", 100)) flash(back, "¡Gracias por responder!"); // trampa para bots
  const pick = (key: string, n: number) => {
    const v = int(fd, key);
    return fd.get(key) !== null && v >= 0 && v < n ? v : -1;
  };
  const age = pick("age", SURVEY.ages.length), together = pick("together", SURVEY.together.length), frequency = pick("frequency", SURVEY.frequency.length);
  const spend = pick("spend", SURVEY.spend.length), pay = pick("pay", SURVEY.answers.length), club = pick("club", SURVEY.answers.length);
  if ([age, together, frequency, spend, pay, club].some((x) => x < 0)) flash(back, "Responde todas las preguntas obligatorias.", "error");
  // No se guardan datos de contacto de menores de edad
  const email = age === 0 ? "" : str(fd, "email", 160).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) flash(back, "Email no válido.", "error");
  if (email && fd.get("consent") !== "on") flash(back, "Para dejarnos tu email acepta que te contactemos para el pop-up.", "error");
  if (email && one("SELECT 1 FROM park_survey WHERE email = ?", email)) flash(back, "Ya recibimos tu respuesta. ¡Gracias!");
  const zones = list(fd, "interests", PARK_ZONES.map((z) => z.id));
  const dates = list(fd, "dates", SURVEY.dates);
  transaction((conn) => {
    conn.prepare("INSERT INTO park_survey (age, together, frequency, spend, interests, pay, club, dates, comuna, email) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(age, together, frequency, spend, zones.join(","), pay, club, dates.join(","), str(fd, "comuna", 60), email);
  });
  flash(`${back}?gracias=1`, "¡Gracias por responder! Nos ayudas a diseñar TWO LOVE Park.");
}

// ── Campañas de temporada (administración) ───────────────────────────────────

export async function saveCampaign(fd: FormData) {
  await requireAdmin();
  const back = "/admin/park/campanas";
  const code = str(fd, "code", 20).toUpperCase().replace(/[^A-Z0-9]/g, "");
  const name = str(fd, "name", 80);
  const pctValue = Number(str(fd, "discount", 6).replace(",", "."));
  const starts = str(fd, "starts_on", 10), ends = str(fd, "ends_on", 10);
  const maxUses = int(fd, "max_uses");
  const products = list(fd, "products", PARK_PRODUCTS.map((p) => p.id));
  if (code.length < 3) flash(back, "El código debe tener al menos 3 letras o números.", "error");
  if (name.length < 3) flash(back, "Indica el nombre de la campaña.", "error");
  if (!(pctValue >= 1 && pctValue <= 50)) flash(back, "El descuento debe estar entre 1 % y 50 %.", "error");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(starts) || !/^\d{4}-\d{2}-\d{2}$/.test(ends) || ends < starts) flash(back, "Revisa las fechas de la campaña.", "error");
  if (one("SELECT 1 FROM park_campaigns WHERE code = ?", code)) flash(back, "Ya existe una campaña con ese código.", "error");
  transaction((conn) => {
    conn.prepare("INSERT INTO park_campaigns (code, name, description, discount, starts_on, ends_on, products, max_uses) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(code, name, str(fd, "description", 200), pctValue / 100, starts, ends, products.join(","), maxUses > 0 ? maxUses : null);
  });
  revalidatePath(back);
  flash(back, `Campaña ${code} creada.`);
}

export async function toggleCampaign(fd: FormData) {
  await requireAdmin();
  const id = int(fd, "campaign");
  transaction((conn) => {
    conn.prepare("UPDATE park_campaigns SET active = 1 - active WHERE id = ?").run(id);
  });
  revalidatePath("/admin/park/campanas");
  flash("/admin/park/campanas", "Campaña actualizada.");
}

// ── Invitación al pop-up de prueba (personas que dejaron su email en la encuesta) ──

export async function invitePopup(fd: FormData) {
  await requireAdmin();
  const back = "/admin/park/encuesta";
  const when = str(fd, "when", 80), where = str(fd, "where", 120);
  if (when.length < 3 || where.length < 3) flash(back, "Indica la fecha y el lugar del pop-up.", "error");
  let queued = 0;
  transaction((conn) => {
    const rows = conn.prepare("SELECT id, email FROM park_survey WHERE email != '' AND invited_at IS NULL").all() as { id: number; email: string }[];
    for (const r of rows) {
      const ok = queueEmail(conn, {
        to: r.email, kind: "marketing", subject: "Os invitamos al pop-up de TWO LOVE Park 💞", ref: `park_survey:${r.id}`,
        title: "Gracias por contarnos cómo son vuestras citas",
        lines: [
          "Con vuestras respuestas preparamos un pop-up de TWO LOVE Park: cabinas de fotos, misterio para dos y café-juego para probar antes de abrir.",
          `Cuándo: ${when}. Dónde: ${where}.`,
          "La entrada es gratuita para las parejas que respondieron la encuesta. Traed este correo.",
        ],
        cta: { label: "Conocer TWO LOVE Park", href: "/park" },
      });
      conn.prepare("UPDATE park_survey SET invited_at = datetime('now') WHERE id = ?").run(r.id);
      if (ok) queued++;
    }
  });
  await flushOutbox(500);
  revalidatePath(back);
  flash(back, `Invitaciones enviadas: ${queued}.`);
}
