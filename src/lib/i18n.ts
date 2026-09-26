import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import en from "./i18n/en";
import ar from "./i18n/ar";

// Traducción estilo gettext: el texto en español es la clave; en.ts y ar.ts contienen las traducciones.
// Si falta una traducción se muestra el español (el script `npm run i18n:check` lo detecta).

export const LOCALES = ["es", "en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const LOCALE_COOKIE = "tl_lang";
export const LOCALE_NAMES: Record<Locale, string> = { es: "Español", en: "English", ar: "العربية" };
export const INTL_LOCALE: Record<Locale, string> = { es: "es-ES", en: "en-GB", ar: "ar-AE" };

const DICTS: Record<Locale, Record<string, string>> = { es: {}, en, ar };

type Vars = Record<string, string | number>;

export function isLocale(v: string | undefined | null): v is Locale {
  return !!v && (LOCALES as readonly string[]).includes(v);
}

function interpolate(s: string, vars?: Vars) {
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s;
}

export function translate(locale: Locale, key: string, vars?: Vars) {
  return interpolate(DICTS[locale][key] ?? key, vars);
}

// Patrones con variables ("Recarga de {amount} completada.") para traducir mensajes ya generados
// en español (avisos de las acciones y notificaciones guardadas en la base de datos).
const patternCache = new Map<Locale, { re: RegExp; names: string[]; key: string }[]>();
function patterns(locale: Locale) {
  let list = patternCache.get(locale);
  if (!list) {
    list = Object.keys(DICTS[locale])
      .filter((k) => /\{\w+\}/.test(k))
      .map((key) => {
        const names: string[] = [];
        const src = key.split(/(\{\w+\})/).map((part) => {
          const m = part.match(/^\{(\w+)\}$/);
          if (m) {
            names.push(m[1]);
            return "(.+?)";
          }
          return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        });
        return { re: new RegExp(`^${src.join("")}$`, "s"), names, key };
      })
      // Primero los patrones más específicos (más texto literal)
      .sort((a, b) => b.key.replace(/\{\w+\}/g, "").length - a.key.replace(/\{\w+\}/g, "").length);
    patternCache.set(locale, list);
  }
  return list;
}

/** Traduce un mensaje completo en español, reconociendo partes variables. */
export function translateMessage(locale: Locale, msg: string): string {
  if (locale === "es" || !msg) return msg;
  const dict = DICTS[locale];
  if (dict[msg]) return dict[msg];
  for (const p of patterns(locale)) {
    const m = msg.match(p.re);
    if (m) {
      const vars = Object.fromEntries(p.names.map((n, i) => [n, dict[m[i + 1]] ?? localizeAmount(locale, m[i + 1])]));
      return interpolate(dict[p.key], vars);
    }
  }
  return msg;
}

/** Reformatea un importe generado en español ("1.234,50 AED") al formato del idioma destino. */
function localizeAmount(locale: Locale, v: string) {
  const m = v.match(/^(-?[\d.]+(?:,\d+)?)\s*AED$/);
  if (!m) return v;
  const n = Number(m[1].replace(/\./g, "").replace(",", "."));
  return new Intl.NumberFormat(INTL_LOCALE[locale], { style: "currency", currency: "AED", maximumFractionDigits: n >= 1000 ? 0 : 2 }).format(n);
}

// Idioma de la petición en curso (memoizado por render con React cache)
const requestState = cache(() => ({ locale: "es" as Locale }));

export async function getLocale(): Promise<Locale> {
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;
  const accept = (await headers()).get("accept-language") ?? "";
  for (const part of accept.split(",")) {
    const lang = part.split(";")[0].trim().slice(0, 2).toLowerCase();
    if (isLocale(lang)) return lang;
  }
  return "es";
}

export type T = ((key: string, vars?: Vars) => string) & { locale: Locale; dir: "ltr" | "rtl"; msg: (m: string) => string };

/** Traductor para componentes de servidor y acciones. Llamar al inicio de cada página. */
export async function getT(): Promise<T> {
  const locale = await getLocale();
  requestState().locale = locale;
  return makeT(locale);
}

export function makeT(locale: Locale): T {
  const t = ((key: string, vars?: Vars) => translate(locale, key, vars)) as T;
  t.locale = locale;
  t.dir = locale === "ar" ? "rtl" : "ltr";
  t.msg = (m: string) => translateMessage(locale, m);
  return t;
}

/** Traductor síncrono para componentes compartidos (usa el idioma fijado por getT en esta petición). */
export function tr(key: string, vars?: Vars) {
  return translate(currentLocale(), key, vars);
}

export function currentLocale(): Locale {
  try {
    return requestState().locale;
  } catch {
    return "es";
  }
}
