import { currentUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { SURVEY } from "@/lib/park-catalog";

// Exportación CSV de la encuesta de validación (solo administración)
export async function GET() {
  const user = await currentUser();
  if (user?.role !== "admin") return new Response("No autorizado", { status: 401 });
  const rows = all<Record<string, string | number>>("SELECT id, created_at, age, together, frequency, spend, interests, pay, club, dates, comuna, email FROM park_survey ORDER BY id");
  const label = (list: string[], i: number) => list[i] ?? "";
  // Comillas y neutralización de fórmulas (=, +, -, @) al abrir el CSV en una hoja de cálculo
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return `"${(/^[=+\-@\t\r]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
  };
  const head = ["id", "fecha", "edad", "juntos", "citas_mes", "gasto", "intereses", "pagaria_cita_completa", "club", "fechas", "comuna", "email"];
  const body = rows.map((r) => [r.id, r.created_at, label(SURVEY.ages, +r.age), label(SURVEY.together, +r.together), label(SURVEY.frequency, +r.frequency),
    label(SURVEY.spend, +r.spend), r.interests, label(SURVEY.answers, +r.pay), label(SURVEY.answers, +r.club), r.dates, r.comuna, r.email].map(esc).join(","));
  return new Response("﻿" + [head.join(","), ...body].join("\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="two-love-park-encuesta.csv"', "Cache-Control": "no-store" },
  });
}
