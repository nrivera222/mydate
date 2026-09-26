import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { one, transaction } from "@/lib/db";
import { getT } from "@/lib/i18n";
import { clp } from "@/lib/money";
import { tierById } from "@/lib/catalog";
import { CLUB, PASSPORT_REWARD_CLP, STAMPS, daysTogether, milestones, productById } from "@/lib/park-catalog";
import { clubStatus, coupleOf, remindMilestones, stampsOf } from "@/lib/park";
import { cancelClub, createCouple, endCouple, joinClub, joinCouple } from "../../actions/park";
import { Flash, PageHeader, sp, type SP } from "@/components/ui";
import { ParkNav } from "@/components/ParkNav";

export default async function Passport({ searchParams }: { searchParams: SP }) {
  const t = await getT();
  const user = await requireUser();
  const q = await searchParams;
  transaction((conn) => remindMilestones(conn, user.id));
  const couple = coupleOf(user.id);
  const stamps = new Map(stampsOf(user.id).map((s) => [s.stamp, s.created_at]));
  const rewarded = !!one("SELECT 1 FROM wallet_tx WHERE ref = ?", `park_passport:${user.id}`);
  const club = clubStatus(user.id, user.tier);
  const days = couple ? daysTogether(couple.since) : 0;
  const next = couple ? milestones(couple.since).slice(0, 4) : [];
  const partnerLabel = couple ? couple.partner ?? (couple.partner_name || t("tu pareja")) : "";
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <ParkNav active="/park/pasaporte" />
      <PageHeader title={t("Pasaporte del amor")} subtitle={t("Sellos, contador de días y Two Love Club: razones para volver.")} />
      <Flash ok={sp(q.ok)} error={sp(q.error)} />

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="h2">{t("Sellos")}</h2>
            <span className="chip-brand">{stamps.size}/{STAMPS.length}</span>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-6">
            {STAMPS.map((s) => {
              const got = stamps.get(s.id);
              return (
                <div key={s.id} className={`flex flex-col items-center gap-2 rounded-2xl border p-3 text-center ${got ? "border-brand bg-brand/15 shadow-[0_0_24px_rgba(139,92,246,.35)]" : "border-dashed border-line opacity-60"}`}>
                  <span className={`text-3xl ${got ? "" : "grayscale"}`}>{s.icon}</span>
                  <span className="text-xs">{t(s.label)}</span>
                  <span className="text-[10px] text-muted">{got ? got.slice(0, 10) : t("Pendiente")}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-ink-3"><div className="h-full rounded-full bg-linear-to-r from-electric via-brand to-magenta" style={{ width: `${(stamps.size / STAMPS.length) * 100}%` }} /></div>
          <p className="mt-3 text-sm text-muted">
            {rewarded ? t("¡Pasaporte completo! Ya recibisteis vuestra Cita Clásica de regalo.") : t("Completa los {n} sellos y te regalamos una Cita Clásica ({amount}).", { n: STAMPS.length, amount: clp(PASSPORT_REWARD_CLP) })}
          </p>
        </section>

        <section className="card border-brand/40">
          <h2 className="h2">{t("Two Love Club")}</h2>
          {club.active ? (
            <div className="mt-3 space-y-2 text-sm">
              <span className="chip-brand">{club.included ? t("Incluido en tu membresía {tier}", { tier: tierById(user.tier).name }) : t("Activo")}</span>
              {club.expires && <p className="text-muted">{club.renew ? t("Renueva el {date}", { date: club.expires.slice(0, 10) }) : t("Activo hasta el {date}", { date: club.expires.slice(0, 10) })}</p>}
              <ul className="space-y-1 text-muted">{CLUB.benefits.map((b) => <li key={b}>✦ {t(b)}</li>)}</ul>
              <p className="rounded-xl bg-brand/10 p-3 text-glow">{t("Beneficio de este mes: foto y cápsula. Pídelas en tu próxima visita.")}</p>
              {!club.included && club.own && (
                <div className="flex gap-2 pt-2">
                  <form action={joinClub}><button className="btn-ghost" type="submit">{t("Renovar 1 mes")}</button></form>
                  {club.renew && <form action={cancelClub}><button className="text-xs text-muted underline hover:text-rose" type="submit">{t("No renovar")}</button></form>}
                </div>
              )}
            </div>
          ) : (
            <div className="mt-3 space-y-3 text-sm">
              <div className="text-3xl font-semibold text-glow">{clp(CLUB.price)}<span className="text-sm font-normal text-muted"> {t("al mes por pareja")}</span></div>
              <ul className="space-y-1 text-muted">{CLUB.benefits.map((b) => <li key={b}>✦ {t(b)}</li>)}</ul>
              <form action={joinClub}><button className="btn-brand w-full" type="submit">{t("Unirme al Club")}</button></form>
              <p className="text-xs text-muted">{t("Se cobra desde tu billetera TWO LOVE. Incluido en Diamond y Royal Black.")}</p>
            </div>
          )}
        </section>
      </div>

      <section className="card mt-6">
        <h2 className="h2">{t("Contador de días")}</h2>
        {couple ? (
          <div className="mt-4 grid gap-6 md:grid-cols-2">
            <div>
              <div className="font-display text-6xl brand-text">{days}</div>
              <p className="text-muted">{t("días con {name} · desde el {date}", { name: partnerLabel, date: couple.since })}</p>
              {!couple.user_b && couple.user_a === user.id && (
                <p className="mt-4 rounded-xl border border-line p-3 text-sm">{t("Comparte este código con tu pareja para que se una desde su cuenta:")} <span className="font-mono text-glow">{couple.code}</span></p>
              )}
              <form action={endCouple} className="mt-4"><button className="text-xs text-muted underline hover:text-rose" type="submit">{t("Cerrar contador")}</button></form>
            </div>
            <div>
              <div className="label">{t("Próximos hitos")}</div>
              <ul className="space-y-2">
                {next.map((m) => (
                  <li key={m.key} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2 text-sm">
                    <span><b>{t(m.label, { n: m.n })}</b> <span className="text-muted">· {m.days === 0 ? t("¡hoy!") : t("en {n} días", { n: m.days })} · {m.date}</span></span>
                    <Link className="text-glow whitespace-nowrap" href={`/park/reservar?p=${m.product}&d=${m.date}`}>{t(productById(m.product)?.name ?? "")} →</Link>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted">{t("Te avisamos 7 días antes de cada cumplemes, día 100, día 200 y aniversario.")}</p>
            </div>
          </div>
        ) : (
          <div className="mt-4 grid gap-6 md:grid-cols-2">
            <form action={createCouple} className="space-y-3">
              <p className="text-sm text-muted">{t("Empieza vuestro contador: cumplemes, día 100 y aniversarios con recordatorios.")}</p>
              <div>
                <label className="label" htmlFor="since">{t("¿Desde cuándo estáis juntos?")}</label>
                <input className="input" id="since" name="since" type="date" max={today} required />
              </div>
              <div>
                <label className="label" htmlFor="partner_name">{t("Nombre de tu pareja")}</label>
                <input className="input" id="partner_name" name="partner_name" maxLength={60} />
              </div>
              <button className="btn-brand" type="submit">{t("Crear contador")}</button>
            </form>
            <form action={joinCouple} className="space-y-3">
              <p className="text-sm text-muted">{t("¿Tu pareja ya lo creó? Únete con su código.")}</p>
              <div>
                <label className="label" htmlFor="code">{t("Código de pareja")}</label>
                <input className="input font-mono" id="code" name="code" placeholder="TLP-XXXXXXXX" required />
              </div>
              <button className="btn-ghost" type="submit">{t("Unirme")}</button>
            </form>
          </div>
        )}
        <p className="mt-4 text-xs text-muted">{t("Las fechas de pareja solo se usan para tus recordatorios, con tu consentimiento. Puedes cerrar el contador cuando quieras.")}</p>
      </section>
    </div>
  );
}
