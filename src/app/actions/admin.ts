"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { one, transaction } from "@/lib/db";
import { flash, int, str } from "@/lib/flash";
import { post, recordRevenue, releaseHold } from "@/lib/ledger";

export async function reviewVerification(fd: FormData) {
  const admin = await requireAdmin();
  const id = int(fd, "id");
  const decision = str(fd, "decision") === "approve" ? "approved" : "rejected";
  const notes = str(fd, "notes", 300);
  if (decision === "rejected" && !notes) flash("/admin/verificaciones", "Indica el motivo del rechazo.", "error");
  transaction((conn) =>
    conn.prepare("UPDATE verifications SET status = ?, notes = ?, reviewer_id = ?, reviewed_at = datetime('now') WHERE id = ? AND status = 'pending'")
      .run(decision, notes || null, admin.id, id),
  );
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
  transaction((conn) => post(conn, userId, "bono", amount, str(fd, "reason", 120) || "Crédito de cortesía", `admin:${admin.id}`));
  flash(`/admin/crm/${userId}`, "Crédito abonado.");
}

export async function updateGiftOrder(fd: FormData) {
  await requireAdmin();
  const status = str(fd, "status");
  if (!["pagado", "preparando", "entregado"].includes(status)) flash("/admin/erp", "Estado no válido.", "error");
  transaction((conn) => conn.prepare("UPDATE gift_orders SET status = ? WHERE id = ?").run(status, int(fd, "id")));
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
      conn.prepare("UPDATE bookings SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?").run(b.id);
    } else {
      post(conn, b.provider_id, "ganancia", b.provider_payout, `Disputa resuelta · reserva #${b.id}`, `booking:${b.id}`);
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
  transaction((conn) => conn.prepare("UPDATE concierge_requests SET status = ? WHERE id = ?").run(status, int(fd, "id")));
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
