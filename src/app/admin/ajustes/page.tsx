import { requireAdmin } from "@/lib/auth";
import { one } from "@/lib/db";
import { getT } from "@/lib/i18n";
import { clp, money } from "@/lib/money";
import { clpToFils, PARK_PRODUCTS } from "@/lib/park-catalog";
import { clpPerAed, SETTINGS, settingsLog } from "@/lib/settings";
import { updateFxRate } from "../../actions/admin";
import { Flash, PageHeader, sp, type SP } from "@/components/ui";

export default async function Settings({ searchParams }: { searchParams: SP }) {
  const t = await getT();
  await requireAdmin();
  const q = await searchParams;
  const rate = clpPerAed();
  const log = settingsLog("clp_per_aed");
  const pending = one<{ n: number; v: number }>("SELECT COUNT(*) AS n, COALESCE(SUM(total - paid), 0) AS v FROM park_bookings WHERE status = 'reservada'")!;
  const sample = PARK_PRODUCTS.filter((p) => ["clasica", "completa", "aniversario"].includes(p.id));

  return (
    <div>
      <PageHeader title={t("Ajustes del ecosistema")} subtitle={t("Parámetros que conectan TWO LOVE Private (AED) y TWO LOVE Park (CLP). Cada cambio queda registrado.")} />
      <Flash ok={sp(q.ok)} error={sp(q.error)} />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card space-y-4">
          <h2 className="h2">{t(SETTINGS.clp_per_aed.label)}</h2>
          <div className="font-display text-4xl text-glow">1 AED = {clp(rate)}</div>
          <p className="text-sm text-muted">{t("La billetera del ecosistema opera en AED. Los precios del Park están en CLP y se cobran al tipo vigente al reservar; cada reserva guarda su tipo para cobrar el saldo y devolver anticipos sin diferencias.")}</p>
          <form action={updateFxRate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="value">{t("CLP por AED")}</label>
                <input className="input" id="value" name="value" type="number" step="0.01" min={SETTINGS.clp_per_aed.min} max={SETTINGS.clp_per_aed.max} defaultValue={rate} required />
              </div>
              <div>
                <label className="label" htmlFor="note">{t("Motivo")}</label>
                <input className="input" id="note" name="note" maxLength={200} placeholder={t("Ej.: tipo del Banco Central")} />
              </div>
            </div>
            <button className="btn-brand" type="submit">{t("Guardar tipo de cambio")}</button>
          </form>
          <p className="text-xs text-muted">{t("{n} reservas pendientes con saldo por cobrar de {v}: mantienen el tipo con que se reservaron.", { n: pending.n, v: clp(pending.v) })}</p>
        </section>
        <section className="card">
          <h2 className="h2">{t("Vista previa en la billetera")}</h2>
          <table className="tbl mt-3">
            <tbody>
              {sample.map((p) => (
                <tr key={p.id}><td>{t(p.name)}</td><td className="text-end">{clp(p.price)}</td><td className="text-end text-glow">≈ {money(clpToFils(p.price, rate))}</td></tr>
              ))}
            </tbody>
          </table>
          <h2 className="h2 mt-6">{t("Historial")}</h2>
          {log.length === 0 ? <p className="mt-2 text-sm text-muted">{t("Sin cambios: se usa el valor por defecto ({v}).", { v: SETTINGS.clp_per_aed.default })}</p> : (
            <table className="tbl mt-3">
              <tbody>
                {log.map((l, i) => (
                  <tr key={i}><td className="text-muted">{l.created_at.slice(0, 16)}</td><td>{l.old_value ?? "—"} → <b>{l.new_value}</b></td><td className="text-muted">{l.name ?? ""}{l.note ? ` · ${l.note}` : ""}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
