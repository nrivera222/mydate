import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { walletBalance } from "@/lib/users";
import { FX } from "@/lib/catalog";
import { money } from "@/lib/money";
import { topUp, withdraw } from "../actions/commerce";
import { Flash, PageHeader, sp, Stat, type SP } from "@/components/ui";

const TX_LABEL: Record<string, string> = {
  recarga: "Recarga", bono: "Bono", suscripcion: "Membresía", regalo: "Regalo enviado", regalo_recibido: "Regalo recibido", custodia: "Custodia",
  reembolso: "Reembolso", ganancia: "Ganancia", sala: "Sala TWO LOVE", seguro: "Seguro de vida", retiro: "Retiro",
};

export default async function Wallet({ searchParams }: { searchParams: SP }) {
  const user = await requireUser();
  const q = await searchParams;
  const cur = FX[sp(q.cur) ?? ""] ? sp(q.cur)! : "AED";
  const w = walletBalance(user.id);
  const txs = all<{ id: number; type: string; amount: number; balance_after: number; description: string; created_at: string }>(
    "SELECT * FROM wallet_tx WHERE user_id = ? ORDER BY id DESC LIMIT 50", user.id,
  );
  const earned = txs.filter((t) => t.type === "ganancia" || t.type === "regalo_recibido").reduce((a, t) => a + t.amount, 0);

  return (
    <div>
      <PageHeader title="Billetera digital" subtitle="Recarga saldo para regalos, reservas, Salas y membresías. Los pagos de acompañamiento quedan en custodia hasta finalizar.">
        <div className="flex gap-1">
          {Object.keys(FX).map((c) => <Link key={c} href={`/billetera?cur=${c}`} className={c === cur ? "chip-gold" : "chip"}>{c}</Link>)}
        </div>
      </PageHeader>
      <Flash ok={sp(q.ok)} error={sp(q.error)} />

      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="Saldo disponible" value={money(w.balance, cur)} />
        <Stat label="En custodia" value={money(w.held, cur)} hint="Reservas pendientes de finalizar" />
        <Stat label="Ganancias recientes" value={money(earned, cur)} hint="Acompañamiento y regalos recibidos" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <form action={topUp} className="card space-y-4">
          <h2 className="h2">Recargar</h2>
          <div className="grid grid-cols-4 gap-2">
            {[500, 2000, 10000, 50000].map((a) => (
              <label key={a} className="cursor-pointer rounded-xl border border-line p-3 text-center text-sm has-[:checked]:border-gold">
                <input type="radio" name="amount" value={a} className="sr-only" defaultChecked={a === 2000} />
                {money(a * 100)}
              </label>
            ))}
          </div>
          <div>
            <label className="label" htmlFor="method">Método de pago</label>
            <select className="input" id="method" name="method">
              <option value="tarjeta">Tarjeta de crédito / débito</option>
              <option value="apple_pay">Apple Pay</option>
              <option value="transferencia">Transferencia bancaria (EAU)</option>
              <option value="cripto">USDC / Cripto (vía aliado regulado)</option>
            </select>
          </div>
          <button className="btn-gold w-full" type="submit">Recargar saldo</button>
          <p className="text-xs text-muted">Entorno de demostración: la recarga se aprueba al instante. En producción se procesa vía pasarela PCI-DSS.</p>
        </form>

        <form action={withdraw} className="card space-y-4">
          <h2 className="h2">Retirar ganancias</h2>
          <div>
            <label className="label" htmlFor="w_amount">Importe (AED)</label>
            <input className="input" id="w_amount" name="amount" type="number" min={100} step="1" required />
          </div>
          <div>
            <label className="label" htmlFor="iban">IBAN</label>
            <input className="input" id="iban" name="iban" placeholder="AE07 0331 2345 6789 0123 456" required />
          </div>
          <button className="btn-ghost w-full" type="submit">Solicitar retiro</button>
          <p className="text-xs text-muted">Los retiros se revisan por cumplimiento AML/KYC y se abonan en 1–3 días hábiles.</p>
        </form>
      </div>

      <section className="card mt-8 overflow-x-auto">
        <h2 className="h2 mb-3">Movimientos</h2>
        <table className="tbl">
          <thead><tr><th>Fecha</th><th>Concepto</th><th>Tipo</th><th className="text-right">Importe</th><th className="text-right">Saldo</th></tr></thead>
          <tbody>
            {txs.map((t) => (
              <tr key={t.id}>
                <td className="whitespace-nowrap text-muted">{t.created_at.slice(0, 16)}</td>
                <td>{t.description}</td>
                <td><span className="chip">{TX_LABEL[t.type] ?? t.type}</span></td>
                <td className={`text-right tabular-nums ${t.amount >= 0 ? "text-ok" : "text-ivory"}`}>{t.amount >= 0 ? "+" : ""}{money(t.amount, cur)}</td>
                <td className="text-right tabular-nums text-muted">{money(t.balance_after, cur)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
