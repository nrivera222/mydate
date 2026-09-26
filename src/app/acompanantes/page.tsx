import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { fullyVerifiedIds, hiddenFor } from "@/lib/discovery";
import { age, csv } from "@/lib/users";
import { archetypeLabel, CITIES, COMPANION_ACTIVITIES, COMPANION_RULES, GENDERS } from "@/lib/catalog";
import { money } from "@/lib/money";
import { Empty, Flash, PageHeader, Portrait, sp, Stars, type SP } from "@/components/ui";
import { getT } from "@/lib/i18n";

type Row = {
  user_id: number; name: string; hue: number; photo_path: string | null; birth_year: number | null; city: string; gender: string; archetype: string; languages: string;
  headline: string; activities: string; rate_hour: number | null; rate_day: number | null; rate_week: number | null; rate_month: number | null; rate_year: number | null;
  avg: number | null; n: number;
};

export default async function Companions({ searchParams }: { searchParams: SP }) {
  const t = await getT();
  const user = await requireUser();
  const q = await searchParams;
  const city = sp(q.city), gender = sp(q.gender), activity = sp(q.activity), max = Number(sp(q.max)) || 0;
  const verified = fullyVerifiedIds();
  const hidden = hiddenFor(user.id);

  const rows = all<Row>(
    `SELECT p.user_id, u.name, p.hue, p.photo_path, p.birth_year, p.city, p.gender, p.archetype, p.languages, o.*,
       (SELECT AVG(stars) FROM ratings WHERE ratee_id = p.user_id) AS avg, (SELECT COUNT(*) FROM ratings WHERE ratee_id = p.user_id) AS n
     FROM companion_offers o JOIN profiles p ON p.user_id = o.user_id JOIN users u ON u.id = o.user_id
     WHERE o.active = 1 AND u.status = 'active' AND o.user_id != ? ORDER BY avg DESC NULLS LAST`,
    user.id,
  ).filter((r) =>
    verified.has(r.user_id) && !hidden.has(r.user_id) &&
    (!city || r.city === city) && (!gender || r.gender === gender) &&
    (!activity || csv(r.activities).includes(activity)) && (!max || (r.rate_hour ?? Infinity) <= max * 100),
  );

  return (
    <div>
      <PageHeader title={t("Acompañamiento social")} subtitle={t("Reserva un acompañante verificado por hora, día, semana, mes o año para galas, bodas, eventos corporativos y viajes. El pago queda en custodia hasta finalizar.")} >
        <Link href="/perfil/editar#acompanamiento" className="btn-ghost">{t("Ofrecer mi acompañamiento")}</Link>
      </PageHeader>
      <Flash ok={sp(q.ok)} error={sp(q.error)} />

      <details className="card mb-6 text-sm">
        <summary className="cursor-pointer text-glow">{t("Código de acompañamiento social")}</summary>
        <ul className="mt-3 list-disc space-y-1 ps-5 text-muted">{COMPANION_RULES.map((r) => <li key={r}>{r}</li>)}</ul>
      </details>

      <form className="card mb-8 grid gap-3 md:grid-cols-5" method="get">
        <select name="city" defaultValue={city ?? ""} className="input">
          <option value="">{t("Todas las ciudades")}</option>
          {CITIES.map((c) => <option key={c.city} value={c.city}>{t(c.city)}</option>)}
        </select>
        <select name="gender" defaultValue={gender ?? ""} className="input">
          <option value="">{t("Cualquier género")}</option>
          {GENDERS.map((g) => <option key={g.id} value={g.id}>{t(g.label)}</option>)}
        </select>
        <select name="activity" defaultValue={activity ?? ""} className="input">
          <option value="">{t("Cualquier actividad")}</option>
          {COMPANION_ACTIVITIES.map((a) => <option key={a} value={a}>{t(a)}</option>)}
        </select>
        <input name="max" type="number" min={0} defaultValue={max || ""} placeholder={t("Máx. AED/hora")} className="input" />
        <button className="btn-brand" type="submit">{t("Filtrar")}</button>
      </form>

      {rows.length === 0 && <Empty>{t("No hay acompañantes disponibles con estos filtros.")}</Empty>}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <Link key={r.user_id} href={`/acompanantes/${r.user_id}`} className="card overflow-hidden p-0 transition hover:border-brand/60">
            <div className="aspect-[4/3]"><Portrait name={r.name} hue={r.hue} photo={r.photo_path} /></div>
            <div className="space-y-2 p-5">
              <div className="font-display text-xl">{r.name.split(" ")[0]}{age(r) ? `, ${age(r)}` : ""}</div>
              <div className="text-sm text-glow">{r.headline}</div>
              <div className="text-sm text-muted">{t(r.city)} · {t(archetypeLabel(r.archetype))} · {csv(r.languages).slice(0, 3).map((l) => t(l)).join(", ")}</div>
              <Stars value={r.avg} count={r.n} />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {r.rate_hour && <span className="chip">{t("{price}/h", { price: money(r.rate_hour) })}</span>}
                {r.rate_day && <span className="chip">{t("{price}/día", { price: money(r.rate_day) })}</span>}
                {r.rate_month && <span className="chip">{t("{price}/mes", { price: money(r.rate_month) })}</span>}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
