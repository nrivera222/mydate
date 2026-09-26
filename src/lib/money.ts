import { CURRENCY, FX } from "./catalog";
import { currentLocale, INTL_LOCALE } from "./i18n";

const intl = () => INTL_LOCALE[currentLocale()];

/** Formatea fils (AED × 100) como importe legible, en el idioma de la petición. */
export function money(fils: number, currency: string = CURRENCY) {
  const rate = FX[currency] ?? 1;
  const value = (fils / 100) * rate;
  return new Intl.NumberFormat(intl(), {
    style: "currency",
    currency,
    useGrouping: "always",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

export function compact(fils: number) {
  return new Intl.NumberFormat(intl(), { notation: "compact", maximumFractionDigits: 1 }).format(fils / 100) + " " + CURRENCY;
}

export const toFils = (aed: number) => Math.round(aed * 100);

export function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

/** Pesos chilenos (TWO LOVE Park): "CLP 22.900". */
export function clp(n: number) {
  return `CLP ${new Intl.NumberFormat(intl(), { maximumFractionDigits: 0, useGrouping: "always" }).format(n)}`;
}

/** Millones de CLP para cuadros de mando: "14,7 M". */
export function clpM(n: number) {
  return `${new Intl.NumberFormat(intl(), { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(n / 1_000_000)} M`;
}
