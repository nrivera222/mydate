import { seedParkDemo } from "./park-seed";
import type { DatabaseSync } from "node:sqlite";
import bcrypt from "bcryptjs";
import { ARCHETYPES, CITIES, COMPANION_ACTIVITIES, INSURANCE_PLANS, INTERESTS, LANGUAGES, TIERS, TRAITS, VAT_RATE, PROVIDER_COMMISSION } from "./catalog";
import { post, quoteCompanion, recordPayable, recordRevenue } from "./ledger";

// Generador pseudoaleatorio determinista para datos de demostración reproducibles.
function rng(seedValue: number) {
  let s = seedValue;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const PARTNERS = [
  ["Maison Lumière Joaillerie", "joyeria", "Dubái", "Grabado gratuito y entrega en mano", 0.1, 0.25, "gold"],
  ["Rosée Royale Flowers", "flores", "Dubái", "Entrega express en 90 minutos", 0.15, 0.3, "essential"],
  ["Azure Marina Yachts", "yates", "Dubái", "Upgrade de yate sujeto a disponibilidad", 0.1, 0.18, "diamond"],
  ["Desert Pearl Resorts", "hotel", "Dubái", "Late check-out y cena de bienvenida", 0.12, 0.2, "platinum"],
  ["SkyCrown Private Aviation", "aviacion", "Dubái", "Posicionamiento de jet sin coste en GCC", 0.05, 0.1, "royal"],
  ["Atelier Nour Couture", "moda", "Abu Dabi", "Personal shopper privado", 0.15, 0.25, "gold"],
  ["Velvet Supercars", "automocion", "Dubái", "Chófer incluido en alquileres de 1 día", 0.1, 0.2, "platinum"],
  ["Serenity Wellness Clinic", "clinica", "Dubái", "Certificado médico TWO LOVE en 24 h", 0.2, 0.15, "essential"],
  ["Mindful Bond Psychology", "psicologia", "Dubái", "Evaluación psicológica certificada", 0.2, 0.15, "essential"],
  ["Gulf Heritage Life Insurance", "seguros", "Dubái", "Póliza de vida TWO LOVE con alta inmediata", 0, 0.12, "essential"],
  ["Le Jardin Secret Dining", "restaurante", "Mónaco", "Mesa del chef garantizada", 0.1, 0.2, "platinum"],
  ["Chronos Haute Horlogerie", "relojeria", "Ginebra", "Acceso a piezas de edición limitada", 0.05, 0.12, "diamond"],
] as const;

const LOUNGES = [
  ["TWO LOVE Sky Lounge", "Dubái", "EAU", "rooftop", "Terraza privada en el piso 72 con vistas al Burj Khalifa, sommelier y DJ acústico.", 2, 1_500_00, "platinum", 4, "Vista panorámica, Sommelier, Música en vivo"],
  ["TWO LOVE Marina Yacht", "Dubái", "EAU", "yate", "Yate de 32 m para cenas al atardecer por Dubai Marina y Palm Jumeirah.", 8, 6_500_00, "diamond", 3, "Tripulación, Chef a bordo, Jacuzzi"],
  ["TWO LOVE Desert Majlis", "Dubái", "EAU", "desierto", "Majlis privado bajo las estrellas con halconería y cocina emiratí.", 6, 3_200_00, "diamond", 4, "Halconería, Astronomía, Cocina local"],
  ["TWO LOVE Private Dining", "Abu Dabi", "EAU", "cena_privada", "Comedor privado en Saadiyat con menú degustación de 9 pasos.", 2, 1_200_00, "platinum", 11, "Menú degustación, Maridaje, Discreción"],
  ["TWO LOVE Pearl Suite", "Doha", "Catar", "suite", "Suite de encuentros en The Pearl con salón, terraza y mayordomo.", 4, 2_000_00, "diamond", 4, "Mayordomo, Terraza, Transporte"],
  ["TWO LOVE Café Privé", "Dubái", "EAU", "cafe", "Salón íntimo para primeras citas en DIFC, ideal para conocerse.", 2, 350_00, "gold", null, "Café de especialidad, Ambiente tranquilo"],
  ["TWO LOVE Riviera Terrace", "Mónaco", "Mónaco", "rooftop", "Terraza sobre el puerto Hercule con vistas al circuito.", 4, 2_800_00, "diamond", 11, "Vista al puerto, Champagne bar"],
  ["TWO LOVE Mayfair Club", "Londres", "Reino Unido", "club", "Club privado en Mayfair con biblioteca y bar de whisky.", 6, 1_800_00, "platinum", null, "Biblioteca, Whisky bar, Chimenea"],
  ["TWO LOVE Royal Palace Wing", "Riad", "Arabia Saudí", "palacio", "Ala privada de palacio para encuentros familiares y compromisos.", 20, 12_000_00, "royal", null, "Protocolo, Seguridad privada, Catering real"],
  ["TWO LOVE Spa Duo", "Dubái", "EAU", "spa", "Circuito de spa privado para dos con hammam y tratamientos.", 2, 1_100_00, "platinum", 8, "Hammam, Masajes, Zona de descanso"],
] as const;

const GIFTS = [
  ["Rosa digital", "virtual", "🌹", "Un detalle instantáneo que aparece en su perfil.", 5_00, 0, null, null],
  ["Corazón dorado", "virtual", "💛", "Destaca tu interés con un corazón animado.", 15_00, 0, null, null],
  ["Copa de champagne", "virtual", "🥂", "Brindis virtual para celebrar un match.", 25_00, 0, null, null],
  ["Diamante TWO LOVE", "virtual", "💎", "El regalo virtual más exclusivo. Aparece destacado 7 días.", 250_00, 0, null, null],
  ["Corona Royal", "virtual", "👑", "Solo para quien realmente importa.", 1_000_00, 0, null, null],
  ["Ramo de 50 rosas rojas", "flores", "💐", "Rosas de Ecuador entregadas en su puerta.", 650_00, 420_00, 2, 40],
  ["Orquídeas blancas en caja de terciopelo", "flores", "🌸", "Composición de autor con tarjeta caligrafiada.", 480_00, 300_00, 2, 30],
  ["Caja de dátiles premium y oud", "experiencia", "🎁", "Selección de dátiles Medjool y perfume oud artesanal.", 900_00, 560_00, 6, 25],
  ["Colgante de diamante 0,5 ct", "joyeria", "💍", "Oro blanco 18k, certificado GIA.", 12_500_00, 8_900_00, 1, 8],
  ["Pulsera Maison Lumière", "joyeria", "📿", "Oro rosa con grabado personalizado.", 6_800_00, 4_800_00, 1, 12],
  ["Cena en yate para dos", "experiencia", "🛥️", "3 horas de atardecer en Dubai Marina con chef.", 8_500_00, 6_300_00, 3, 10],
  ["Noche en suite del desierto", "experiencia", "🏜️", "Suite con piscina privada y cena bajo las estrellas.", 5_400_00, 3_900_00, 4, 15],
  ["Día en superdeportivo con chófer", "lujo", "🏎️", "Lamborghini Huracán por un día.", 4_200_00, 3_000_00, 7, 6],
  ["Reloj de edición limitada", "lujo", "⌚", "Pieza numerada de Chronos Haute Horlogerie.", 45_000_00, 36_000_00, 12, 3],
  ["Vuelo privado a las Maldivas", "lujo", "✈️", "Jet privado ida y vuelta para dos personas.", 120_000_00, 98_000_00, 5, 2],
  ["Sesión de personal shopper", "experiencia", "👗", "3 horas de estilismo privado en Atelier Nour.", 2_500_00, 1_700_00, 6, 20],
] as const;

const PEOPLE: [string, "mujer" | "hombre" | "no_binario", string][] = [
  ["Layla Al Mansouri", "mujer", "Emiratí"], ["Omar Haddad", "hombre", "Libanés"], ["Sofía Castellanos", "mujer", "Española"],
  ["Alexander Volkov", "hombre", "Ruso"], ["Amira Farouk", "mujer", "Egipcia"], ["James Whitmore", "hombre", "Británico"],
  ["Isabella Rossi", "mujer", "Italiana"], ["Khalid Al Suwaidi", "hombre", "Emiratí"], ["Valentina Mendoza", "mujer", "Mexicana"],
  ["Rafael Duarte", "hombre", "Brasileño"], ["Noor Qureshi", "mujer", "Pakistaní"], ["Henri Delacroix", "hombre", "Francés"],
  ["Mei Lin Zhang", "mujer", "Singapurense"], ["Tariq Bin Saeed", "hombre", "Saudí"], ["Charlotte Beaumont", "mujer", "Monegasca"],
  ["Diego Alarcón", "hombre", "Colombiano"], ["Yasmin Nasser", "mujer", "Jordana"], ["Luca Moretti", "hombre", "Italiano"],
  ["Aisha Rahman", "mujer", "Catarí"], ["Maximilian Weber", "hombre", "Alemán"], ["Camila Ortega", "mujer", "Argentina"],
  ["Andrés Villanueva", "hombre", "Español"], ["Sasha Ivanova", "mujer", "Ucraniana"], ["Karim Benali", "hombre", "Marroquí"],
  ["Riley Morgan", "no_binario", "Estadounidense"], ["Elena Petrova", "mujer", "Búlgara"], ["Zayed Al Hashimi", "hombre", "Emiratí"],
  ["Gabriela Santos", "mujer", "Portuguesa"],
];

const OCCUPATIONS: Record<string, string[]> = {
  empresario: ["Fundadora de cadena hotelera", "CEO de empresa logística", "Dueño de grupo inmobiliario"],
  heredero: ["Family office", "Consejera de holding familiar", "Heredero de grupo naviero"],
  ejecutivo: ["Managing Director en banca", "COO multinacional", "Directora de estrategia"],
  inversor: ["Socio de fondo de private equity", "Business angel", "Inversora inmobiliaria"],
  diplomatico: ["Agregado cultural", "Consejera en Naciones Unidas", "Cónsul honorario"],
  medico: ["Cirujana plástica", "Abogado corporativo", "Arquitecta de lujo"],
  creativo: ["Diseñadora de alta joyería", "Director de arte", "Galerista"],
  atleta: ["Jugador de polo", "Tenista profesional", "Piloto de rally"],
  influencer: ["Presentadora de TV", "Creador de contenido de viajes", "Modelo internacional"],
  nomada: ["Consultor independiente", "Fotógrafa de viajes", "Emprendedor digital"],
};

export function seed(conn: DatabaseSync) {
  const r = rng(20260925);
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(r() * arr.length)];
  const pickN = <T,>(arr: readonly T[], n: number) => {
    const copy = [...arr];
    const out: T[] = [];
    while (out.length < n && copy.length) out.push(copy.splice(Math.floor(r() * copy.length), 1)[0]);
    return out;
  };
  const daysAgo = (d: number, h = 12) => {
    const dt = new Date(Date.now() - d * 86_400_000);
    dt.setUTCHours(h, Math.floor(r() * 60), 0, 0);
    return dt.toISOString().replace("T", " ").slice(0, 19);
  };

  const hash = bcrypt.hashSync("twolove2026", 10);

  // Aliados
  const partnerIns = conn.prepare("INSERT INTO partners (name, category, city, benefit, discount, commission, min_tier, contact) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  PARTNERS.forEach((p) => partnerIns.run(p[0], p[1], p[2], p[3], p[4], p[5], p[6], `alianzas+${p[1]}@twolove.app`));

  // Salas
  const loungeIns = conn.prepare("INSERT INTO lounges (name, city, country, kind, description, capacity, price_hour, min_tier, partner_id, amenities) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  LOUNGES.forEach((l) => loungeIns.run(l[0], l[1], l[2], l[3], l[4], l[5], l[6], l[7], l[8], l[9]));

  // Regalos
  const giftIns = conn.prepare("INSERT INTO gifts (name, category, emoji, description, price, cost, partner_id, stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  GIFTS.forEach((g) => giftIns.run(g[0], g[1], g[2], g[3], g[4], g[5], g[6], g[7]));

  const userIns = conn.prepare("INSERT INTO users (email, password_hash, name, role, tier, tier_expires_at, source, created_at, last_active_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
  const profIns = conn.prepare(`INSERT INTO profiles (user_id, gender, seeking, birth_year, city, country, nationality, languages, archetype, occupation, net_worth, intent, interests, bio, age_min, age_max, real_dating, companion_provider, traits, hue)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const verIns = conn.prepare("INSERT INTO verifications (user_id, type, status, data, reviewer_id, created_at, reviewed_at) VALUES (?, ?, 'approved', ?, 1, ?, ?)");
  const polIns = conn.prepare("INSERT INTO insurance_policies (user_id, partner_id, plan, coverage, premium, beneficiary, started_at) VALUES (?, 10, ?, ?, ?, ?, ?)");

  // Administración
  userIns.run("admin@twolove.app", hash, "Equipo TWO LOVE", "admin", "royal", null, "interno", daysAgo(200), daysAgo(0));
  conn.prepare("INSERT INTO profiles (user_id, city, country, bio) VALUES (1, 'Dubái', 'EAU', 'Cuenta de administración')").run();

  const sources = ["organico", "instagram", "referido", "evento_privado", "alianza", "google"];
  const allTraits = () => Object.fromEntries(TRAITS.map((t) => [t, Math.round((0.25 + r() * 0.7) * 100) / 100]));
  const verifyAll = (uid: number, when: string, plan: (typeof INSURANCE_PLANS)[number]) => {
    verIns.run(uid, "identity", JSON.stringify({ document: "Pasaporte", country: "—" }), when, when);
    verIns.run(uid, "photo", "{}", when, when);
    verIns.run(uid, "psychological", JSON.stringify({ professional: "Mindful Bond Psychology" }), when, when);
    verIns.run(uid, "medical", JSON.stringify({ clinic: "Serenity Wellness Clinic" }), when, when);
    verIns.run(uid, "insurance", JSON.stringify({ plan: plan.id }), when, when);
    polIns.run(uid, plan.id, plan.coverage, plan.premium, "Familiar directo", when);
  };

  const ids: number[] = [];
  const tierWeights: string[] = ["essential", "essential", "gold", "gold", "platinum", "platinum", "diamond", "royal"];

  // Usuario de demostración
  const demoCreated = daysAgo(90);
  userIns.run("demo@twolove.app", hash, "Nadia Rivera", "user", "platinum", daysAgo(-25), "referido", demoCreated, daysAgo(0));
  const demoId = 2;
  profIns.run(demoId, "mujer", "hombre", 1990, "Dubái", "EAU", "Española", "Español,Inglés,Árabe", "empresario", "Fundadora de marca de lujo sostenible", "5m", "matrimonio",
    "Arte contemporáneo,Viajes de lujo,Yates,Alta cocina,Filantropía,Desierto y dunas", "Emprendedora entre Dubái y Madrid. Busco a alguien con ambición, valores familiares y ganas de descubrir el mundo conmigo.", 32, 50, 1, 0,
    JSON.stringify({ extraversion: 0.7, amabilidad: 0.8, responsabilidad: 0.85, estabilidad: 0.7, apertura: 0.9 }), 330);
  verifyAll(demoId, daysAgo(88), INSURANCE_PLANS[1]);
  post(conn, demoId, "recarga", 60_000_00, "Recarga con tarjeta", "seed", daysAgo(89));
  ids.push(demoId);

  PEOPLE.forEach(([name, gender, nationality], i) => {
    const arche = ARCHETYPES[i % ARCHETYPES.length].id;
    const loc = i < 10 ? CITIES[i % 4] : pick(CITIES);
    const tier = pick(tierWeights);
    const created = daysAgo(10 + Math.floor(r() * 170));
    const email = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]+/g, ".") + "@demo.twolove.app";
    const id = Number(userIns.run(email, hash, name, "user", tier, tier === "essential" ? null : daysAgo(-20), pick(sources), created, daysAgo(Math.floor(r() * 6))).lastInsertRowid);
    const seeking = gender === "mujer" ? "hombre" : gender === "hombre" ? (i % 9 === 0 ? "hombre" : "mujer") : "mujer,hombre,no_binario";
    const provider = i % 3 === 1 || i % 7 === 0 ? 1 : 0;
    profIns.run(
      id, gender, seeking, 1978 + Math.floor(r() * 22), loc.city, loc.country, nationality,
      pickN(LANGUAGES, 2 + Math.floor(r() * 2)).concat("Inglés").filter((v, k, a) => a.indexOf(v) === k).join(","),
      arche, pick(OCCUPATIONS[arche]), pick(["na", "1m", "5m", "30m", "100m"]), pick(["matrimonio", "noviazgo", "conocer"]),
      pickN(INTERESTS, 5 + Math.floor(r() * 3)).join(","),
      provider
        ? "Anfitrión/a con experiencia en eventos internacionales. Hablo varios idiomas y me adapto a cualquier protocolo."
        : "Vivo entre grandes ciudades, valoro la discreción, la lealtad y las buenas conversaciones. Busco algo real.",
      25, 55, provider && i % 2 ? 0 : 1, provider, JSON.stringify(allTraits()), Math.floor(r() * 360),
    );
    verifyAll(id, created, pick(INSURANCE_PLANS));
    if (provider) {
      const base = (300 + Math.floor(r() * 900)) * 100;
      conn
        .prepare("INSERT INTO companion_offers (user_id, headline, activities, rate_hour, rate_day, rate_week, rate_month, rate_year) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .run(id, pick(["Acompañante de gala políglota", "Tu +1 perfecto para eventos corporativos", "Anfitrión/a cultural y de negocios", "Compañía elegante para viajes y bodas"]),
          pickN(COMPANION_ACTIVITIES, 4).join(","), base, base * 7, base * 40, base * 140, base * 1400);
    }
    ids.push(id);
  });

  // Usuario pendiente de verificación (cola del panel de administración)
  const pendingId = Number(userIns.run("nuevo@demo.twolove.app", hash, "Marco Bellini", "user", "essential", null, "instagram", daysAgo(1), daysAgo(0)).lastInsertRowid);
  profIns.run(pendingId, "hombre", "mujer", 1987, "Milán", "Italia", "Italiano", "Italiano,Inglés", "creativo", "Diseñador industrial", "1m", "noviazgo", "Arquitectura,Moda,Fórmula 1,Vinos y sommelier,Esquí", "Recién llegado a TWO LOVE.", 28, 42, 1, 0, JSON.stringify(allTraits()), 200);
  for (const t of ["identity", "photo", "psychological"]) {
    conn.prepare("INSERT INTO verifications (user_id, type, status, data, created_at) VALUES (?, ?, 'pending', ?, ?)").run(pendingId, t, JSON.stringify({ nota: "Enviado desde onboarding" }), daysAgo(1));
  }

  // Suscripciones, billeteras e ingresos históricos
  for (const uid of [...ids, pendingId]) {
    const u = conn.prepare("SELECT tier, created_at FROM users WHERE id = ?").get(uid) as { tier: string; created_at: string };
    const tier = TIERS.find((t) => t.id === u.tier)!;
    const months = 1 + Math.floor(r() * 5);
    post(conn, uid, "recarga", tier.monthly * (months + 1) + (2_000 + Math.floor(r() * 40_000)) * 100, "Recarga con tarjeta", "seed", u.created_at);
    if (tier.monthly > 0) {
      for (let m = months; m >= 0; m--) {
        const at = daysAgo(m * 30 + 3);
        post(conn, uid, "suscripcion", -tier.monthly, `Membresía ${tier.name} mensual`, "seed", at);
        const vat = Math.round(tier.monthly - tier.monthly / (1 + VAT_RATE));
        recordRevenue(conn, "suscripcion", tier.monthly - vat, vat, uid, `sub:${tier.id}`, at);
        conn.prepare("INSERT INTO subscriptions (user_id, tier, period, price, started_at, expires_at, status) VALUES (?, ?, 'monthly', ?, ?, datetime(?, '+30 days'), ?)")
          .run(uid, tier.id, tier.monthly, at, at, m === 0 ? "active" : "expired");
      }
    }
    const plan = conn.prepare("SELECT premium FROM insurance_policies WHERE user_id = ?").get(uid) as { premium: number } | undefined;
    if (plan) recordRevenue(conn, "seguro", Math.round(plan.premium * 0.12), 0, uid, "comision_poliza", u.created_at);
  }

  // Likes y matches
  const likeIns = conn.prepare("INSERT OR IGNORE INTO likes (from_id, to_id, kind, created_at) VALUES (?, ?, ?, ?)");
  for (let k = 0; k < 140; k++) {
    const a = pick(ids), b = pick(ids);
    if (a !== b) likeIns.run(a, b, r() > 0.85 ? "super" : "like", daysAgo(Math.floor(r() * 40)));
  }
  // El usuario demo tiene matches garantizados con algunos hombres
  const men = conn.prepare("SELECT user_id FROM profiles WHERE gender = 'hombre' AND user_id > 2 LIMIT 5").all() as { user_id: number }[];
  men.forEach((m, k) => {
    likeIns.run(demoId, m.user_id, "like", daysAgo(5 + k));
    likeIns.run(m.user_id, demoId, k === 0 ? "super" : "like", daysAgo(4 + k));
  });
  const msgIns = conn.prepare("INSERT INTO messages (from_id, to_id, body, created_at) VALUES (?, ?, ?, ?)");
  if (men[0]) {
    msgIns.run(men[0].user_id, demoId, "Hola Nadia, vi que te encanta el arte contemporáneo. ¿Has ido a Art Dubai este año?", daysAgo(3, 18));
    msgIns.run(demoId, men[0].user_id, "¡Hola! Sí, fui el día de apertura. ¿Tú coleccionas?", daysAgo(3, 19));
    msgIns.run(men[0].user_id, demoId, "Algo, sobre todo artistas emergentes del Golfo. ¿Te apetece un café en el Café Privé de DIFC?", daysAgo(2, 20));
  }

  // Pedidos de regalos históricos
  const gifts = conn.prepare("SELECT id, price, cost, partner_id, category, name FROM gifts").all() as { id: number; price: number; cost: number; partner_id: number | null; category: string; name: string }[];
  const orderIns = conn.prepare("INSERT INTO gift_orders (gift_id, sender_id, recipient_id, message, price, vat, total, cost, recipient_credit, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  for (let k = 0; k < 90; k++) {
    const g = r() > 0.35 ? pick(gifts.slice(0, 7)) : pick(gifts);
    if (g.price > 20_000_00 && r() > 0.3) continue;
    const s = pick(ids), t = pick(ids);
    if (s === t) continue;
    const at = daysAgo(Math.floor(r() * 180));
    const vat = Math.round(g.price * VAT_RATE);
    const credit = g.category === "virtual" ? Math.round(g.price * 0.4) : 0;
    const res = orderIns.run(g.id, s, t, "Con cariño 💛", g.price, vat, g.price + vat, g.cost, credit, g.category === "virtual" ? "entregado" : pick(["pagado", "preparando", "entregado"]), at);
    const oid = Number(res.lastInsertRowid);
    const margin = g.category === "virtual" ? g.price - credit : g.price - g.cost;
    recordRevenue(conn, "regalo", margin, vat, s, `gift:${oid}`, at);
    if (g.partner_id) recordPayable(conn, "partner", { partnerId: g.partner_id }, g.cost, `gift:${oid}`, r() > 0.4 ? "pagado" : "pendiente", at);
  }

  // Reservas históricas de acompañamiento y salas
  const offers = conn.prepare("SELECT user_id, rate_hour, rate_day FROM companion_offers").all() as { user_id: number; rate_hour: number; rate_day: number }[];
  const bookIns = conn.prepare(`INSERT INTO bookings (kind, client_id, provider_id, lounge_id, unit, quantity, start_at, activity, subtotal, service_fee, vat, total, provider_commission, provider_payout, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const ratingIns = conn.prepare("INSERT OR IGNORE INTO ratings (booking_id, rater_id, ratee_id, stars, tags, comment, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
  for (let k = 0; k < 45; k++) {
    const o = pick(offers);
    const client = pick(ids);
    if (client === o.user_id) continue;
    const unit = r() > 0.25 ? "hour" : "day";
    const qty = unit === "hour" ? 2 + Math.floor(r() * 4) : 1 + Math.floor(r() * 3);
    const q = quoteCompanion(unit === "hour" ? o.rate_hour : o.rate_day, qty, 0.08, PROVIDER_COMMISSION, VAT_RATE);
    const at = daysAgo(3 + Math.floor(r() * 170));
    const status = k < 3 ? "requested" : r() > 0.1 ? "completed" : "cancelled";
    const bid = Number(bookIns.run("companion", client, o.user_id, null, unit, qty, at, pick(COMPANION_ACTIVITIES), q.subtotal, q.serviceFee, q.vat, q.total, q.commission, q.payout, status, at).lastInsertRowid);
    if (status === "completed") {
      recordRevenue(conn, "tarifa_servicio", q.serviceFee, q.vat, client, `booking:${bid}`, at);
      recordRevenue(conn, "comision_reserva", q.commission, 0, o.user_id, `booking:${bid}`, at);
      recordPayable(conn, "provider", { userId: o.user_id }, q.payout, `booking:${bid}`, "pagado", at);
      ratingIns.run(bid, client, o.user_id, r() > 0.2 ? 5 : 4, pickN(["Puntual", "Elegante", "Gran conversación", "Discreto/a", "Perfil fiel a la realidad"], 2).join(","), "Experiencia impecable, muy profesional.", at);
    }
  }
  const lounges = conn.prepare("SELECT id, price_hour FROM lounges").all() as { id: number; price_hour: number }[];
  for (let k = 0; k < 40; k++) {
    const l = pick(lounges);
    const a = pick(ids), b = pick(ids);
    if (a === b) continue;
    const hours = 2 + Math.floor(r() * 3);
    const at = daysAgo(Math.floor(r() * 175) - 5);
    const subtotal = l.price_hour * hours;
    const vat = Math.round(subtotal * VAT_RATE);
    const future = at > daysAgo(0);
    const bid = Number(bookIns.run("lounge", a, b, l.id, "hour", hours, at, "Cita en Sala TWO LOVE", subtotal, 0, vat, subtotal + vat, 0, 0, future ? "accepted" : "completed", at).lastInsertRowid);
    recordRevenue(conn, "sala", subtotal, vat, a, `booking:${bid}`, at);
  }

  // Ingresos por alianzas (fees de patrocinio y co-marketing)
  for (let m = 0; m < 6; m++) {
    recordRevenue(conn, "aliado", (15_000 + Math.floor(r() * 20_000)) * 100, 0, null, "patrocinio_mensual", daysAgo(m * 30 + 1));
  }

  // Denuncias y notas CRM de ejemplo
  conn.prepare("INSERT INTO reports (reporter_id, reported_id, reason, details, created_at) VALUES (?, ?, ?, ?, ?)").run(ids[3], ids[8], "Perfil falso", "Las fotos no coinciden con la videollamada.", daysAgo(2));
  conn.prepare("INSERT INTO crm_notes (user_id, author_id, kind, body, created_at) VALUES (?, 1, 'llamada', ?, ?)").run(demoId, "Llamada de bienvenida Platinum. Interesada en Salas de Dubái y viajes a Mónaco.", daysAgo(80));
  conn.prepare("INSERT INTO crm_notes (user_id, author_id, kind, body, created_at) VALUES (?, 1, 'concierge', ?, ?)").run(demoId, "Reservó flores para un match. Candidata a upgrade a Diamond.", daysAgo(12));
  conn.prepare("INSERT INTO concierge_requests (user_id, body, created_at) VALUES (?, ?, ?)").run(ids[5], "Necesito una mesa para dos en Mónaco durante el Grand Prix.", daysAgo(1));

  // Eventos privados (próximos y pasados) con entradas vendidas
  const evIns = conn.prepare("INSERT INTO events (title, city, venue, starts_at, description, capacity, price, min_tier, partner_id, emoji) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  const EVENTS: [string, string, string, number, string, number, number, string, number | null, string][] = [
    ["Sunset Singles en yate", "Dubái", "Dubai Marina · Azure Marina Yachts", -6, "Crucero al atardecer para 30 miembros verificados: champagne, DJ y juegos para romper el hielo.", 30, 750_00, "gold", 3, "🛥️"],
    ["Cena a ciegas bajo las estrellas", "Dubái", "TWO LOVE Desert Majlis", -12, "Mesas de 8 organizadas por nuestro algoritmo de compatibilidad. Menú emiratí de autor y halconería.", 24, 1_200_00, "platinum", 4, "🏜️"],
    ["Art Night: coleccionistas", "Abu Dabi", "Saadiyat Cultural District", -20, "Visita privada guiada y cóctel con galeristas. Ideal para amantes del arte contemporáneo.", 40, 450_00, "essential", null, "🎨"],
    ["Grand Prix Paddock Soirée", "Mónaco", "TWO LOVE Riviera Terrace", -45, "Fiesta privada con vistas al circuito durante el fin de semana del Grand Prix.", 60, 4_500_00, "diamond", 11, "🏎️"],
    ["Royal Black Gala", "Riad", "TWO LOVE Royal Palace Wing", -60, "Gala anual solo por invitación con matchmakers presentes y subasta benéfica.", 80, 0, "royal", null, "👑"],
    ["Brunch de bienvenida", "Dubái", "TWO LOVE Café Privé · DIFC", 14, "Encuentro mensual para nuevos miembros verificados.", 25, 250_00, "essential", null, "🥂"],
  ];
  const tkIns = conn.prepare("INSERT OR IGNORE INTO event_tickets (event_id, user_id, price, vat, created_at) VALUES (?, ?, ?, ?, ?)");
  EVENTS.forEach((e) => {
    const eid = Number(evIns.run(e[0], e[1], e[2], daysAgo(e[3], 19).slice(0, 14) + "30:00", e[4], e[5], e[6], e[7], e[8], e[9]).lastInsertRowid);
    const buyers = pickN(ids.slice(1), Math.min(e[5] - 3, 6 + Math.floor(r() * 10)));
    for (const b of buyers) {
      const at = daysAgo(Math.max(1, e[3] < 0 ? 3 : e[3] + 3));
      const vat = Math.round(e[6] * VAT_RATE);
      const res = tkIns.run(eid, b, e[6], vat, at);
      if (res.changes && e[6]) recordRevenue(conn, "evento", e[6], vat, b, `ticket:${res.lastInsertRowid}`, at);
    }
  });

  // Invitados por el usuario demo y notificaciones iniciales
  conn.prepare("UPDATE users SET referred_by = ?, source = 'referido' WHERE id IN (?, ?, ?)").run(demoId, ids[4], ids[9], ids[15]);
  const nIns = conn.prepare("INSERT INTO notifications (user_id, kind, title, body, href, created_at) VALUES (?, ?, ?, ?, ?, ?)");
  if (men[0]) nIns.run(demoId, "mensaje", "Nuevo mensaje", "¿Te apetece un café en el Café Privé de DIFC?", `/mensajes/${men[0].user_id}`, daysAgo(2, 20));
  nIns.run(demoId, "match", "Alguien te ha dado un Super Like ★", "Descubre quién desde Descubrir.", "/descubrir", daysAgo(4));
  nIns.run(demoId, "evento", "Nuevo evento: Sunset Singles en yate", "Quedan pocas plazas.", "/eventos", daysAgo(1));
  nIns.run(pendingId, "sistema", "Bienvenido/a a TWO LOVE", "Completa tus 5 verificaciones para empezar a conectar.", "/verificacion", daysAgo(1));

  // TWO LOVE Park: local piloto en Santiago con 5 meses de historial
  seedParkDemo(conn, { r, demoId, partnerId: men[0]?.user_id ?? null, ids });
  nIns.run(demoId, "reserva", "Día 100 en 3 días 💞", "Celebradlo en TWO LOVE Park con el paquete Día 100.", "/park/pasaporte", daysAgo(0, 9));
}
