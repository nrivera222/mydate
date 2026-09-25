import "server-only";
import type { DatabaseSync } from "node:sqlite";

// Operaciones contables de billetera. Deben ejecutarse dentro de una transacción.

export class LedgerError extends Error {}

function ensureWallet(conn: DatabaseSync, userId: number) {
  conn.prepare("INSERT OR IGNORE INTO wallets (user_id, balance, held) VALUES (?, 0, 0)").run(userId);
}

export function walletOf(conn: DatabaseSync, userId: number) {
  ensureWallet(conn, userId);
  return conn.prepare("SELECT balance, held FROM wallets WHERE user_id = ?").get(userId) as { balance: number; held: number };
}

/** Mueve saldo disponible (amount con signo) y deja asiento. */
export function post(conn: DatabaseSync, userId: number, type: string, amount: number, description: string, ref = "", at?: string) {
  const w = walletOf(conn, userId);
  const next = w.balance + amount;
  if (next < 0) throw new LedgerError("Saldo insuficiente en la billetera.");
  conn.prepare("UPDATE wallets SET balance = ? WHERE user_id = ?").run(next, userId);
  conn
    .prepare("INSERT INTO wallet_tx (user_id, type, amount, balance_after, ref, description, created_at) VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))")
    .run(userId, type, amount, next, ref, description, at ?? null);
  return next;
}

/** Retiene fondos en custodia (escrow). */
export function hold(conn: DatabaseSync, userId: number, amount: number, description: string, ref: string) {
  post(conn, userId, "custodia", -amount, description, ref);
  conn.prepare("UPDATE wallets SET held = held + ? WHERE user_id = ?").run(amount, userId);
}

/** Libera la custodia: sale del retenido (el destino lo decide quien llama). */
export function releaseHold(conn: DatabaseSync, userId: number, amount: number) {
  const w = walletOf(conn, userId);
  if (w.held < amount) throw new LedgerError("Custodia inconsistente.");
  conn.prepare("UPDATE wallets SET held = held - ? WHERE user_id = ?").run(amount, userId);
}

export function recordRevenue(conn: DatabaseSync, stream: string, amount: number, vat: number, userId: number | null, ref: string, at?: string) {
  conn
    .prepare("INSERT INTO revenue (stream, amount, vat, user_id, ref, created_at) VALUES (?, ?, ?, ?, ?, COALESCE(?, datetime('now')))")
    .run(stream, amount, vat, userId, ref, at ?? null);
}

export function recordPayable(conn: DatabaseSync, party: "partner" | "provider", target: { partnerId?: number | null; userId?: number | null }, amount: number, ref: string, status = "pendiente", at?: string) {
  conn
    .prepare("INSERT INTO payables (party, partner_id, user_id, amount, ref, status, created_at) VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))")
    .run(party, target.partnerId ?? null, target.userId ?? null, amount, ref, status, at ?? null);
}

/** Precio de una reserva de acompañamiento. */
export function quoteCompanion(rate: number, qty: number, serviceFeeRate: number, providerCommission: number, vatRate: number) {
  const subtotal = rate * qty;
  const serviceFee = Math.round(subtotal * serviceFeeRate);
  const vat = Math.round(serviceFee * vatRate);
  const total = subtotal + serviceFee + vat;
  const commission = Math.round(subtotal * providerCommission);
  return { subtotal, serviceFee, vat, total, commission, payout: subtotal - commission };
}
