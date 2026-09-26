import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { walletBalance } from "@/lib/users";
import { FX, REFERRAL_REWARD, REFERRAL_WELCOME } from "@/lib/catalog";
import { one } from "@/lib/db";
import { paymentsEnabled } from "@/lib/payments";
import { money } from "@/lib/money";
import { topUp, withdraw } from "../actions/commerce";
import { Flash, PageHeader, sp, Stat, type SP } from "@/components/ui";
import { getT } from "@/lib/i18n";

const TX_LABEL: Record<string, string> = {
  recarga: "Recarga", bono: "Bono", suscripcion: "Membresía", regalo: "Regalo enviado", regalo_recibido: "Regalo recibido", custodia: "Custodia",
  reembolso: "Reembolso", ganancia: "Ganancia", sala: "Sala TWO LOVE", seguro: "Seguro de vida", retiro: "Retiro", evento: "Evento",
};

export default async function Wallet({ searchParams }: { searchParams: SP }) {
  const t = await getT();
  const user = await requireUser();
  const q = await searchParams;
  const cur = FX[sp(q.cur) ?? ""] ? sp(q.cur)! : "AED";
  const w = walletBalance(user.id);
  const txs = all<{ id: number; type: string; amount: number; balance_after: number; description: string; created_at: string }>(
    "SELECT * FROM wallet_tx WHERE user_id = ? ORDER BY id DESC LIMIT 50", user.id,
  );
  const me = one<{ referral_code: string }>("SELECT referral_code FROM users WHERE id = ?", user.id)!;
  const referrals = one<{ invited: number; converted: number }>(
    `SELECT COUNT(*) AS invited, SUM(EXISTS (SELECT 1 FROM subscriptions s WHERE s.user_id = u.id)) AS converted FROM users u WHERE u.referred_by = ?`, user.id,
  )!;
  const referralEarnings = one<{ v: number }>("SELECT COALESCE(SUM(amount), 0) AS v FROM wallet_tx WHERE user_id = ? AND ref LIKE 'referral:%' AND description LIKE 'Recompensa%'", user.id)!.v;
  const live = paymentsEnabled();
  const earned = txs.filter((x) => x.type === "ganancia" || x.type === "regalo_recibido").reduce((a, x) => a + x.amount, 0);

  return (
    <div>
      <PageHeader title={t("Billetera digital")} subtitle={t("Recarga saldo para regalos, reservas, Salas y membresías. Los pagos de acompañamiento quedan en custodia hasta finalizar.")}>
        <div className="flex gap-1">
          {Object.keys(FX).map((c) => <Link key={c} href={`/billetera?cur=${c}`} className={c === cur ? "chip-gold" : "chip"}>{c}</Link>)}
        </div>
      </PageHeader>
      <Flash ok={sp(q.ok)} error={sp(q.error)} />

      <div className="grid gap-4 md:grid-cols-3">
        <Stat label={t("Saldo disponible")} value={money(w.balance, cur)} />
        <Stat label={t("En custodia")} value={money(w.held, cur)} hint={t("Reservas pendientes de finalizar")} />
        <Stat label={t("Ganancias recientes")} value={money(earned, cur)} hint={t("Acompañamiento y regalos recibidos")} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <form action={topUp} className="card space-y-4">
          <h2 className="h2">{t("Recargar")}</h2>
          <div className="grid grid-cols-4 gap-2">
            {[500, 2000, 10000, 50000].map((a) => (
              <label key={a} className="cursor-pointer rounded-xl border border-line p-3 text-center text-sm has-[:checked]:border-gold">
                <input type="radio" name="amount" value={a} className="sr-only" defaultChecked={a === 2000} />
                {money(a * 100)}
              </label>
            ))}
          </div>
          <div>
            <label className="label" htmlFor="method">{t("Método de pago")}</label>
            <select className="input" id="method" name="method">
              <option value="tarjeta">{t("Tarjeta de crédito / débito")}</option>
              <option value="apple_pay">{t("Apple Pay")}</option>
              <option value="transferencia">{t("Transferencia bancaria (EAU)")}</option>
              <option value="cripto">{t("USDC / Cripto (vía aliado regulado)")}</option>
            </select>
          </div>
          <button className="btn-gold w-full" type="submit">{live ? t("Pagar con Stripe") : t("Recargar saldo")}</button>
          <p className="text-xs text-muted">{live ? t("Serás redirigido a la pasarela segura de Stripe (PCI-DSS). El saldo se abona al confirmarse el pago.") : t("Modo demostración: la recarga se aprueba al instante. Define STRIPE_SECRET_KEY para cobrar con tarjeta real.")}</p>
        </form>

        <form action={withdraw} className="card space-y-4">
          <h2 className="h2">{t("Retirar ganancias")}</h2>
          <div>
            <label className="label" htmlFor="w_amount">{t("Importe (AED)")}</label>
            <input className="input" id="w_amount" name="amount" type="number" min={100} step="1" required />
          </div>
          <div>
            <label className="label" htmlFor="iban">{t("IBAN")}</label>
            <input className="input" dir="ltr" id="iban" name="iban" placeholder={t("AE07 0331 2345 6789 0123 456")} required />
          </div>
          <button className="btn-ghost w-full" type="submit">{t("Solicitar retiro")}</button>
          <p className="text-xs text-muted">{t("Los retiros se revisan por cumplimiento AML/KYC y se abonan en 1–3 días hábiles.")}</p>
        </form>
      </div>

      <section id="invitar" className="card mt-8 grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <h2 className="h2">{t("Invita y gana")}</h2>
          <p className="mt-2 text-sm text-muted">
            {t("Invita a personas de tu círculo. Reciben {welcome} extra al registrarse y tú ganas {reward} cuando contratan su primera membresía.", { welcome: money(REFERRAL_WELCOME), reward: money(REFERRAL_REWARD) })}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="rounded-xl border border-gold/40 px-4 py-2 font-mono text-lg tracking-widest text-gold-2">{me.referral_code}</span>
            <code className="break-all text-xs text-muted" dir="ltr">/registro?ref={me.referral_code}</code>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center md:grid-cols-1 md:text-start">
          <div><div className="label">{t("Invitados")}</div><div className="text-xl">{referrals.invited}</div></div>
          <div><div className="label">{t("Convertidos")}</div><div className="text-xl">{referrals.converted ?? 0}</div></div>
          <div><div className="label">{t("Ganado")}</div><div className="text-xl text-gold-2">{money(referralEarnings, cur)}</div></div>
        </div>
      </section>

      <section className="card mt-8 overflow-x-auto">
        <h2 className="h2 mb-3">{t("Movimientos")}</h2>
        <table className="tbl">
          <thead><tr><th>{t("Fecha")}</th><th>{t("Concepto")}</th><th>{t("Tipo")}</th><th className="text-end">{t("Importe")}</th><th className="text-end">{t("Saldo")}</th></tr></thead>
          <tbody>
            {txs.map((x) => (
              <tr key={x.id}>
                <td className="whitespace-nowrap text-muted">{x.created_at.slice(0, 16)}</td>
                <td>{t.msg(x.description)}</td>
                <td><span className="chip">{t(TX_LABEL[x.type] ?? x.type)}</span></td>
                <td className={`text-end tabular-nums ${x.amount >= 0 ? "text-ok" : "text-ivory"}`}>{x.amount >= 0 ? "+" : ""}{money(x.amount, cur)}</td>
                <td className="text-end tabular-nums text-muted">{money(x.balance_after, cur)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
