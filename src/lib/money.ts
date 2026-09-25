import { CURRENCY, FX } from "./catalog";

/** Formatea fils (AED × 100) como importe legible. */
export function money(fils: number, currency: string = CURRENCY) {
  const rate = FX[currency] ?? 1;
  const value = (fils / 100) * rate;
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
    useGrouping: "always",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

export function compact(fils: number) {
  return new Intl.NumberFormat("es-ES", { notation: "compact", maximumFractionDigits: 1 }).format(fils / 100) + " " + CURRENCY;
}

export const toFils = (aed: number) => Math.round(aed * 100);

export function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}
