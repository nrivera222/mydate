import { requireUser } from "@/lib/auth";
import { one } from "@/lib/db";
import { TIERS, tierById } from "@/lib/catalog";
import { money, pct } from "@/lib/money";
import { subscribe } from "../actions/commerce";
import { Flash, PageHeader, sp, type SP } from "@/components/ui";
import { getT } from "@/lib/i18n";

const ROWS: [string, (t: (typeof TIERS)[number]) => string][] = [
  ["Likes diarios", (x) => (x.dailyLikes < 0 ? "Ilimitados" : String(x.dailyLikes))],
  ["Super Likes diarios", (x) => (x.superLikes < 0 ? "Ilimitados" : String(x.superLikes))],
  ["Ver quién te dio like", (x) => (x.seeLikes ? "✓" : "—")],
  ["Modo incógnito", (x) => (x.incognito ? "✓" : "—")],
  ["Tarifa de servicio en reservas", (x) => pct(x.serviceFee)],
  ["Descuento en regalos", (x) => (x.giftDiscount ? pct(x.giftDiscount) : "—")],
  ["Crédito mensual en billetera", (x) => (x.monthlyCredit ? money(x.monthlyCredit) : "—")],
  ["Concierge 24/7", (x) => (x.concierge ? "✓" : "—")],
  ["Matchmaker personal", (x) => (x.matchmaker ? "✓" : "—")],
];

export default async function Memberships({ searchParams }: { searchParams: SP }) {
  const t = await getT();
  const user = await requireUser();
  const q = await searchParams;
  const current = tierById(user.tier);
  const sub = one<{ expires_at: string; period: string }>("SELECT expires_at, period FROM subscriptions WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1", user.id);

  return (
    <div>
      <PageHeader title={t("Membresías")} subtitle={t("Del acceso esencial al lujo absoluto. Precios con IVA incluido; el plan anual equivale a 10 meses.")} />
      <Flash ok={sp(q.ok)} error={sp(q.error)} />
      <div className="card mb-8 text-sm">
        {t("Tu plan actual:")}{" "}<span className="text-glow">{current.name}</span>
        {sub && <span className="text-muted"> · {t(sub.period === "yearly" ? "anual, renueva el {date}" : "mensual, renueva el {date}", { date: sub.expires_at.slice(0, 10) })}</span>}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {TIERS.map((x) => (
          <div key={x.id} className={`card flex flex-col gap-4 ${x.id === current.id ? "border-brand" : ""} ${x.id === "royal" ? "bg-gradient-to-b from-brand/15 to-ink-2" : ""}`}>
            <div>
              <div className="font-display text-2xl">{x.name}</div>
              <div className="mt-1 text-glow">{x.monthly ? t("{price}/mes", { price: money(x.monthly) }) : t("Gratis")}</div>
              {x.yearly > 0 && <div className="text-xs text-muted">{t("o {price}/año", { price: money(x.yearly) })}</div>}
            </div>
            <p className="text-sm text-muted">{t(x.tagline)}</p>
            <ul className="space-y-1.5 text-sm">{x.benefits.map((b) => <li key={b}>✦ {t(b)}</li>)}</ul>
            <div className="mt-auto space-y-2">
              {x.id === current.id ? (
                <div className="chip-brand w-full justify-center py-2">{t("Plan actual")}</div>
              ) : x.monthly > 0 && x.rank > current.rank ? (
                (["monthly", "yearly"] as const).map((period) => (
                  <form key={period} action={subscribe}>
                    <input type="hidden" name="tier" value={x.id} />
                    <input type="hidden" name="period" value={period} />
                    <button className={`${period === "monthly" ? "btn-brand" : "btn-ghost"} w-full`} type="submit">
                      {period === "monthly" ? t("Mensual") : t("Anual (-17%)")}
                    </button>
                  </form>
                ))
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <section className="card mt-10 overflow-x-auto">
        <h2 className="h2 mb-4">{t("Comparativa")}</h2>
        <table className="tbl">
          <thead><tr><th>{t("Beneficio")}</th>{TIERS.map((x) => <th key={x.id}>{x.name}</th>)}</tr></thead>
          <tbody>
            {ROWS.map(([label, fn]) => (
              <tr key={label}><td className="text-muted">{t(label)}</td>{TIERS.map((x) => <td key={x.id}>{t(fn(x))}</td>)}</tr>
            ))}
            <tr><td className="text-muted">{t("Salas TWO LOVE")}</td><td>—</td><td>{t("Café Privé")}</td><td>Platinum</td><td>{t("Platinum + Diamond")}</td><td>{t("Todas + Royal")}</td></tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
