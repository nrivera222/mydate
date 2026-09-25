import { ARCHETYPE_AFFINITY, TRAITS } from "./catalog";

type MatchInput = {
  archetype: string;
  interests: string;
  languages: string;
  city: string;
  country: string;
  intent: string;
  traits: string;
};

const set = (s: string) => new Set(s.split(",").map((x) => x.trim()).filter(Boolean));

function jaccard(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  a.forEach((x) => b.has(x) && inter++);
  return inter / (a.size + b.size - inter);
}

function parseTraits(s: string): Record<string, number> {
  try {
    return JSON.parse(s || "{}");
  } catch {
    return {};
  }
}

/**
 * Compatibilidad 0–100 entre dos perfiles.
 * Pesos: intereses 35 · personalidad 25 · prototipo 15 · idiomas 10 · ubicación 10 · intención 5.
 */
export function compatibility(a: MatchInput, b: MatchInput) {
  const interests = Math.min(1, jaccard(set(a.interests), set(b.interests)) * 2.5);

  const ta = parseTraits(a.traits), tb = parseTraits(b.traits);
  let personality = 0.5;
  const known = TRAITS.filter((t) => ta[t] != null && tb[t] != null);
  if (known.length) {
    // Similitud en responsabilidad/estabilidad/amabilidad, complementariedad tolerada en extraversión/apertura
    personality = known.reduce((acc, t) => {
      const d = Math.abs(ta[t] - tb[t]);
      return acc + (t === "extraversion" || t === "apertura" ? 1 - d * 0.6 : 1 - d);
    }, 0) / known.length;
  }

  const aff = ARCHETYPE_AFFINITY[a.archetype] ?? [];
  const archetype = aff.includes(b.archetype) ? 1 : a.archetype === b.archetype ? 0.8 : 0.45;
  const languages = jaccard(set(a.languages), set(b.languages)) > 0 ? Math.min(1, 0.5 + jaccard(set(a.languages), set(b.languages))) : 0;
  const location = a.city === b.city ? 1 : a.country === b.country ? 0.7 : 0.3;
  const intent = a.intent === b.intent ? 1 : 0.4;

  const score = interests * 35 + personality * 25 + archetype * 15 + languages * 10 + location * 10 + intent * 5;
  return {
    score: Math.round(score),
    breakdown: { interests, personality, archetype, languages, location, intent },
  };
}
