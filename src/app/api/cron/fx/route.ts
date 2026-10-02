import { refreshOfficialRate } from "@/lib/fx";

// Actualización programada del tipo de cambio (p. ej. Vercel Cron o cualquier planificador diario).
// Requiere la cabecera Authorization: Bearer CRON_SECRET.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "No autorizado" }, { status: 401 });
  try {
    const r = await refreshOfficialRate(null);
    return Response.json({ ok: true, ...r });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
