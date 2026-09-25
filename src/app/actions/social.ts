"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { one, run } from "@/lib/db";
import { flash, int, str } from "@/lib/flash";
import { REPORT_REASONS, tierById } from "@/lib/catalog";
import { isBlockedBetween, isFullyVerified, isMatch } from "@/lib/users";

export async function react(fd: FormData) {
  const user = await requireUser();
  const target = int(fd, "target");
  const kind = str(fd, "kind");
  const back = str(fd, "back") || "/descubrir";
  if (!["like", "super", "pass"].includes(kind) || target === user.id) flash(back, "Acción no válida.", "error");
  if (!one("SELECT 1 FROM users WHERE id = ? AND role = 'user'", target)) flash(back, "Perfil no encontrado.", "error");
  if (kind !== "pass" && !isFullyVerified(user.id)) flash("/verificacion", "Completa tus 5 verificaciones para dar like.", "error");
  if (isBlockedBetween(user.id, target)) flash(back, "No puedes interactuar con este perfil.", "error");

  const tier = tierById(user.tier);
  if (kind !== "pass") {
    const today = one<{ likes: number; supers: number }>(
      `SELECT SUM(kind = 'like') AS likes, SUM(kind = 'super') AS supers FROM likes WHERE from_id = ? AND date(created_at) = date('now')`, user.id,
    ) ?? { likes: 0, supers: 0 };
    if (kind === "like" && tier.dailyLikes >= 0 && (today.likes ?? 0) >= tier.dailyLikes)
      flash("/membresias", `Has usado tus ${tier.dailyLikes} likes de hoy. Sube de nivel para seguir conectando.`, "error");
    if (kind === "super" && tier.superLikes >= 0 && (today.supers ?? 0) >= tier.superLikes)
      flash("/membresias", tier.superLikes ? "Has usado tus Super Likes de hoy." : "Los Super Likes están disponibles desde Gold.", "error");
  }

  run("INSERT INTO likes (from_id, to_id, kind) VALUES (?, ?, ?) ON CONFLICT(from_id, to_id) DO UPDATE SET kind = excluded.kind, created_at = datetime('now')", user.id, target, kind);
  revalidatePath("/descubrir");
  if (kind !== "pass" && isMatch(user.id, target)) {
    flash(`/mensajes/${target}`, "¡Es un match! Rompe el hielo con un mensaje o un regalo.");
  }
  redirect(back);
}

export async function sendMessage(fd: FormData) {
  const user = await requireUser();
  const to = int(fd, "to");
  const body = str(fd, "body", 1000);
  const back = `/mensajes/${to}`;
  if (!body) redirect(back);
  const hasBooking = one("SELECT 1 FROM bookings WHERE ((client_id = ? AND provider_id = ?) OR (client_id = ? AND provider_id = ?)) AND status IN ('requested','accepted','completed')", user.id, to, to, user.id);
  if (!isMatch(user.id, to) && !hasBooking) flash(back, "Solo puedes escribir a tus matches o a personas con reserva contigo.", "error");
  if (isBlockedBetween(user.id, to)) flash(back, "Conversación bloqueada.", "error");
  // Filtro de seguridad: evitar compartir datos de contacto o pagos fuera de la plataforma
  const risky = /(\+?\d[\d\s-]{8,}\d)|(whats ?app|telegram|iban|western union|transferencia)/i.test(body);
  run("INSERT INTO messages (from_id, to_id, body) VALUES (?, ?, ?)", user.id, to, body);
  revalidatePath(back);
  if (risky) flash(back, "Recuerda: por tu seguridad, mantén pagos y contacto dentro de TWO LOVE.", "error");
  redirect(back);
}

export async function report(fd: FormData) {
  const user = await requireUser();
  const target = int(fd, "target");
  const reason = str(fd, "reason");
  const back = `/perfil/${target}`;
  if (!REPORT_REASONS.includes(reason)) flash(back, "Selecciona un motivo.", "error");
  run("INSERT INTO reports (reporter_id, reported_id, reason, details) VALUES (?, ?, ?, ?)", user.id, target, reason, str(fd, "details", 1000));
  if (fd.get("block") === "on") run("INSERT OR IGNORE INTO blocks (blocker_id, blocked_id) VALUES (?, ?)", user.id, target);
  flash(fd.get("block") === "on" ? "/descubrir" : back, "Denuncia enviada. El equipo de Confianza y Seguridad la revisará.");
}

export async function block(fd: FormData) {
  const user = await requireUser();
  const target = int(fd, "target");
  run("INSERT OR IGNORE INTO blocks (blocker_id, blocked_id) VALUES (?, ?)", user.id, target);
  flash("/descubrir", "Perfil bloqueado. No volverá a aparecer.");
}
