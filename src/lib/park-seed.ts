import "server-only";
import type { DatabaseSync } from "node:sqlite";
import crypto from "node:crypto";
import { BASE_CASE, clpToFils, PARK_PRODUCTS, productById, splitVat } from "./park-catalog";
import { recordRevenue } from "./ledger";

const token = (n = 12) => crypto.randomBytes(n).toString("base64url");

// Máquinas y cabinas del local piloto (inversión en CLP y meses de recuperación del plan)
const MACHINES: [string, "maquina" | "cabina", number, number, number][] = [
  ["Grúa de peluches", "maquina", 2, 3_200_000, 8.0],
  ["Cápsulas", "maquina", 2, 1_200_000, 4.4],
  ["Comidas virales", "maquina", 1, 5_500_000, 9.1],
  ["Helados automáticos", "maquina", 1, 6_000_000, 10.9],
  ["Batidos y smoothies", "maquina", 1, 10_500_000, 17.4],
  ["Bebidas virales", "maquina", 1, 7_500_000, 14.4],
  ["Buzón del amor", "maquina", 1, 2_200_000, 11.3],
  ["Cabina de 4 fotos", "cabina", 1, 6_000_000, 5.0],
  ["Purikura", "cabina", 1, 5_000_000, 4.6],
];

/** Locales y máquinas (datos de referencia). Devuelve el id del local piloto. */
export function seedParkReference(conn: DatabaseSync, opensOn = new Date().toISOString().slice(0, 10)) {
  const v = conn.prepare("INSERT INTO park_venues (name, city, country, size_m2, status, opens_on, address) VALUES (?, ?, ?, ?, ?, ?, ?)");
  const pilot = Number(v.run("TWO LOVE Park · Piloto", "Santiago", "Chile", 100, "abierto", opensOn, "Providencia, Santiago").lastInsertRowid);
  v.run("TWO LOVE Park · Insignia", "Santiago", "Chile", 250, "proximamente", "2028-07-01", "");
  v.run("TWO LOVE Park · Regional", "Por definir", "Chile", 150, "proximamente", "2029-07-01", "");
  const m = conn.prepare("INSERT INTO park_machines (venue_id, kind, name, units, investment, payback_months) VALUES (?, ?, ?, ?, ?, ?)");
  MACHINES.forEach((x) => m.run(pilot, x[1], x[0], x[2], x[3], x[4]));
  return pilot;
}

/** Historial de demostración: 5 meses de piloto, reservas, caja, club, parejas y pasaportes. */
export function seedParkDemo(conn: DatabaseSync, o: { r: () => number; demoId: number; partnerId: number | null; ids: number[] }) {
  const { r, demoId, partnerId, ids } = o;
  const day = (d: number, h = 12, min = 0) => {
    const dt = new Date(Date.now() - d * 86_400_000);
    dt.setUTCHours(h, min, 0, 0);
    return dt.toISOString().replace("T", " ").slice(0, 19);
  };
  const MONTHS = 5;
  const pilot = seedParkReference(conn, day(MONTHS * 30).slice(0, 10));
  const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)];
  const rev = (stream: string, gross: number, userId: number | null, ref: string, at: string) => {
    const { net, vat } = splitVat(gross);
    recordRevenue(conn, stream, clpToFils(net), clpToFils(vat), userId, ref, at);
  };

  // Caja mensual del local: arranque progresivo hacia el caso base (1.400 parejas/mes)
  const ramp = [0.37, 0.5, 0.6, 0.66, 0.7];
  const sale = conn.prepare("INSERT INTO park_sales (venue_id, stream, machine_id, amount, couples, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
  const machines = conn.prepare("SELECT id, kind, investment, payback_months FROM park_machines WHERE venue_id = ?").all(pilot) as { id: number; kind: string; investment: number; payback_months: number }[];
  for (let m = 0; m < MONTHS; m++) {
    const f = ramp[m] * (0.95 + r() * 0.1);
    const at = day((MONTHS - m) * 30 - 29, 23);
    const gross = (stream: string, share = 1) => Math.round(BASE_CASE.revenue[stream] * f * share * 1.19);
    const walkIns = Math.round(BASE_CASE.couples * f * 0.9);
    const s = (stream: string, amount: number, couples = 0, machine: number | null = null, note = "") => {
      const id = Number(sale.run(pilot, stream, machine, amount, couples, note, at).lastInsertRowid);
      rev(stream, amount, null, `park_sale:${id}`, at);
    };
    s("park_cafe", gross("park_cafe"), walkIns, null, "Cierre de caja mensual");
    s("park_pase", gross("park_pase", 0.85));
    s("park_talleres", gross("park_talleres", 0.6));
    s("park_alianzas", gross("park_alianzas"), 0, null, "Co-marketing con marcas");
    // Máquinas y cabinas: el reparto sigue la inversión de cada una
    const byKind = (kind: string) => machines.filter((x) => x.kind === kind);
    for (const [kind, stream] of [["maquina", "park_maquinas"], ["cabina", "park_cabinas"]] as const) {
      const list = byKind(kind);
      const weight = list.reduce((a, x) => a + x.investment / x.payback_months, 0);
      for (const x of list) s(stream, Math.round((gross(stream) * (x.investment / x.payback_months)) / weight), 0, x.id);
    }
  }

  // Reservas de la app (historial y agenda)
  const users = ids.filter((id) => id !== demoId);
  const ins = conn.prepare(`INSERT INTO park_bookings (user_id, venue_id, product, slot_at, partner_id, partner_name, destination, minor, minor_names, photo_consent,
    price, discount, total, deposit, paid, status, qr, album, notes, created_at, checked_in_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const stamp = conn.prepare("INSERT OR IGNORE INTO park_stamps (user_id, stamp, booking_id, created_at) VALUES (?, ?, ?, ?)");
  const book = (userId: number, productId: string, slot: string, status: string, extra: { partnerId?: number | null; partnerName?: string; destination?: string; minor?: string; discount?: number } = {}) => {
    const p = productById(productId)!;
    const discount = extra.discount ?? 0;
    const total = p.price - discount;
    const deposit = Math.round(total * 0.3);
    const done = status === "completada";
    const paid = done ? total : status === "reservada" ? deposit : status === "no_show" ? deposit : 0;
    // Las reservas futuras se hicieron ayer; las pasadas, el mismo día de la cita
    const created = slot > day(0, 23) ? day(1, 10) : slot.slice(0, 10) + " 09:00:00";
    const id = Number(ins.run(userId, pilot, p.id, slot, extra.partnerId ?? null, extra.partnerName ?? "", extra.destination ?? null, extra.minor ? 1 : 0, extra.minor ?? "",
      extra.minor ? 0 : 1, p.price, discount, total, deposit, paid, status, "TLP-" + token(9), done ? token(18) : null, "", created, done ? slot : null, done ? slot : null).lastInsertRowid);
    if (paid) rev(p.stream, paid, userId, `park:${id}`, done ? slot : created);
    if (done) for (const st of p.stamps) {
      stamp.run(userId, st, id, slot);
      if (extra.partnerId) stamp.run(extra.partnerId, st, id, slot);
    }
    return id;
  };
  const statuses = ["completada", "completada", "completada", "completada", "completada", "completada", "cancelada", "no_show"];
  for (let d = MONTHS * 30 - 5; d > 0; d -= 1) {
    const n = Math.floor(r() * 5 * (1 - d / (MONTHS * 30 * 1.6)));
    for (let k = 0; k < n; k++) {
      const p = r() < 0.72 ? pick(PARK_PRODUCTS.filter((x) => x.kind === "cita")) : r() < 0.6 ? pick(PARK_PRODUCTS.filter((x) => x.kind === "paquete" && x.id !== "pedida")) : pick(PARK_PRODUCTS.filter((x) => x.kind === "taller"));
      book(pick(users), p.id, day(d, 12 + Math.floor(r() * 9)), pick(statuses), { partnerName: pick(["Camila", "Diego", "Valentina", "Matías", "Sofía", "Benjamín"]), destination: p.id === "viaje" ? pick(["París", "Seúl", "Tokio"]) : undefined });
    }
  }
  // Agenda de hoy y próximos días
  const today = [[13, "clasica"], [15, "completa"], [16, "viaje"], [18, "anillos"], [19, "cumplemes"], [20, "aniversario"]] as const;
  today.forEach(([h, p], i) => book(users[(i * 3) % users.length], p, day(0, h), "reservada", { partnerName: pick(["Ignacia", "Joaquín", "Florencia", "Tomás"]), destination: p === "viaje" ? "Tokio" : undefined }));
  book(users[2], "clasica", day(-1, 15), "reservada", { minor: "Martina (16) y Agustín (17)" });
  book(users[6], "recrea", day(-2, 19), "reservada", { partnerName: "Antonia" });
  book(users[9], "pedida", day(-6, 20), "reservada", { partnerName: "Fernanda" });

  // Pareja del usuario demo: día 100 en 3 días (como en la maqueta de la app)
  const since = day(97).slice(0, 10);
  conn.prepare("INSERT INTO park_couples (user_a, user_b, partner_name, since, code, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(demoId, partnerId, "", since, "TLP-" + token(4).toUpperCase().replace(/[^A-Z0-9]/g, "X"), day(90));
  const both = { partnerId };
  book(demoId, "completa", day(62, 19), "completada", both);
  book(demoId, "viaje", day(34, 20), "completada", { ...both, destination: "Seúl" });
  book(demoId, "cumplemes", day(6, 20), "completada", { ...both, discount: 4_500 });
  book(demoId, "clasica", day(-((6 - new Date().getUTCDay() + 7) % 7 || 7), 20), "reservada", { ...both, discount: 2_290 });

  // Two Love Club: el demo y una docena de parejas
  const club = conn.prepare("INSERT OR IGNORE INTO park_club (user_id, since, expires_at) VALUES (?, ?, ?)");
  club.run(demoId, day(80), day(-10));
  for (const u of users.slice(0, 12)) {
    club.run(u, day(20 + Math.floor(r() * 100)), day(-Math.floor(1 + r() * 29)));
  }
  for (let m = 0; m < MONTHS; m++) rev("park_club", 7_900 * (4 + m * 2), null, "park_club_mensual", day((MONTHS - m) * 30 - 29, 23));
}
