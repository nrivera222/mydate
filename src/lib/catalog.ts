// Catálogo de negocio de TWO LOVE: membresías, prototipos, intereses, tarifas y reglas.
// Todos los importes se guardan en fils (céntimos de dírham, AED × 100).

export const CURRENCY = "AED";
export const VAT_RATE = 0.05; // IVA de EAU
export const PROVIDER_COMMISSION = 0.15; // comisión al acompañante sobre su tarifa

export const FX: Record<string, number> = { AED: 1, USD: 0.2723, EUR: 0.2515, GBP: 0.2143, SAR: 1.0211, CLP: 255 }; // CLP: igual que CLP_PER_AED (park-catalog.ts)

export type TierId = "essential" | "gold" | "platinum" | "diamond" | "royal";

export type Tier = {
  id: TierId;
  name: string;
  rank: number;
  monthly: number; // fils
  yearly: number; // fils
  tagline: string;
  dailyLikes: number; // -1 = ilimitado
  superLikes: number;
  serviceFee: number; // tarifa de servicio que paga el cliente en reservas
  giftDiscount: number;
  monthlyCredit: number; // fils abonados a la billetera al suscribirse
  seeLikes: boolean;
  incognito: boolean;
  concierge: boolean;
  matchmaker: boolean;
  benefits: string[];
};

export const TIERS: Tier[] = [
  {
    id: "essential", name: "Essential", rank: 0, monthly: 0, yearly: 0,
    tagline: "Empieza con un perfil verificado.",
    dailyLikes: 10, superLikes: 0, serviceFee: 0.1, giftDiscount: 0, monthlyCredit: 0,
    seeLikes: false, incognito: false, concierge: false, matchmaker: false,
    benefits: ["Perfil verificado con insignias", "10 likes diarios", "Mensajes con tus matches", "Acceso a regalos virtuales"],
  },
  {
    id: "gold", name: "Gold", rank: 1, monthly: 299_00, yearly: 2_990_00,
    tagline: "Más visibilidad y filtros avanzados.",
    dailyLikes: 50, superLikes: 3, serviceFee: 0.08, giftDiscount: 0.05, monthlyCredit: 50_00,
    seeLikes: true, incognito: false, concierge: false, matchmaker: false,
    benefits: ["50 likes y 3 Super Likes diarios", "Ver quién te dio like", "Filtros por prototipo y patrimonio", "5% en regalos", "50 AED de crédito mensual", "5% en TWO LOVE Park"],
  },
  {
    id: "platinum", name: "Platinum", rank: 2, monthly: 999_00, yearly: 9_990_00,
    tagline: "Salas TWO LOVE y prioridad en el descubrimiento.",
    dailyLikes: 200, superLikes: 10, serviceFee: 0.06, giftDiscount: 0.1, monthlyCredit: 200_00,
    seeLikes: true, incognito: true, concierge: false, matchmaker: false,
    benefits: ["Likes prácticamente ilimitados", "Modo incógnito", "Acceso a Salas TWO LOVE Platinum", "10% en regalos y aliados", "200 AED de crédito mensual", "10% en TWO LOVE Park"],
  },
  {
    id: "diamond", name: "Diamond", rank: 3, monthly: 2_999_00, yearly: 29_990_00,
    tagline: "Concierge 24/7 y experiencias de lujo.",
    dailyLikes: -1, superLikes: 30, serviceFee: 0.04, giftDiscount: 0.15, monthlyCredit: 750_00,
    seeLikes: true, incognito: true, concierge: true, matchmaker: false,
    benefits: ["Todo Platinum", "Concierge 24/7 para reservas y regalos", "Salas Diamond (yates, desierto, suites)", "15% en regalos y aliados", "750 AED de crédito mensual", "Two Love Club incluido"],
  },
  {
    id: "royal", name: "Royal Black", rank: 4, monthly: 9_999_00, yearly: 99_990_00,
    tagline: "Por invitación. Matchmaker personal y discreción absoluta.",
    dailyLikes: -1, superLikes: -1, serviceFee: 0, giftDiscount: 0.2, monthlyCredit: 3_000_00,
    seeLikes: true, incognito: true, concierge: true, matchmaker: true,
    benefits: ["Todo Diamond", "Matchmaker humano dedicado", "Todas las Salas, incluidas las privadas Royal", "Sin tarifa de servicio en reservas", "20% en regalos y aliados", "3.000 AED de crédito mensual", "Eventos privados internacionales"],
  },
];

export const tierById = (id: string) => TIERS.find((t) => t.id === id) ?? TIERS[0];

// Prototipos internacionales de perfil
export const ARCHETYPES = [
  { id: "empresario", label: "Empresario/a", desc: "Fundadores, CEOs y dueños de negocio" },
  { id: "heredero", label: "Heredero/a", desc: "Patrimonio familiar y family offices" },
  { id: "ejecutivo", label: "Alto ejecutivo/a", desc: "Dirección en corporaciones y banca" },
  { id: "inversor", label: "Inversor/a", desc: "Private equity, venture capital, real estate" },
  { id: "diplomatico", label: "Diplomático/a", desc: "Cuerpo diplomático y organismos internacionales" },
  { id: "medico", label: "Médico/a · Profesional liberal", desc: "Medicina, derecho, arquitectura" },
  { id: "creativo", label: "Creativo/a · Artista", desc: "Moda, arte, música, diseño" },
  { id: "atleta", label: "Atleta · Deportista", desc: "Deporte profesional y élite" },
  { id: "influencer", label: "Figura pública", desc: "Medios, influencers y celebridades" },
  { id: "nomada", label: "Nómada global", desc: "Vive entre varias ciudades del mundo" },
] as const;

export const archetypeLabel = (id: string) => ARCHETYPES.find((a) => a.id === id)?.label ?? id;

// Afinidad entre prototipos (0–1). Lo no listado vale 0.5.
export const ARCHETYPE_AFFINITY: Record<string, string[]> = {
  empresario: ["inversor", "ejecutivo", "creativo", "heredero"],
  heredero: ["empresario", "diplomatico", "inversor", "creativo"],
  ejecutivo: ["empresario", "medico", "ejecutivo", "inversor"],
  inversor: ["empresario", "heredero", "ejecutivo"],
  diplomatico: ["heredero", "medico", "nomada"],
  medico: ["ejecutivo", "diplomatico", "medico"],
  creativo: ["empresario", "influencer", "heredero", "creativo"],
  atleta: ["influencer", "empresario", "atleta"],
  influencer: ["creativo", "atleta", "empresario"],
  nomada: ["nomada", "diplomatico", "creativo"],
};

export const INTERESTS = [
  "Arte contemporáneo", "Alta cocina", "Vinos y sommelier", "Yates", "Golf", "Polo", "Equitación",
  "Fórmula 1", "Relojería", "Alta costura", "Viajes de lujo", "Safari", "Esquí", "Buceo", "Tenis",
  "Filantropía", "Inversiones", "Tecnología", "Cripto", "Bienestar y spa", "Yoga", "Fitness",
  "Ópera", "Jazz", "Literatura", "Cine", "Fotografía", "Arquitectura", "Moda", "Desierto y dunas",
  "Halconería", "Gastronomía árabe", "Idiomas", "Familia", "Espiritualidad",
];

export const GENDERS = [
  { id: "mujer", label: "Mujer" },
  { id: "hombre", label: "Hombre" },
  { id: "no_binario", label: "No binario" },
];

export const INTENTS = [
  { id: "matrimonio", label: "Matrimonio" },
  { id: "noviazgo", label: "Noviazgo serio" },
  { id: "conocer", label: "Conocer gente afín" },
];

export const NET_WORTH = [
  { id: "na", label: "Prefiero no decirlo" },
  { id: "1m", label: "1M – 5M USD" },
  { id: "5m", label: "5M – 30M USD" },
  { id: "30m", label: "30M – 100M USD" },
  { id: "100m", label: "+100M USD" },
];

export const LANGUAGES = ["Español", "Inglés", "Árabe", "Francés", "Italiano", "Ruso", "Alemán", "Portugués", "Mandarín", "Hindi"];

export const CITIES = [
  { city: "Dubái", country: "EAU" }, { city: "Abu Dabi", country: "EAU" }, { city: "Doha", country: "Catar" },
  { city: "Riad", country: "Arabia Saudí" }, { city: "Mónaco", country: "Mónaco" }, { city: "Londres", country: "Reino Unido" },
  { city: "París", country: "Francia" }, { city: "Madrid", country: "España" }, { city: "Miami", country: "EE. UU." },
  { city: "Nueva York", country: "EE. UU." }, { city: "Ciudad de México", country: "México" }, { city: "Singapur", country: "Singapur" },
  { city: "Ginebra", country: "Suiza" }, { city: "Milán", country: "Italia" },
];

// Citas de acompañamiento social ("citas falsas"): se alquilan por unidad de tiempo.
export const RATE_UNITS = [
  { id: "hour", label: "Hora", plural: "horas", per: "Por hora", maxQty: 12 },
  { id: "day", label: "Día", plural: "días", per: "Por día", maxQty: 14 },
  { id: "week", label: "Semana", plural: "semanas", per: "Por semana", maxQty: 8 },
  { id: "month", label: "Mes", plural: "meses", per: "Por mes", maxQty: 12 },
  { id: "year", label: "Año", plural: "años", per: "Por año", maxQty: 2 },
] as const;
export type RateUnit = (typeof RATE_UNITS)[number]["id"];

export const COMPANION_ACTIVITIES = [
  "Cena de gala", "Evento corporativo", "Boda o celebración familiar", "Viaje de negocios", "Temporada de eventos",
  "Acompañante en ópera o teatro", "Tour cultural por la ciudad", "Práctica de idiomas", "Networking", "Fiesta privada",
];

export const COMPANION_RULES = [
  "El acompañamiento es estrictamente social y platónico: no incluye servicios sexuales ni íntimos.",
  "Todo contacto se realiza dentro de la plataforma y el pago queda en custodia (escrow) hasta finalizar.",
  "Ambas partes deben tener verificación completa y seguro de vida activo.",
  "Los encuentros se realizan en lugares públicos o Salas TWO LOVE; se activa el check-in de seguridad.",
  "Cualquier incumplimiento supone expulsión permanente y, si procede, aviso a las autoridades.",
];

export const VERIFICATION_TYPES = [
  { id: "identity", label: "Identidad", desc: "Pasaporte o Emirates ID + selfie de comprobación." },
  { id: "photo", label: "Foto clara", desc: "Retrato reciente, rostro visible, sin filtros." },
  { id: "psychological", label: "Perfil psicológico", desc: "Test de personalidad + aval de psicólogo colegiado." },
  { id: "medical", label: "Perfil médico", desc: "Certificado médico reciente (clínica aliada o propia)." },
  { id: "insurance", label: "Seguro de vida", desc: "Aceptación y suscripción de póliza de vida TWO LOVE." },
] as const;
export type VerificationType = (typeof VERIFICATION_TYPES)[number]["id"];

// Test psicológico breve (Big Five). Cada ítem suma o resta a un rasgo.
export const PSYCH_ITEMS = [
  { id: "q1", trait: "extraversion", text: "Me recargo de energía rodeado/a de gente.", sign: 1 },
  { id: "q2", trait: "extraversion", text: "Prefiero planes tranquilos con pocas personas.", sign: -1 },
  { id: "q3", trait: "amabilidad", text: "Me preocupo sinceramente por los demás.", sign: 1 },
  { id: "q4", trait: "amabilidad", text: "Suelo ser crítico/a y exigente con otros.", sign: -1 },
  { id: "q5", trait: "responsabilidad", text: "Cumplo mis compromisos y horarios con rigor.", sign: 1 },
  { id: "q6", trait: "responsabilidad", text: "Improviso a menudo y dejo cosas para después.", sign: -1 },
  { id: "q7", trait: "estabilidad", text: "Mantengo la calma bajo presión.", sign: 1 },
  { id: "q8", trait: "estabilidad", text: "Me preocupo con facilidad.", sign: -1 },
  { id: "q9", trait: "apertura", text: "Me atraen culturas, ideas y experiencias nuevas.", sign: 1 },
  { id: "q10", trait: "apertura", text: "Prefiero lo conocido a lo novedoso.", sign: -1 },
] as const;

export const TRAITS = ["extraversion", "amabilidad", "responsabilidad", "estabilidad", "apertura"] as const;
export const TRAIT_LABELS: Record<string, string> = {
  extraversion: "Extraversión", amabilidad: "Amabilidad", responsabilidad: "Responsabilidad",
  estabilidad: "Estabilidad emocional", apertura: "Apertura",
};

export const INSURANCE_PLANS = [
  { id: "basic", label: "Vida Essential", coverage: 500_000_00, premium: 49_00 },
  { id: "premium", label: "Vida Premium", coverage: 2_000_000_00, premium: 149_00 },
  { id: "elite", label: "Vida Elite Global", coverage: 10_000_000_00, premium: 590_00 },
];

export const RATING_TAGS = ["Puntual", "Elegante", "Gran conversación", "Respetuoso/a", "Divertido/a", "Discreto/a", "Perfil fiel a la realidad"];

export const REPORT_REASONS = ["Perfil falso", "Comportamiento inapropiado", "Solicitud de servicios prohibidos", "Acoso", "Fraude o estafa", "Otro"];

// Líneas de ingreso (ERP)
export const STREAM_LABEL: Record<string, string> = {
  suscripcion: "Suscripciones", regalo: "Regalos (margen)", comision_reserva: "Comisión acompañamiento", tarifa_servicio: "Tarifa de servicio",
  sala: "Salas TWO LOVE", seguro: "Comisión seguros", aliado: "Alianzas y patrocinio", evento: "Eventos privados",
  // TWO LOVE Park (parque de citas físico)
  park_cafe: "Park · Café y carta", park_pase: "Park · Pase de experiencias", park_maquinas: "Park · Máquinas",
  park_cabinas: "Park · Cabinas de fotos", park_paquetes: "Park · Paquetes de fechas", park_talleres: "Park · Talleres",
  park_club: "Park · Two Love Club", park_alianzas: "Park · Alianzas y eventos",
};

// Programa de referidos (fils)
export const REFERRAL_WELCOME = 50_00; // bono extra para quien llega invitado
export const REFERRAL_REWARD = 150_00; // para quien invita, cuando el invitado contrata su primera membresía
