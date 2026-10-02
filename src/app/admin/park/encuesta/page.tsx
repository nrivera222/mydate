import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { all, one } from "@/lib/db";
import { invitePopup } from "../../../actions/park";
import { getT } from "@/lib/i18n";
import { pct } from "@/lib/money";
import { PARK_ZONES, SURVEY, productById } from "@/lib/park-catalog";
import { Bars, Flash, PageHeader, sp, Stat, type SP } from "@/components/ui";

type Row = { age: number; together: number; frequency: number; spend: number; interests: string; pay: number; club: number; dates: string; comuna: string; email: string };

// Resultados de la encuesta de validación frente a la hipótesis del plan
export default async function SurveyResults({ searchParams }: { searchParams: SP }) {
  const t = await getT();
  await requireAdmin();
  const q = await searchParams;
  const rows = all<Row>("SELECT age, together, frequency, spend, interests, pay, club, dates, comuna, email FROM park_survey");
  const n = rows.length;
  const pendingInvites = one<{ n: number }>("SELECT COUNT(*) AS n FROM park_survey WHERE email != '' AND invited_at IS NULL")!.n;
  const share = (f: (r: Row) => boolean) => (n ? rows.filter(f).length / n : 0);
  const willing = share((r) => r.pay <= 1);
  const firm = share((r) => r.pay === 0);
  const club = share((r) => r.club === 0);
  const validated = n >= SURVEY.target && willing >= SURVEY.threshold;
  const dist = (key: keyof Row, labels: string[]) => labels.map((l, i) => ({ label: t(l), value: share((r) => r[key] === i) }));
  const multi = (key: "interests" | "dates", ids: { id: string; label: string }[]) =>
    ids.map((x) => ({ label: x.label, value: share((r) => r[key].split(",").includes(x.id)) })).sort((a, b) => b.value - a.value);
  const comunas = Object.entries(rows.reduce<Record<string, number>>((m, r) => (r.comuna ? { ...m, [r.comuna]: (m[r.comuna] ?? 0) + 1 } : m), {}))
    .sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, v]) => ({ label, value: v }));

  return (
    <div>
      <PageHeader title={t("Encuesta de validación")} subtitle={t("Hipótesis del plan: se valida con una encuesta a {n} parejas antes de firmar el arriendo.", { n: SURVEY.target })}>
        <div className="flex gap-2">
          <Link href="/park/encuesta" className="btn-ghost">{t("Ver encuesta pública")}</Link>
          <a href="/admin/park/encuesta/csv" className="btn-ghost">{t("Descargar CSV")}</a>
        </div>
      </PageHeader>
      <Flash ok={sp(q.ok)} error={sp(q.error)} />
      <div className="grid gap-4 md:grid-cols-4">
        <Stat label={t("Respuestas")} value={`${n} / ${SURVEY.target}`} hint={pct(Math.min(1, n / SURVEY.target))} />
        <Stat label={t("Pagaría la Cita Completa")} value={pct(willing)} hint={t("{firm} sí · umbral {min}", { firm: pct(firm), min: pct(SURVEY.threshold) })} />
        <Stat label={t("Se uniría al Club")} value={pct(club)} hint={t("≈ {n} socios si 1.400 parejas/mes", { n: Math.round(club * 1400 * 0.35) })} />
        <Stat label={t("Emails para el pop-up")} value={rows.filter((r) => r.email).length} />
      </div>
      <div className={`mt-4 rounded-2xl border p-4 text-sm ${validated ? "border-ok/40 bg-ok/10" : "border-line bg-ink-2"}`}>
        {validated ? t("Hipótesis validada: se puede avanzar a la firma del arriendo.")
          : n < SURVEY.target ? t("Faltan {n} respuestas para cerrar la validación.", { n: SURVEY.target - n })
          : t("La disposición a pagar está bajo el umbral: revisar precios o propuesta antes de firmar.")}
      </div>
      <section className="card mt-6">
        <h2 className="h2">{t("Invitar al pop-up de prueba")}</h2>
        <p className="mt-1 text-sm text-muted">{t("Se envía una sola vez a quienes dejaron su email y aceptaron ser contactados ({n} pendientes). Incluye enlace de baja.", { n: pendingInvites })}</p>
        <form action={invitePopup} className="mt-3 grid gap-3 md:grid-cols-[1fr_1.5fr_auto]">
          <input className="input" name="when" maxLength={80} required placeholder={t("Sábado 14 y domingo 15 de noviembre, 12:00–20:00")} aria-label={t("Cuándo")} />
          <input className="input" name="where" maxLength={120} required placeholder={t("Galería en Providencia, Santiago")} aria-label={t("Dónde")} />
          <button className="btn-brand" type="submit" disabled={pendingInvites === 0}>{t("Enviar invitaciones")}</button>
        </form>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="card"><h2 className="h2 mb-4">{t("Qué quieren hacer")}</h2><Bars rows={multi("interests", PARK_ZONES.map((z) => ({ id: z.id, label: `${z.icon} ${t(z.name)}` })))} format={pct} /></section>
        <section className="card"><h2 className="h2 mb-4">{t("Fechas que celebran")}</h2><Bars rows={multi("dates", SURVEY.dates.map((d) => ({ id: d, label: t(productById(d)?.name ?? d) })))} format={pct} /></section>
        <section className="card"><h2 className="h2 mb-4">{t("Edad")}</h2><Bars rows={dist("age", SURVEY.ages)} format={pct} /></section>
        <section className="card"><h2 className="h2 mb-4">{t("Gasto por cita")}</h2><Bars rows={dist("spend", SURVEY.spend)} format={pct} /></section>
        <section className="card"><h2 className="h2 mb-4">{t("Citas al mes")}</h2><Bars rows={dist("frequency", SURVEY.frequency)} format={pct} /></section>
        <section className="card"><h2 className="h2 mb-4">{t("Comunas")}</h2><Bars rows={comunas} format={(v) => String(v)} /></section>
      </div>
    </div>
  );
}
