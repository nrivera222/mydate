import "server-only";
import crypto from "node:crypto";
import { headers } from "next/headers";
import { run } from "./db";

// Integración con Stripe Checkout mediante su API REST (sin SDK).
// Si STRIPE_SECRET_KEY no está definido, la billetera funciona en modo demostración.

export const paymentsEnabled = () => !!process.env.STRIPE_SECRET_KEY;

async function baseUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  return h.get("origin") ?? `https://${h.get("host")}`;
}

/** Crea una sesión de Stripe Checkout para recargar la billetera y devuelve su URL. */
export async function createCheckout(userId: number, email: string, amount: number) {
  const base = await baseUrl();
  const body = new URLSearchParams({
    mode: "payment",
    customer_email: email,
    client_reference_id: String(userId),
    "metadata[user_id]": String(userId),
    "metadata[purpose]": "wallet_topup",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "aed",
    "line_items[0][price_data][unit_amount]": String(amount),
    "line_items[0][price_data][product_data][name]": "Recarga de billetera TWO LOVE",
    success_url: `${base}/billetera?ok=${encodeURIComponent("Pago recibido. El saldo se abonará en unos segundos.")}`,
    cancel_url: `${base}/billetera?error=${encodeURIComponent("Pago cancelado.")}`,
  });
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Stripe ${res.status}: ${await res.text()}`);
  const session = (await res.json()) as { id: string; url: string };
  run("INSERT INTO payments (user_id, provider, external_id, amount) VALUES (?, 'stripe', ?, ?)", userId, session.id, amount);
  return session.url;
}

/** Verifica la cabecera Stripe-Signature (HMAC-SHA256, tolerancia de 5 minutos). */
export function verifyStripeSignature(payload: string, header: string | null, secret: string, now = Date.now()) {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=") as [string, string]));
  const t = Number(parts.t);
  const signatures = header.split(",").filter((kv) => kv.startsWith("v1=")).map((kv) => kv.slice(3));
  if (!t || !signatures.length || Math.abs(now / 1000 - t) > 300) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  return signatures.some((sig) => sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)));
}
