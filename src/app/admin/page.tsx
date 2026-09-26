import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { all, one } from "@/lib/db";
import { fullyVerifiedIds } from "@/lib/discovery";
import { archetypeLabel, STREAM_LABEL, TIERS } from "@/lib/catalog";
import { compact, money } from "@/lib/money";
import { Bars, Columns, PageHeader, Stat } from "@/components/ui";
import { getT } from "@/lib/i18n";

export default async function AdminHome() {
  const t = await getT();
  await requireAdmin();
  const members = one<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE role = 'user'")!.n;
  const verified = fullyVerifiedIds().size;
  const active7 = one<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE role = 'user' AND last_active_at >= datetime('now', '-7 days')")!.n;
  const mrr = one<{ v: number }>("SELECT COALESCE(SUM(CASE period WHEN 'yearly' THEN price / 12 ELSE price END), 0) AS v FROM subscriptions WHERE status = 'active' AND expires_at > datetime('now')")!.v;
  const rev30 = one<{ v: number }>("SELECT COALESCE(SUM(amount), 0) AS v FROM revenue WHERE created_at >= datetime('now', '-30 days')")!.v;
  const gmv30 = one<{ v: number }>(
    `SELECT COALESCE((SELECT SUM(total) FROM gift_orders WHERE created_at >= datetime('now','-30 days')), 0)
          + COALESCE((SELECT SUM(total) FROM bookings WHERE status IN ('accepted','completed') AND created_at >= datetime('now','-30 days')), 0) AS v`,
  )!.v;
  const pendingVer = one<{ n: number }>("SELECT COUNT(*) AS n FROM verifications WHERE status = 'pending'")!.n;
  const openReports = one<{ n: number }>("SELECT COUNT(*) AS n FROM reports WHERE status = 'abierto'")!.n;
  const matches = one<{ n: number }>("SELECT COUNT(*) / 2 AS n FROM likes a JOIN likes b ON a.from_id = b.to_id AND a.to_id = b.from_id WHERE a.kind != 'pass' AND b.kind != 'pass'")!.n;

  const monthly = all<{ m: string; v: number }>(
    "SELECT strftime('%Y-%m', created_at) AS m, SUM(amount) AS v FROM revenue WHERE created_at >= datetime('now', 'start of month', '-5 months') GROUP BY m ORDER BY m",
  );
  const byStream = all<{ stream: string; v: number }>("SELECT stream, SUM(amount) AS v FROM revenue WHERE created_at >= datetime('now', '-180 days') GROUP BY stream ORDER BY v DESC");
  const byTier = all<{ tier: string; n: number }>("SELECT tier, COUNT(*) AS n FROM users WHERE role = 'user' GROUP BY tier");
  const byCity = all<{ city: string; n: number }>("SELECT city, COUNT(*) AS n FROM profiles p JOIN users u ON u.id = p.user_id WHERE u.role = 'user' AND city != '' GROUP BY city ORDER BY n DESC LIMIT 8");
  const byArchetype = all<{ archetype: string; n: number }>("SELECT archetype, COUNT(*) AS n FROM profiles p JOIN users u ON u.id = p.user_id WHERE u.role = 'user' AND archetype != '' GROUP BY archetype ORDER BY n DESC");

  return (
    <div>
      <PageHeader title={t("Panel TWO LOVE")} subtitle={t("Visión general del negocio: crecimiento, ingresos, seguridad y operaciones.")} />
      <div className="grid gap-4 md:grid-cols-4">
        <Stat label={t("Miembros")} value={members} hint={t("{n} con verificación completa ({pct}%)", { n: verified, pct: Math.round((verified / Math.max(1, members)) * 100) })} />
        <Stat label={t("MRR suscripciones")} value={money(mrr)} hint={t("Ingreso mensual recurrente")} />
        <Stat label={t("Ingresos netos 30 días")} value={money(rev30)} hint={t("GMV 30 días: {v}", { v: compact(gmv30) })} />
        <Stat label={t("Activos 7 días")} value={active7} hint={t("{n} matches totales", { n: matches })} />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Link href="/admin/verificaciones" className="card flex items-center justify-between hover:border-gold/60">
          <span>{t("Verificaciones pendientes")}</span><span className="font-display text-3xl text-gold-2">{pendingVer}</span>
        </Link>
        <Link href="/admin/seguridad" className="card flex items-center justify-between hover:border-gold/60">
          <span>{t("Denuncias abiertas")}</span><span className={`font-display text-3xl ${openReports ? "text-rose" : "text-ok"}`}>{openReports}</span>
        </Link>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="h2 mb-4">{t("Ingresos por mes")}</h2>
          <Columns rows={monthly.map((r) => ({ label: r.m.slice(5), value: r.v }))} format={compact} />
        </section>
        <section className="card">
          <h2 className="h2 mb-4">{t("Ingresos por línea (180 días)")}</h2>
          <Bars rows={byStream.map((r) => ({ label: t(STREAM_LABEL[r.stream] ?? r.stream), value: r.v }))} format={money} />
        </section>
        <section className="card">
          <h2 className="h2 mb-4">{t("Miembros por membresía")}</h2>
          <Bars rows={TIERS.map((x) => ({ label: x.name, value: byTier.find((b) => b.tier === x.id)?.n ?? 0 }))} format={String} />
        </section>
        <section className="card">
          <h2 className="h2 mb-4">{t("Top ciudades")}</h2>
          <Bars rows={byCity.map((c) => ({ label: t(c.city), value: c.n }))} format={String} />
        </section>
        <section className="card lg:col-span-2">
          <h2 className="h2 mb-4">{t("Prototipos")}</h2>
          <div className="grid gap-x-8 md:grid-cols-2">
            <Bars rows={byArchetype.map((a) => ({ label: t(archetypeLabel(a.archetype)), value: a.n }))} format={String} />
          </div>
        </section>
      </div>
    </div>
  );
}
