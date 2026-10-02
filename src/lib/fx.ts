import "server-only";
import { transaction } from "./db";
import { SETTINGS, setSetting } from "./settings";

// Tipo de cambio oficial: dólar observado del Banco Central de Chile (API pública de mindicador.cl,
// configurable con FX_SOURCE_URL) y paridad fija del dírham con el dólar (1 USD = 3,6725 AED).
export const AED_PER_USD = 3.6725;
const SOURCE = () => process.env.FX_SOURCE_URL ?? "https://mindicador.cl/api/dolar";

export async function fetchOfficialRate() {
  const res = await fetch(SOURCE(), { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000), cache: "no-store" });
  if (!res.ok) throw new Error(`La fuente respondió HTTP ${res.status}`);
  const data = (await res.json()) as { serie?: { fecha: string; valor: number }[] };
  const last = data.serie?.[0];
  if (!last || !(last.valor > 0)) throw new Error("La fuente no devolvió el dólar observado.");
  const rate = Math.round((last.valor / AED_PER_USD) * 100) / 100;
  const { min, max } = SETTINGS.clp_per_aed;
  if (rate < min || rate > max) throw new Error(`Tipo fuera de rango (${rate}).`);
  return { rate, usd: last.valor, date: last.fecha.slice(0, 10) };
}

/** Actualiza el ajuste clp_per_aed desde la fuente oficial y lo deja en el historial. */
export async function refreshOfficialRate(userId: number | null) {
  const r = await fetchOfficialRate();
  transaction((conn) => setSetting(conn, "clp_per_aed", r.rate, userId, `Dólar observado ${r.date}: CLP ${r.usd} / ${AED_PER_USD} AED`));
  return r;
}
