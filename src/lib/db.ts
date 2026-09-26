import "server-only";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { seed } from "./seed";
import { seedParkReference } from "./park-seed";

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',            -- user | admin
  tier TEXT NOT NULL DEFAULT 'essential',
  tier_expires_at TEXT,
  status TEXT NOT NULL DEFAULT 'active',        -- active | suspended
  source TEXT NOT NULL DEFAULT 'organico',      -- canal de adquisición (CRM)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_active_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  gender TEXT NOT NULL DEFAULT '',
  seeking TEXT NOT NULL DEFAULT '',              -- géneros buscados, csv
  birth_year INTEGER,
  city TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  nationality TEXT NOT NULL DEFAULT '',
  languages TEXT NOT NULL DEFAULT '',
  archetype TEXT NOT NULL DEFAULT '',
  occupation TEXT NOT NULL DEFAULT '',
  net_worth TEXT NOT NULL DEFAULT 'na',
  intent TEXT NOT NULL DEFAULT 'noviazgo',
  interests TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  age_min INTEGER NOT NULL DEFAULT 25,
  age_max INTEGER NOT NULL DEFAULT 55,
  real_dating INTEGER NOT NULL DEFAULT 1,
  companion_provider INTEGER NOT NULL DEFAULT 0,
  incognito INTEGER NOT NULL DEFAULT 0,
  photo_path TEXT,
  traits TEXT NOT NULL DEFAULT '{}',            -- resultado del test psicológico
  hue INTEGER NOT NULL DEFAULT 40
);

CREATE TABLE IF NOT EXISTS verifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,                            -- identity | photo | psychological | medical | insurance
  status TEXT NOT NULL DEFAULT 'pending',        -- pending | approved | rejected
  data TEXT NOT NULL DEFAULT '{}',
  file_path TEXT,
  notes TEXT,
  reviewer_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_verif_user ON verifications(user_id, type);

CREATE TABLE IF NOT EXISTS insurance_policies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  partner_id INTEGER REFERENCES partners(id),
  plan TEXT NOT NULL,
  coverage INTEGER NOT NULL,
  premium INTEGER NOT NULL,
  beneficiary TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  started_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS partners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT '',
  benefit TEXT NOT NULL,
  discount REAL NOT NULL DEFAULT 0,
  commission REAL NOT NULL DEFAULT 0.2,          -- comisión que TWO LOVE cobra al aliado
  min_tier TEXT NOT NULL DEFAULT 'essential',
  contact TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'activo'
);

CREATE TABLE IF NOT EXISTS lounges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  kind TEXT NOT NULL,
  description TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 2,
  price_hour INTEGER NOT NULL,
  min_tier TEXT NOT NULL DEFAULT 'platinum',
  partner_id INTEGER REFERENCES partners(id),
  amenities TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS companion_offers (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  headline TEXT NOT NULL,
  activities TEXT NOT NULL DEFAULT '',
  rate_hour INTEGER, rate_day INTEGER, rate_week INTEGER, rate_month INTEGER, rate_year INTEGER,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,                            -- companion | lounge
  client_id INTEGER NOT NULL REFERENCES users(id),
  provider_id INTEGER REFERENCES users(id),      -- acompañante (companion) o invitado/a (lounge)
  lounge_id INTEGER REFERENCES lounges(id),
  unit TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  start_at TEXT NOT NULL,
  activity TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  subtotal INTEGER NOT NULL,
  service_fee INTEGER NOT NULL DEFAULT 0,
  vat INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL,
  provider_commission INTEGER NOT NULL DEFAULT 0,
  provider_payout INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'requested',      -- requested | accepted | completed | declined | cancelled | disputed
  safety_checkin_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS likes (
  from_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                            -- like | super | pass
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (from_id, to_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_msg_pair ON messages(from_id, to_id);

CREATE TABLE IF NOT EXISTS gifts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,                        -- virtual | flores | joyeria | experiencia | lujo
  emoji TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price INTEGER NOT NULL,
  cost INTEGER NOT NULL DEFAULT 0,               -- coste para TWO LOVE (pago al aliado)
  partner_id INTEGER REFERENCES partners(id),
  stock INTEGER,                                 -- NULL = ilimitado (virtual)
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS gift_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gift_id INTEGER NOT NULL REFERENCES gifts(id),
  sender_id INTEGER NOT NULL REFERENCES users(id),
  recipient_id INTEGER NOT NULL REFERENCES users(id),
  message TEXT NOT NULL DEFAULT '',
  price INTEGER NOT NULL,
  discount INTEGER NOT NULL DEFAULT 0,
  vat INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL,
  cost INTEGER NOT NULL DEFAULT 0,
  recipient_credit INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pagado',         -- pagado | preparando | entregado
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS wallets (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0,
  held INTEGER NOT NULL DEFAULT 0                -- fondos en custodia (escrow)
);

CREATE TABLE IF NOT EXISTS wallet_tx (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount INTEGER NOT NULL,                       -- con signo
  balance_after INTEGER NOT NULL,
  ref TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tx_user ON wallet_tx(user_id);

-- Libro de ingresos de la plataforma (ERP)
CREATE TABLE IF NOT EXISTS revenue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stream TEXT NOT NULL,                          -- suscripcion | regalo | comision_reserva | tarifa_servicio | sala | seguro | aliado
  amount INTEGER NOT NULL,
  vat INTEGER NOT NULL DEFAULT 0,
  user_id INTEGER REFERENCES users(id),
  ref TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Cuentas por pagar (aliados y acompañantes)
CREATE TABLE IF NOT EXISTS payables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  party TEXT NOT NULL,                           -- partner | provider
  partner_id INTEGER REFERENCES partners(id),
  user_id INTEGER REFERENCES users(id),
  amount INTEGER NOT NULL,
  ref TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pendiente',      -- pendiente | pagado
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL,
  period TEXT NOT NULL,                          -- monthly | yearly
  price INTEGER NOT NULL,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS ratings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER REFERENCES bookings(id),
  rater_id INTEGER NOT NULL REFERENCES users(id),
  ratee_id INTEGER NOT NULL REFERENCES users(id),
  stars INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  tags TEXT NOT NULL DEFAULT '',
  comment TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (booking_id, rater_id)
);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_id INTEGER NOT NULL REFERENCES users(id),
  reported_id INTEGER NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'abierto',        -- abierto | resuelto
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS blocks (
  blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (blocker_id, blocked_id)
);

CREATE TABLE IF NOT EXISTS crm_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL DEFAULT 'nota',             -- nota | llamada | concierge | incidencia
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS concierge_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'nuevo',          -- nuevo | en_curso | resuelto
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                            -- match | mensaje | reserva | regalo | verificacion | evento | referido | sistema
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  href TEXT NOT NULL DEFAULT '',
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read_at);

-- Eventos privados TWO LOVE (networking y citas en grupo)
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  city TEXT NOT NULL,
  venue TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  description TEXT NOT NULL,
  capacity INTEGER NOT NULL,
  price INTEGER NOT NULL,                        -- fils, sin IVA
  min_tier TEXT NOT NULL DEFAULT 'essential',
  partner_id INTEGER REFERENCES partners(id),
  emoji TEXT NOT NULL DEFAULT '✨',
  status TEXT NOT NULL DEFAULT 'publicado'       -- publicado | cancelado
);

CREATE TABLE IF NOT EXISTS event_tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  price INTEGER NOT NULL,
  vat INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmada',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (event_id, user_id)
);

-- Pagos con pasarela externa (idempotencia de webhooks)
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  provider TEXT NOT NULL,
  external_id TEXT NOT NULL UNIQUE,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendiente',      -- pendiente | pagado | fallido
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── TWO LOVE Park: parque de citas físico (importes en CLP) ──────────────────
CREATE TABLE IF NOT EXISTS park_venues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'Chile',
  size_m2 INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'abierto',        -- abierto | proximamente
  opens_on TEXT,                                 -- fecha de apertura (inicio del piloto)
  address TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS park_couples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_a INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b INTEGER REFERENCES users(id) ON DELETE SET NULL,
  partner_name TEXT NOT NULL DEFAULT '',
  since TEXT NOT NULL,                           -- fecha de inicio del pololeo (YYYY-MM-DD)
  code TEXT NOT NULL UNIQUE,                     -- código para que la pareja se una
  status TEXT NOT NULL DEFAULT 'activa',         -- activa | finalizada
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS park_bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  venue_id INTEGER NOT NULL REFERENCES park_venues(id),
  product TEXT NOT NULL,
  slot_at TEXT NOT NULL,                         -- inicio (hora local del local)
  partner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  partner_name TEXT NOT NULL DEFAULT '',
  destination TEXT,
  minor INTEGER NOT NULL DEFAULT 0,              -- reserva de tutor para pareja de 14 a 17 años
  minor_names TEXT NOT NULL DEFAULT '',
  photo_consent INTEGER NOT NULL DEFAULT 0,
  price INTEGER NOT NULL,                        -- CLP con IVA, antes de descuento
  discount INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL,
  deposit INTEGER NOT NULL,
  paid INTEGER NOT NULL DEFAULT 0,               -- CLP cobrados (billetera o local)
  status TEXT NOT NULL DEFAULT 'reservada',      -- reservada | en_curso | completada | cancelada | no_show
  qr TEXT NOT NULL UNIQUE,
  album TEXT UNIQUE,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  checked_in_at TEXT,
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_park_bookings_slot ON park_bookings(venue_id, slot_at);

CREATE TABLE IF NOT EXISTS park_stamps (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stamp TEXT NOT NULL,
  booking_id INTEGER REFERENCES park_bookings(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, stamp)
);

CREATE TABLE IF NOT EXISTS park_club (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  since TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'activa'          -- activa | cancelada (sin renovación)
);

CREATE TABLE IF NOT EXISTS park_reminders (
  couple_id INTEGER NOT NULL REFERENCES park_couples(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  PRIMARY KEY (couple_id, key)
);

CREATE TABLE IF NOT EXISTS park_machines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  venue_id INTEGER NOT NULL REFERENCES park_venues(id),
  kind TEXT NOT NULL DEFAULT 'maquina',          -- maquina | cabina
  name TEXT NOT NULL,
  units INTEGER NOT NULL,
  investment INTEGER NOT NULL,                   -- CLP
  payback_months REAL NOT NULL                   -- meses de recuperación del plan
);

-- Caja del local: ventas sin reserva (café, máquinas, cabinas, talleres, alianzas) y parejas atendidas
CREATE TABLE IF NOT EXISTS park_sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  venue_id INTEGER NOT NULL REFERENCES park_venues(id),
  stream TEXT NOT NULL,
  machine_id INTEGER REFERENCES park_machines(id),
  amount INTEGER NOT NULL,                       -- CLP con IVA
  couples INTEGER NOT NULL DEFAULT 0,            -- parejas sin reserva atendidas
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS park_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER NOT NULL REFERENCES park_bookings(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

/** Migraciones aditivas para bases de datos creadas con versiones anteriores. */
function migrate(conn: DatabaseSync) {
  const cols = (table: string) => (conn.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);
  const users = cols("users");
  if (!users.includes("referral_code")) {
    conn.exec("ALTER TABLE users ADD COLUMN referral_code TEXT");
    conn.exec("UPDATE users SET referral_code = 'TL' || upper(hex(randomblob(3))) WHERE referral_code IS NULL");
  }
  if (!users.includes("referred_by")) conn.exec("ALTER TABLE users ADD COLUMN referred_by INTEGER REFERENCES users(id)");
  conn.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_ref ON users(referral_code)");
}

type Globals = { __twolove_db?: DatabaseSync };
const g = globalThis as Globals;

export function db(): DatabaseSync {
  if (g.__twolove_db) return g.__twolove_db;
  const file = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "twolove.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const conn = new DatabaseSync(file);
  conn.exec(SCHEMA);
  migrate(conn);
  const count = conn.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
  if (count.n === 0) {
    tx(conn, () => seed(conn));
  } else if ((conn.prepare("SELECT COUNT(*) AS n FROM park_venues").get() as { n: number }).n === 0) {
    // Bases creadas antes de TWO LOVE Park: añade locales y máquinas (sin historial de demostración)
    tx(conn, () => seedParkReference(conn));
  }
  conn.exec("UPDATE users SET referral_code = 'TL' || upper(hex(randomblob(3))) WHERE referral_code IS NULL");
  g.__twolove_db = conn;
  return conn;
}

export function tx<T>(conn: DatabaseSync, fn: () => T): T {
  conn.exec("BEGIN IMMEDIATE");
  try {
    const out = fn();
    conn.exec("COMMIT");
    return out;
  } catch (e) {
    conn.exec("ROLLBACK");
    throw e;
  }
}

export function transaction<T>(fn: (conn: DatabaseSync) => T): T {
  const conn = db();
  return tx(conn, () => fn(conn));
}

// Utilidades de consulta tipadas
type Param = string | number | bigint | null | Uint8Array;
export function one<T>(sql: string, ...params: Param[]): T | undefined {
  return db().prepare(sql).get(...params) as T | undefined;
}
export function all<T>(sql: string, ...params: Param[]): T[] {
  return db().prepare(sql).all(...params) as T[];
}
export function run(sql: string, ...params: Param[]) {
  const r = db().prepare(sql).run(...params);
  return { changes: Number(r.changes), id: Number(r.lastInsertRowid) };
}
