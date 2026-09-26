import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { one } from "@/lib/db";
import { age, csv, getProfile, isBlockedBetween, isFullyVerified, ratingSummary, walletBalance } from "@/lib/users";
import { archetypeLabel, COMPANION_RULES, PROVIDER_COMMISSION, RATE_UNITS, VAT_RATE, tierById } from "@/lib/catalog";
import { money, pct } from "@/lib/money";
import { quoteCompanion } from "@/lib/ledger";
import { bookCompanion } from "../../actions/commerce";
import { Flash, Portrait, sp, Stars, TierBadge, type SP } from "@/components/ui";
import { getT } from "@/lib/i18n";

type Offer = { headline: string; activities: string } & Record<`rate_${string}`, number | null>;

export default async function CompanionDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const t = await getT();
  const user = await requireUser();
  const { id } = await params;
  const q = await searchParams;
  const p = getProfile(Number(id));
  const offer = p && one<Offer>("SELECT * FROM companion_offers WHERE user_id = ? AND active = 1", p.user_id);
  if (!p || !offer || isBlockedBetween(user.id, p.user_id) || !isFullyVerified(p.user_id)) notFound();
  const tier = tierById(user.tier);
  const rating = ratingSummary(p.user_id);
  const wallet = walletBalance(user.id);
  const units = RATE_UNITS.filter((u) => offer[`rate_${u.id}`]);
  const minStart = new Date(Date.now() + 2 * 3_600_000).toISOString().slice(0, 16);

  return (
    <div>
      <Flash ok={sp(q.ok)} error={sp(q.error)} />
      <div className="grid gap-8 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-2">
          <div className="card aspect-[3/4] overflow-hidden p-0"><Portrait name={p.name} hue={p.hue} photo={p.photo_path} /></div>
          <Link href={`/perfil/${p.user_id}`} className="btn-ghost w-full">{t("Ver perfil completo")}</Link>
        </div>
        <div className="space-y-6 lg:col-span-3">
          <div>
            <div className="flex gap-2"><span className="chip-gold">{t("Acompañamiento social")}</span><TierBadge tier={p.tier} /></div>
            <h1 className="h1 mt-3">{p.name}{age(p) ? `, ${age(p)}` : ""}</h1>
            <p className="text-gold-2">{offer.headline}</p>
            <p className="text-sm text-muted">{t(p.city)} · {t(archetypeLabel(p.archetype))} · {csv(p.languages).map((l) => t(l)).join(", ")}</p>
            <div className="mt-2"><Stars value={rating.avg} count={rating.n} /></div>
          </div>
          <p>{p.bio}</p>
          <div className="flex flex-wrap gap-2">{csv(offer.activities).map((a) => <span key={a} className="chip">{t(a)}</span>)}</div>

          <div className="card">
            <h2 className="h2">{t("Tarifas")}</h2>
            <table className="tbl mt-3">
              <thead><tr><th>{t("Modalidad")}</th><th>{t("Tarifa")}</th><th>{t("Ejemplo total ({tier})", { tier: tier.name })}</th></tr></thead>
              <tbody>
                {units.map((u) => {
                  const quote = quoteCompanion(offer[`rate_${u.id}`]!, 1, tier.serviceFee, PROVIDER_COMMISSION, VAT_RATE);
                  return (
                    <tr key={u.id}>
                      <td>{t(u.per)}</td>
                      <td className="text-gold-2">{money(offer[`rate_${u.id}`]!)}</td>
                      <td className="text-muted">{money(quote.total)} <span className="text-xs">{t("(incl. tarifa {fee} + IVA)", { fee: pct(tier.serviceFee) })}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {p.user_id !== user.id && (
            <form action={bookCompanion} className="card space-y-4 border-gold/40">
              <h2 className="h2">{t("Solicitar reserva")}</h2>
              <input type="hidden" name="provider" value={p.user_id} />
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <label className="label" htmlFor="unit">{t("Modalidad")}</label>
                  <select className="input" id="unit" name="unit">{units.map((u) => <option key={u.id} value={u.id}>{t(u.per)}</option>)}</select>
                </div>
                <div>
                  <label className="label" htmlFor="quantity">{t("Cantidad")}</label>
                  <input className="input" id="quantity" name="quantity" type="number" min={1} max={12} defaultValue={1} required />
                </div>
                <div>
                  <label className="label" htmlFor="start_at">{t("Inicio")}</label>
                  <input className="input" id="start_at" name="start_at" type="datetime-local" min={minStart} required />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="activity">{t("Actividad")}</label>
                <select className="input" id="activity" name="activity">{csv(offer.activities).map((a) => <option key={a} value={a}>{t(a)}</option>)}</select>
              </div>
              <div>
                <label className="label" htmlFor="notes">{t("Detalles del evento")}</label>
                <textarea className="input" id="notes" name="notes" maxLength={500} placeholder={t("Lugar, código de vestimenta, idioma preferido…")} />
              </div>
              <ul className="list-disc space-y-1 ps-5 text-xs text-muted">{COMPANION_RULES.map((r) => <li key={r}>{r}</li>)}</ul>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="check" name="rules" required />{" "}{t("Acepto el código de acompañamiento social")}</label>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm text-muted">{t("Saldo disponible:")}{" "}<span className="text-gold-2">{money(wallet.balance)}</span></span>
                <button className="btn-gold" type="submit">{t("Solicitar y poner en custodia")}</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
