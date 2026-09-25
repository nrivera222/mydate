import "server-only";
import type { DatabaseSync } from "node:sqlite";

export type NotificationKind = "match" | "mensaje" | "reserva" | "regalo" | "verificacion" | "evento" | "referido" | "sistema";

/** Crea una notificación in-app. Usar dentro de la transacción de la operación que la origina. */
export function notify(conn: DatabaseSync, userId: number | null | undefined, kind: NotificationKind, title: string, body = "", href = "") {
  if (!userId) return;
  conn.prepare("INSERT INTO notifications (user_id, kind, title, body, href) VALUES (?, ?, ?, ?, ?)").run(userId, kind, title, body, href);
}

export const NOTIFICATION_ICON: Record<string, string> = {
  match: "♥", mensaje: "💬", reserva: "📅", regalo: "🎁", verificacion: "✓", evento: "🥂", referido: "🤝", sistema: "✦",
};
