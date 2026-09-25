import { requireUser } from "@/lib/auth";
import { one } from "@/lib/db";
import { TIERS, tierById } from "@/lib/catalog";
import { money, pct } from "@/lib/money";
import { subscribe } from "../actions/commerce";
import { Flash, PageHeader, sp, type SP } from "@/components/ui";

const ROWS: [string, (t: (typeof TIERS)[number]) => string][] = [
  ["Likes diarios", (t) => (t.dailyLikes < 0 ? "Ilimitados" : String(t.dailyLikes))],
  ["Super Likes diarios", (t) => (t.superLikes < 0 ? "Ilimitados" : String(t.superLikes))],
  ["Ver quién te dio like", (t) => (t.seeLikes ? "✓" : "—")],
  ["Modo incógnito", (t) => (t.incognito ? "✓" : "—")],
  ["Tarifa de servicio en reservas", (t) => pct(t.serviceFee)],
  ["Descuento en regalos", (t) => (t.giftDiscount ? pct(t.giftDiscount) : "—")],
  ["Crédito mensual en billetera", (t) => (t.monthlyCredit ? money(t.monthlyCredit) : "—")],
  ["Concierge 24/7", (t) => (t.concierge ? "✓" : "—")],
  ["Matchmaker personal", (t) => (t.matchmaker ? "✓" : "—")],
];

export default async function Memberships({ searchParams }: { searchParams: SP }) {
  const user = await requireUser();
  const q = await searchParams;
  const current = tierById(user.tier);
  const sub = one<{ expires_at: string; period: string }>("SELECT expires_at, period FROM subscriptions WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1", user.id);

  return (
    <div>
      <PageHeader title="Membresías" subtitle="Del acceso esencial al lujo absoluto. Precios con IVA incluido; el plan anual equivale a 10 meses." />
      <Flash ok={sp(q.ok)} error={sp(q.error)} />
      <div className="card mb-8 text-sm">
        Tu plan actual: <span className="text-gold-2">{current.name}</span>
        {sub && <span className="text-muted"> · {sub.period === "yearly" ? "anual" : "mensual"}, renueva el {sub.expires_at.slice(0, 10)}</span>}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {TIERS.map((t) => (
          <div key={t.id} className={`card flex flex-col gap-4 ${t.id === current.id ? "border-gold" : ""} ${t.id === "royal" ? "bg-gradient-to-b from-gold/15 to-ink-2" : ""}`}>
            <div>
              <div className="font-display text-2xl">{t.name}</div>
              <div className="mt-1 text-gold-2">{t.monthly ? `${money(t.monthly)}/mes` : "Gratis"}</div>
              {t.yearly > 0 && <div className="text-xs text-muted">o {money(t.yearly)}/año</div>}
            </div>
            <p className="text-sm text-muted">{t.tagline}</p>
            <ul className="space-y-1.5 text-sm">{t.benefits.map((b) => <li key={b}>✦ {b}</li>)}</ul>
            <div className="mt-auto space-y-2">
              {t.id === current.id ? (
                <div className="chip-gold w-full justify-center py-2">Plan actual</div>
              ) : t.monthly > 0 && t.rank > current.rank ? (
                (["monthly", "yearly"] as const).map((period) => (
                  <form key={period} action={subscribe}>
                    <input type="hidden" name="tier" value={t.id} />
                    <input type="hidden" name="period" value={period} />
                    <button className={`${period === "monthly" ? "btn-gold" : "btn-ghost"} w-full`} type="submit">
                      {period === "monthly" ? "Mensual" : "Anual (-17%)"}
                    </button>
                  </form>
                ))
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <section className="card mt-10 overflow-x-auto">
        <h2 className="h2 mb-4">Comparativa</h2>
        <table className="tbl">
          <thead><tr><th>Beneficio</th>{TIERS.map((t) => <th key={t.id}>{t.name}</th>)}</tr></thead>
          <tbody>
            {ROWS.map(([label, fn]) => (
              <tr key={label}><td className="text-muted">{label}</td>{TIERS.map((t) => <td key={t.id}>{fn(t)}</td>)}</tr>
            ))}
            <tr><td className="text-muted">Salas TWO LOVE</td><td>—</td><td>Café Privé</td><td>Platinum</td><td>Platinum + Diamond</td><td>Todas + Royal</td></tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
