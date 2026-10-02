import "server-only";
import { headers } from "next/headers";

/** URL pública de la app (APP_URL o la de la petición en curso), sin barra final. */
export async function appBaseUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  return h.get("origin") ?? `https://${h.get("host")}`;
}
