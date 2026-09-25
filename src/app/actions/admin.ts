"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { one, transaction } from "@/lib/db";
import { flash, int, str } from "@/lib/flash";
import { post, recordRevenue, releaseHold } from "@/lib/ledger";
import { notify } from "@/lib/notify";
import { VERIFICATION_TYPES } from "@/lib/catalog";

export async function reviewVerification(fd: FormData) {
  const admin = await requireAdmin();
  const id = int(fd, "id");
  const decision = str(fd, "decision") === "approve" ? "approved" : "rejected";
  const notes = str(fd, "notes", 300);
  if (decision === "rejected" && !notes) flash("/admin/verificaciones", "Indica el motivo del rechazo.", "error");
  transaction((conn) => {
    const v = conn.prepare("SELECT user_id, type FROM verifications WHERE id = ? AND status = 'pending'").get(id) as { user_id: number; type: string } | undefined;
    if (!v) return;
    conn.prepare("UPDATE verifications SET status = ?, notes = ?, reviewer_id = ?, reviewed_at = datetime('now') WHERE id = ?").run(decision, notes || null, admin.id, id);
    const label = VERIFICATION_TYPES.find((t) => t.id === v.type)?.label ?? v.type;
    notify(conn, v.user_id, "verificacion", decision === "approved" ? `${label}: verificación aprobada ✓` : `${label}: verificación rechazada`, decision === "approved" ? "" : `Motivo: ${notes}`, "/verificacion");
  });
  revalidatePath("/admin", "layout");
  flash("/admin/verificaciones", decision === "approved" ? "Verificación aprobada." : "Verificación rechazada.");
}

export async function addCrmNote(fd: FormData) {
  const admin = await requireAdmin();
  const userId = int(fd, "user");
  const body = str(fd, "body", 1000);
  const kind = ["nota", "llamada", "concierge", "incidencia"].includes(str(fd, "kind")) ? str(fd, "kind") : "nota";
  if (!body) flash(`/admin/crm/${userId}`, "Escribe la nota.", "error");
  transaction((conn) => conn.prepare("INSERT INTO crm_notes (user_id, author_id, kind, body) VALUES (?, ?, ?, ?)").run(userId, admin.id, kind, body));
  revalidatePath(`/admin/crm/${userId}`);
  flash(`/admin/crm/${userId}`, "Nota añadida.");
}

export async function setUserStatus(fd: FormData) {
  await requireAdmin();
  const userId = int(fd, "user");
  const status = str(fd, "status") === "suspended" ? "suspended" : "active";
  transaction((conn) => conn.prepare("UPDATE users SET status = ? WHERE id = ? AND role = 'user'").run(status, userId));
  revalidatePath(`/admin/crm/${userId}`);
  flash(`/admin/crm/${userId}`, status === "suspended" ? "Cuenta suspendida." : "Cuenta reactivada.");
}

export async function grantCredit(fd: FormData) {
  const admin = await requireAdmin();
  const userId = int(fd, "user");
  const amount = Math.round(Number(fd.get("amount")) * 100);
  if (!(amount > 0 && amount <= 10_000_00)) flash(`/admin/crm/${userId}`, "Importe entre 1 y 10.000 AED.", "error");
  transaction((conn) => {
    post(conn, userId, "bono", amount, str(fd, "reason", 120) || "Crédito de cortesía", `admin:${admin.id}`);
    notify(conn, userId, "sistema", "Has recibido un crédito de cortesía", str(fd, "reason", 120), "/billetera");
  });
  flash(`/admin/crm/${userId}`, "Crédito abonado.");
}

export async function updateGiftOrder(fd: FormData) {
  await requireAdmin();
  const status = str(fd, "status");
  if (!["pagado", "preparando", "entregado"].includes(status)) flash("/admin/erp", "Estado no válido.", "error");
  transaction((conn) => {
    conn.prepare("UPDATE gift_orders SET status = ? WHERE id = ?").run(status, int(fd, "id"));
    const o = conn.prepare("SELECT o.recipient_id, g.name FROM gift_orders o JOIN gifts g ON g.id = o.gift_id WHERE o.id = ?").get(int(fd, "id")) as { recipient_id: number; name: string } | undefined;
    if (o && status === "entregado") notify(conn, o.recipient_id, "regalo", `Tu regalo ha sido entregado: ${o.name}`, "", "/regalos");
  });
  revalidatePath("/admin/erp");
  flash("/admin/erp#pedidos", "Pedido actualizado.");
}

export async function markPayablePaid(fd: FormData) {
  await requireAdmin();
  transaction((conn) => conn.prepare("UPDATE payables SET status = 'pagado' WHERE id = ?").run(int(fd, "id")));
  revalidatePath("/admin/erp");
  flash("/admin/erp#pagos", "Pago registrado.");
}

export async function restock(fd: FormData) {
  await requireAdmin();
  const qty = int(fd, "qty");
  if (qty < 1 || qty > 1000) flash("/admin/erp#inventario", "Cantidad no válida.", "error");
  transaction((conn) => conn.prepare("UPDATE gifts SET stock = stock + ? WHERE id = ? AND stock IS NOT NULL").run(qty, int(fd, "id")));
  revalidatePath("/admin/erp");
  flash("/admin/erp#inventario", "Inventario actualizado.");
}

export async function resolveReport(fd: FormData) {
  await requireAdmin();
  transaction((conn) => conn.prepare("UPDATE reports SET status = 'resuelto' WHERE id = ?").run(int(fd, "id")));
  revalidatePath("/admin");
  flash("/admin/seguridad", "Denuncia resuelta.");
}

/** Resuelve una disputa de reserva: reembolso al cliente o pago al acompañante. */
export async function resolveDispute(fd: FormData) {
  await requireAdmin();
  const b = one<{ id: number; client_id: number; provider_id: number; total: number; service_fee: number; vat: number; provider_commission: number; provider_payout: number; status: string }>(
    "SELECT * FROM bookings WHERE id = ? AND kind = 'companion'", int(fd, "booking"),
  );
  if (!b || b.status !== "disputed") flash("/admin/seguridad", "Disputa no encontrada.", "error");
  const favor = str(fd, "favor");
  transaction((conn) => {
    releaseHold(conn, b.client_id, b.total);
    if (favor === "client") {
      post(conn, b.client_id, "reembolso", b.total, `Disputa resuelta a tu favor · reserva #${b.id}`, `booking:${b.id}`);
      notify(conn, b.client_id, "reserva", `Disputa #${b.id} resuelta a tu favor`, "Hemos reembolsado el importe íntegro.", "/billetera");
      notify(conn, b.provider_id, "reserva", `Disputa #${b.id} resuelta`, "Se ha reembolsado al cliente.", "/reservas");
      conn.prepare("UPDATE bookings SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?").run(b.id);
    } else {
      post(conn, b.provider_id, "ganancia", b.provider_payout, `Disputa resuelta · reserva #${b.id}`, `booking:${b.id}`);
      notify(conn, b.provider_id, "reserva", `Disputa #${b.id} resuelta a tu favor`, "El pago ya está en tu billetera.", "/billetera");
      notify(conn, b.client_id, "reserva", `Disputa #${b.id} resuelta`, "Se ha liberado el pago al acompañante.", "/reservas");
      recordRevenue(conn, "tarifa_servicio", b.service_fee, b.vat, b.client_id, `booking:${b.id}`);
      recordRevenue(conn, "comision_reserva", b.provider_commission, 0, b.provider_id, `booking:${b.id}`);
      conn.prepare("UPDATE bookings SET status = 'completed', updated_at = datetime('now') WHERE id = ?").run(b.id);
    }
  });
  revalidatePath("/admin/seguridad");
  flash("/admin/seguridad", "Disputa resuelta.");
}

export async function updateConcierge(fd: FormData) {
  await requireAdmin();
  const status = str(fd, "status");
  if (!["nuevo", "en_curso", "resuelto"].includes(status)) flash("/admin/crm", "Estado no válido.", "error");
  transaction((conn) => {
    const c = conn.prepare("SELECT user_id FROM concierge_requests WHERE id = ?").get(int(fd, "id")) as { user_id: number } | undefined;
    conn.prepare("UPDATE concierge_requests SET status = ? WHERE id = ?").run(status, int(fd, "id"));
    notify(conn, c?.user_id, "sistema", status === "resuelto" ? "Tu concierge ha resuelto tu solicitud" : "Tu concierge está trabajando en tu solicitud", "", "/concierge");
  });
  revalidatePath("/admin/crm");
  flash("/admin/crm#concierge", "Solicitud actualizada.");
}

export async function savePartner(fd: FormData) {
  await requireAdmin();
  const name = str(fd, "name", 120);
  const category = str(fd, "category", 40);
  const benefit = str(fd, "benefit", 200);
  if (!name || !category || !benefit) flash("/admin/erp#aliados", "Completa nombre, categoría y beneficio.", "error");
  const discount = Math.min(0.9, Math.max(0, Number(fd.get("discount")) / 100 || 0));
  const commission = Math.min(0.9, Math.max(0, Number(fd.get("commission")) / 100 || 0));
  transaction((conn) =>
    conn.prepare("INSERT INTO partners (name, category, city, benefit, discount, commission, min_tier, contact) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(name, category, str(fd, "city", 60), benefit, discount, commission, str(fd, "min_tier", 20) || "essential", str(fd, "contact", 120)),
  );
  revalidatePath("/aliados");
  flash("/admin/erp#aliados", "Aliado añadido.");
}

export async function invoicePartner(fd: FormData) {
  await requireAdmin();
  const partnerId = int(fd, "partner");
  const amount = Math.round(Number(fd.get("amount")) * 100);
  if (!(amount > 0)) flash("/admin/erp#aliados", "Importe no válido.", "error");
  transaction((conn) => recordRevenue(conn, "aliado", amount, 0, null, `partner:${partnerId}:${str(fd, "concept", 80) || "patrocinio"}`));
  flash("/admin/erp#aliados", "Ingreso de alianza registrado.");
}

export async function createEvent(fd: FormData) {
  await requireAdmin();
  const title = str(fd, "title", 120);
  const startsAt = str(fd, "starts_at", 16);
  const capacity = int(fd, "capacity");
  const price = Math.round(Number(fd.get("price")) * 100);
  if (!title || !str(fd, "city", 60) || !str(fd, "venue", 120)) flash("/admin/eventos", "Completa título, ciudad y lugar.", "error");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(startsAt) || new Date(startsAt).getTime() < Date.now()) flash("/admin/eventos", "Fecha no válida.", "error");
  if (capacity < 2 || capacity > 2000 || !(price >= 0)) flash("/admin/eventos", "Aforo o precio no válidos.", "error");
  transaction((conn) =>
    conn.prepare("INSERT INTO events (title, city, venue, starts_at, description, capacity, price, min_tier, emoji) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(title, str(fd, "city", 60), str(fd, "venue", 120), startsAt.replace("T", " ") + ":00", str(fd, "description", 1000), capacity, price, str(fd, "min_tier", 20) || "essential", str(fd, "emoji", 8) || "✨"),
  );
  revalidatePath("/eventos");
  flash("/admin/eventos", "Evento publicado.");
}

/** Cancela un evento y reembolsa todas las entradas. */
export async function cancelEvent(fd: FormData) {
  await requireAdmin();
  const id = int(fd, "id");
  transaction((conn) => {
    const ev = conn.prepare("SELECT title FROM events WHERE id = ? AND status = 'publicado'").get(id) as { title: string } | undefined;
    if (!ev) return;
    conn.prepare("UPDATE events SET status = 'cancelado' WHERE id = ?").run(id);
    const tickets = conn.prepare("SELECT id, user_id, price, vat FROM event_tickets WHERE event_id = ? AND status = 'confirmada'").all(id) as { id: number; user_id: number; price: number; vat: number }[];
    for (const t of tickets) {
      if (t.price + t.vat > 0) post(conn, t.user_id, "reembolso", t.price + t.vat, `Evento cancelado: ${ev.title}`, `ticket:${t.id}`);
      if (t.price + t.vat > 0) recordRevenue(conn, "evento", -t.price, -t.vat, t.user_id, `ticket:${t.id}:reembolso`);
      conn.prepare("UPDATE event_tickets SET status = 'reembolsada' WHERE id = ?").run(t.id);
      notify(conn, t.user_id, "evento", `Evento cancelado: ${ev.title}`, "Te hemos reembolsado la entrada.", "/billetera");
    }
  });
  revalidatePath("/eventos");
  flash("/admin/eventos", "Evento cancelado y entradas reembolsadas.");
}
