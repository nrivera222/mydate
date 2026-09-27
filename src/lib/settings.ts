import "server-only";
import type { DatabaseSync } from "node:sqlite";
import { all, one } from "./db";
import { FX } from "./catalog";
import { CLP_PER_AED } from "./park-catalog";

// Ajustes del ecosistema editables desde /admin/ajustes. Cada cambio queda en settings_log.

export const SETTINGS = {
  clp_per_aed: { label: "Tipo de cambio CLP por AED", min: 50, max: 2_000, default: CLP_PER_AED },
} as const;
export type SettingKey = keyof typeof SETTINGS;

export function getNumber(key: SettingKey): number {
  const row = one<{ value: string }>("SELECT value FROM settings WHERE key = ?", key);
  const n = Number(row?.value);
  return Number.isFinite(n) && n > 0 ? n : SETTINGS[key].default;
}

/** CLP por AED vigente. Sincroniza la conversión de visualización de la billetera (money(…, "CLP")). */
export function clpPerAed() {
  const rate = getNumber("clp_per_aed");
  FX.CLP = rate;
  return rate;
}

export function setSetting(conn: DatabaseSync, key: SettingKey, value: number, userId: number, note = "") {
  const old = conn.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  conn.prepare(`INSERT INTO settings (key, value, updated_by) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = datetime('now')`).run(key, String(value), userId);
  conn.prepare("INSERT INTO settings_log (key, old_value, new_value, note, user_id) VALUES (?, ?, ?, ?, ?)").run(key, old?.value ?? null, String(value), note, userId);
}

export const settingsLog = (key: SettingKey) =>
  all<{ old_value: string | null; new_value: string; note: string; created_at: string; name: string | null }>(
    "SELECT l.old_value, l.new_value, l.note, l.created_at, u.name FROM settings_log l LEFT JOIN users u ON u.id = l.user_id WHERE l.key = ? ORDER BY l.id DESC LIMIT 20", key,
  );
