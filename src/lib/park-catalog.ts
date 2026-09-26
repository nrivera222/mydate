// Catálogo de TWO LOVE Park: el parque de citas físico (piloto en Santiago de Chile).
// Precios en pesos chilenos (CLP, IVA 19 % incluido). La billetera del ecosistema es única y
// opera en AED: los cobros del Park se convierten con CLP_PER_AED.

export const PARK_CURRENCY = "CLP";
export const CLP_PER_AED = 255; // tipo de cambio de referencia (configurable)
export const CHILE_VAT = 0.19;
export const DEPOSIT_RATE = 0.3; // anticipo del 30 % en cada reserva
export const CANCEL_FREE_HOURS = 48; // cancelación con devolución del anticipo
export const OPEN_HOUR = 11;
export const CLOSE_HOUR = 22;
export const MINORS_UNTIL_HOUR = 19; // 14–17 años: solo de día, sin alcohol
export const ALBUM_DAYS = 30; // vigencia del álbum de fotos por QR

/** CLP → fils (AED × 100) para la billetera del ecosistema. */
export const clpToFils = (clp: number) => Math.round((clp / CLP_PER_AED) * 100);
/** Separa el IVA chileno de un precio con IVA incluido. */
export const splitVat = (gross: number) => {
  const net = Math.round(gross / (1 + CHILE_VAT));
  return { net, vat: gross - net };
};

export type StampId = "viaje" | "cine" | "recrea" | "misterio" | "cabina" | "taller";
export const STAMPS: { id: StampId; icon: string; label: string }[] = [
  { id: "viaje", icon: "✈️", label: "Viaje simulado" },
  { id: "cine", icon: "🎬", label: "Mini cine" },
  { id: "recrea", icon: "💞", label: "Recrea cómo se conocieron" },
  { id: "misterio", icon: "🕵️", label: "Misterio cooperativo" },
  { id: "cabina", icon: "📸", label: "Cabina de fotos" },
  { id: "taller", icon: "💍", label: "Taller para dos" },
];
export const stampById = (id: string) => STAMPS.find((s) => s.id === id);

export const PARK_ZONES = [
  { id: "cafe", icon: "☕", name: "Café-juego", desc: "Cartas de conversación, tableros para dos y combos con actividad." },
  { id: "escenarios", icon: "🎬", name: "Escenarios", desc: "Viajes simulados, mini cine y set para recrear cómo se conocieron." },
  { id: "juegos", icon: "🧩", name: "Juegos", desc: "Misterio cooperativo, escape para dos y quiz de parejas." },
  { id: "cabinas", icon: "📸", name: "Cabinas", desc: "Tira de cuatro fotos estilo coreano, purikura y entrega por QR." },
  { id: "maquinas", icon: "🧸", name: "Máquinas", desc: "Peluches, cápsulas, comidas y bebidas virales y buzón del amor." },
  { id: "fechas", icon: "🎂", name: "Fechas", desc: "Cumplemes, aniversarios, día 100 y pedidas de mano con paquetes." },
];

export type ParkProductKind = "cita" | "paquete" | "taller";
export type ParkProduct = {
  id: string;
  kind: ParkProductKind;
  name: string;
  price: number; // CLP con IVA, por pareja
  from?: boolean; // precio "desde"
  minutes: number;
  capacity: number; // parejas por franja horaria
  stamps: StampId[];
  includes: string[];
  minors: boolean; // apto para parejas de 14 a 17 años (reserva del tutor)
  stream: string; // línea de ingreso
  badge?: string;
};

export const PARK_PRODUCTS: ParkProduct[] = [
  // Menú de citas sin planificar
  { id: "clasica", kind: "cita", name: "Cita Clásica", price: 22_900, minutes: 90, capacity: 12, stamps: ["misterio"], minors: true, stream: "park_pase", badge: "Para empezar",
    includes: ["2 bebidas y 1 snack para compartir", "Pase de experiencias de 90 minutos"] },
  { id: "completa", kind: "cita", name: "Cita Completa", price: 29_900, minutes: 90, capacity: 12, stamps: ["misterio", "cabina"], minors: true, stream: "park_pase", badge: "Recomendada",
    includes: ["Todo lo de la Cita Clásica", "Tira de 4 fotos y cápsula con llavero"] },
  { id: "viaje", kind: "cita", name: "Cita Viaje", price: 34_900, minutes: 60, capacity: 1, stamps: ["viaje"], minors: true, stream: "park_pase", badge: "Para sorprender",
    includes: ["Set privado de 60 minutos con bebida y snack", "Destino a elección: París, Seúl o Tokio"] },
  // Fechas especiales
  { id: "cumplemes", kind: "paquete", name: "Cumplemes", price: 45_000, minutes: 120, capacity: 3, stamps: ["cine", "cabina"], minors: true, stream: "park_paquetes",
    includes: ["Mini cine privado", "Tira de fotos", "Postre para compartir"] },
  { id: "dia100", kind: "paquete", name: "Día 100 y otros hitos", price: 65_000, minutes: 120, capacity: 2, stamps: ["taller", "cabina"], minors: true, stream: "park_paquetes",
    includes: ["Taller de anillos a juego", "Tira de fotos", "Pastel con la cifra del hito"] },
  { id: "cumpleanos", kind: "paquete", name: "Cumpleaños sorpresa", price: 60_000, minutes: 120, capacity: 2, stamps: ["cine"], minors: true, stream: "park_paquetes",
    includes: ["Sala decorada", "Video sorpresa en el mini cine", "Torta y globos"] },
  { id: "aniversario", kind: "paquete", name: "Aniversario", price: 85_000, minutes: 150, capacity: 2, stamps: ["cine", "cabina"], minors: false, stream: "park_paquetes",
    includes: ["Cena ligera para dos", "Mini cine con vuestras fotos", "Álbum impreso"] },
  { id: "recrea", kind: "paquete", name: "Recrea cómo se conocieron", price: 95_000, minutes: 120, capacity: 1, stamps: ["recrea", "cabina"], minors: false, stream: "park_paquetes",
    includes: ["Set ambientado según vuestra historia", "Actor o guía de escena", "Sesión de fotos"] },
  { id: "pedida", kind: "paquete", name: "Pedida de mano", price: 250_000, from: true, minutes: 180, capacity: 1, stamps: ["recrea", "cabina"], minors: false, stream: "park_paquetes",
    includes: ["Escenario exclusivo y coordinador/a", "Fotógrafo y video", "Brindis y flores"] },
  // Talleres
  { id: "anillos", kind: "taller", name: "Taller de anillos", price: 39_900, minutes: 120, capacity: 6, stamps: ["taller"], minors: true, stream: "park_talleres",
    includes: ["Dos anillos de plata grabados", "Tradición coreana de los días 100, 200 y 300"] },
  { id: "ceramica", kind: "taller", name: "Cerámica para dos", price: 34_900, minutes: 120, capacity: 6, stamps: ["taller"], minors: true, stream: "park_talleres",
    includes: ["Dos piezas esmaltadas", "Entrega en 10 días"] },
  { id: "cata", kind: "taller", name: "Cata para dos", price: 32_900, minutes: 90, capacity: 6, stamps: ["taller"], minors: false, stream: "park_talleres",
    includes: ["Cinco vinos chilenos", "Tabla para compartir"] },
  { id: "baile", kind: "taller", name: "Baile y té", price: 19_900, minutes: 90, capacity: 8, stamps: ["taller"], minors: false, stream: "park_talleres",
    includes: ["Clase de bolero y cueca", "Té y pastelería"] },
];
export const productById = (id: string) => PARK_PRODUCTS.find((p) => p.id === id);
export const PRODUCT_KIND_LABEL: Record<ParkProductKind, string> = { cita: "Menú de citas", paquete: "Fechas especiales", taller: "Talleres" };
export const DESTINATIONS = ["París", "Seúl", "Tokio"];

// Two Love Club: membresía por pareja
export const CLUB = {
  price: 7_900, // CLP al mes
  discount: 0.1,
  benefits: ["Foto y cápsula cada mes", "10 % de descuento en citas y paquetes", "Prioridad de reserva"],
  targetMembers: 180,
  targetRepeat: 0.35, // recompra a 60 días
  includedFromTier: 3, // Diamond y Royal Black lo tienen incluido
};

/** Recompensa por completar el pasaporte: una Cita Clásica gratis (como crédito). */
export const PASSPORT_REWARD_CLP = 22_900;

// Segmentos de clientes (supuesto de trabajo del plan)
export const SEGMENTS = [
  { id: "teen", range: "14 a 17 años", share: 0.1, note: "De día, sin alcohol y con zonas visibles." },
  { id: "young", range: "18 a 30 años", share: 0.55, note: "Núcleo del negocio: viajes, fotos, juegos y redes." },
  { id: "adult", range: "30 a 55 años", share: 0.25, note: "Noches sin niños, cerámica, cata y aniversarios." },
  { id: "senior", range: "60 años o más", share: 0.1, note: "Amor de toda la vida: baile, té y primera cita." },
];

// Caso base del piloto (régimen estable, CLP netos de IVA, al mes)
export const BASE_CASE = {
  couples: 1_400,
  breakeven: 849,
  conservative: 900,
  optimistic: 1_900,
  decisionMonth: 6,
  fixedCosts: 18_300_000,
  contribution: 0.69,
  revenue: {
    park_cafe: 14_700_000, park_pase: 7_500_000, park_maquinas: 6_900_000, park_cabinas: 3_200_000,
    park_paquetes: 2_100_000, park_talleres: 1_400_000, park_club: 1_400_000, park_alianzas: 1_000_000,
  } as Record<string, number>,
};
export const PARK_STREAMS = Object.keys(BASE_CASE.revenue);

export const ROADMAP = [
  { when: "Oct–dic 2026", name: "Validación", desc: "Encuesta a 300 parejas, cotizaciones, opinión legal y ronda cerrada." },
  { when: "Dic 2026–feb 2027", name: "Habilitación", desc: "Obra, máquinas, equipo capacitado y permisos vigentes." },
  { when: "12 meses", name: "Piloto", desc: "935 parejas al mes al mes 6 y 1.400 al mes 9." },
  { when: "Año 2 y año 3", name: "Expansión", desc: "Local insignia de 250 m² y local regional de 150 m²." },
];

// Próximos hitos de la pareja a partir de la fecha en que empezaron
export type Milestone = { key: string; label: string; n: number; date: string; days: number; product: string };
const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
export function milestones(since: string, today = new Date()): Milestone[] {
  const start = new Date(`${since}T00:00:00Z`);
  const t0 = new Date(`${iso(today)}T00:00:00Z`);
  const out: Milestone[] = [];
  const add = (key: string, label: string, n: number, d: Date, product: string) => {
    const days = Math.round((d.getTime() - t0.getTime()) / DAY);
    if (days >= 0 && days <= 400) out.push({ key, label, n, date: iso(d), days, product });
  };
  for (const n of [100, 200, 300, 500, 520, 1000]) add(`d${n}`, "Día {n}", n, new Date(start.getTime() + n * DAY), "dia100");
  // Cumplemes: mismo día de cada mes (el próximo)
  for (let m = 1; m <= 240; m++) {
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + m, start.getUTCDate()));
    if (d >= t0) {
      if (m % 12 === 0) add(`y${m / 12}`, "Aniversario {n}", m / 12, d, "aniversario");
      else add(`m${m}`, "Cumplemes {n}", m, d, "cumplemes");
      if (m % 12 !== 0) {
        const y = Math.ceil(m / 12) * 12;
        add(`y${y / 12}`, "Aniversario {n}", y / 12, new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + y, start.getUTCDate())), "aniversario");
      }
      break;
    }
  }
  return out.sort((a, b) => a.days - b.days).filter((m, i, arr) => arr.findIndex((x) => x.key === m.key) === i);
}
export const daysTogether = (since: string, today = new Date()) =>
  Math.floor((new Date(`${iso(today)}T00:00:00Z`).getTime() - new Date(`${since}T00:00:00Z`).getTime()) / DAY);
