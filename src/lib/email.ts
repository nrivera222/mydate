import "server-only";
import crypto from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { all, run } from "./db";

// Correo del ecosistema. Las operaciones encolan mensajes en email_outbox dentro de su transacción
// (si la operación falla, no sale ningún correo) y flushOutbox() los envía después:
// con RESEND_API_KEY por la API de Resend; sin ella quedan en modo demostración (registrados, no enviados).

export const emailEnabled = () => !!process.env.RESEND_API_KEY;
const FROM = () => process.env.EMAIL_FROM ?? "TWO LOVE <hola@twolove.app>";
const SITE = () => (process.env.APP_URL ?? "https://twolove.app").replace(/\/$/, "");

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Firma para el enlace de baja (no se puede dar de baja a otra persona sin el enlace). */
export const optoutToken = (email: string) =>
  crypto.createHmac("sha256", process.env.AUTH_SECRET ?? "two-love-dev-secret-change-me-in-production-please").update(`optout:${email.toLowerCase()}`).digest("base64url").slice(0, 32);
export const optoutUrl = (email: string) => `${SITE()}/baja?e=${encodeURIComponent(email)}&t=${optoutToken(email)}`;

export type EmailContent = {
  to: string;
  subject: string;
  title: string;
  lines: string[]; // párrafos (texto plano, se escapan)
  highlight?: string; // código o dato destacado
  cta?: { label: string; href: string }; // href relativo o absoluto
  kind?: "transaccional" | "marketing";
  ref?: string;
};

/** Plantilla de marca (Pulse Sphere): fondo espacial, degradado neón, compatible con clientes de correo. */
export function renderEmail(c: EmailContent) {
  const href = c.cta ? (c.cta.href.startsWith("http") ? c.cta.href : `${SITE()}${c.cta.href}`) : "";
  const unsubscribe = c.kind === "marketing" ? optoutUrl(c.to) : "";
  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#05040F;font-family:Montserrat,Helvetica,Arial,sans-serif;color:#F5F3FF">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#05040F;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%;background:#0B0A1F;border:1px solid #25213F;border-radius:20px;overflow:hidden">
<tr><td style="height:4px;background:linear-gradient(90deg,#38BDF8,#6366F1,#A855F7,#E879F9)"></td></tr>
<tr><td style="padding:28px 32px 8px;font-size:13px;letter-spacing:6px;font-weight:700">TWO <span style="color:#A78BFA">LOVE</span></td></tr>
<tr><td style="padding:8px 32px 0;font-size:24px;font-weight:600;line-height:1.25">${esc(c.title)}</td></tr>
<tr><td style="padding:12px 32px 0;font-size:15px;line-height:1.6;color:#C7D2FE">${c.lines.map((l) => `<p style="margin:0 0 12px">${esc(l)}</p>`).join("")}</td></tr>
${c.highlight ? `<tr><td style="padding:4px 32px 8px"><div style="font-family:Menlo,monospace;font-size:22px;letter-spacing:3px;color:#C4B5FD;background:#16132F;border:1px dashed #6366F1;border-radius:12px;padding:14px;text-align:center">${esc(c.highlight)}</div></td></tr>` : ""}
${href ? `<tr><td style="padding:16px 32px 8px"><a href="${esc(href)}" style="display:inline-block;background:#6366F1;background:linear-gradient(90deg,#38BDF8,#6366F1,#C026D3);color:#fff;text-decoration:none;font-weight:600;border-radius:999px;padding:12px 26px">${esc(c.cta!.label)}</a></td></tr>` : ""}
<tr><td style="padding:24px 32px 28px;font-size:11px;line-height:1.6;color:#6B6B9A">TWO LOVE · Dubái · Santiago · ${esc(SITE().replace(/^https?:\/\//, ""))}${unsubscribe ? `<br><a href="${esc(unsubscribe)}" style="color:#6B6B9A">Darme de baja de estas comunicaciones</a>` : ""}</td></tr>
</table></td></tr></table></body></html>`;
  const text = [c.title, "", ...c.lines, c.highlight ? `\n${c.highlight}\n` : "", href ? `${c.cta!.label}: ${href}` : "", unsubscribe ? `\nBaja: ${unsubscribe}` : ""].join("\n");
  return { html, text };
}

/** Encola un correo dentro de la transacción en curso. Los comerciales respetan las bajas. Devuelve false si se omitió. */
export function queueEmail(conn: DatabaseSync, c: EmailContent) {
  const to = c.to.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return false;
  if (c.kind === "marketing" && conn.prepare("SELECT 1 FROM email_optout WHERE email = ?").get(to)) return false;
  const { html, text } = renderEmail({ ...c, to });
  conn.prepare("INSERT INTO email_outbox (to_email, subject, html, text, kind, ref) VALUES (?, ?, ?, ?, ?, ?)").run(to, c.subject, html, text, c.kind ?? "transaccional", c.ref ?? "");
  return true;
}

/** Envía los correos pendientes (o los marca como demostración sin proveedor). Nunca lanza. */
export async function flushOutbox(limit = 50, ids?: number[]) {
  const rows = all<{ id: number; to_email: string; subject: string; html: string; text: string }>(
    `SELECT id, to_email, subject, html, text FROM email_outbox WHERE ${ids?.length ? `id IN (${ids.map(Number).join(",")})` : "status = 'pendiente'"} ORDER BY id LIMIT ?`, limit,
  );
  const key = process.env.RESEND_API_KEY;
  let sent = 0;
  for (const m of rows) {
    if (!key) {
      run("UPDATE email_outbox SET status = 'demo', attempts = attempts + 1, sent_at = datetime('now') WHERE id = ?", m.id);
      continue;
    }
    try {
      const res = await fetch(process.env.RESEND_API_URL ?? "https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: FROM(), to: [m.to_email], subject: m.subject, html: m.html, text: m.text }),
        signal: AbortSignal.timeout(8000),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
      if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
      run("UPDATE email_outbox SET status = 'enviado', provider_id = ?, error = NULL, attempts = attempts + 1, sent_at = datetime('now') WHERE id = ?", data.id ?? null, m.id);
      sent++;
    } catch (e) {
      run("UPDATE email_outbox SET status = 'error', error = ?, attempts = attempts + 1 WHERE id = ?", String((e as Error).message).slice(0, 300), m.id);
    }
  }
  return { processed: rows.length, sent };
}
