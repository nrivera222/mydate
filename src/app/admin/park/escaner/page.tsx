import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { one } from "@/lib/db";
import { getT } from "@/lib/i18n";
import { clp } from "@/lib/money";
import { hoursUntil, productById, stampById } from "@/lib/park-catalog";
import type { ParkBooking } from "@/lib/park";
import { parkCancelAdmin, parkCheckIn, parkComplete, parkNoShow } from "../../../actions/park";
import { Flash, PageHeader, sp, type SP } from "@/components/ui";
import { QrScanner } from "@/components/QrScanner";

const STATUS = { reservada: "Reservada", en_curso: "En curso", completada: "Completada", cancelada: "Cancelada", no_show: "No presentada" } as Record<string, string>;

// Escáner de la puerta del local: lee el QR de la reserva (cámara o teclado) y permite el check-in al momento.
export default async function DoorScanner({ searchParams }: { searchParams: SP }) {
  const t = await getT();
  await requireAdmin();
  const q = await searchParams;
  const code = (sp(q.qr) ?? "").trim().slice(0, 40);
  const b = code
    ? one<ParkBooking & { name: string; partner: string | null; venue: string; voucher: string | null }>(
        `SELECT b.*, u.name, pu.name AS partner, v.name AS venue, pv.code AS voucher FROM park_bookings b JOIN users u ON u.id = b.user_id
         LEFT JOIN users pu ON pu.id = b.partner_id JOIN park_venues v ON v.id = b.venue_id LEFT JOIN park_vouchers pv ON pv.id = b.voucher_id
         WHERE upper(b.qr) = upper(?)`, code)
    : undefined;
  const p = b ? productById(b.product) : undefined;
  const hours = b ? hoursUntil(b.slot_at) : 0;
  const back = <input type="hidden" name="back" value="/admin/park/escaner" />;
  const hidden = b ? <input type="hidden" name="booking" value={b.id} /> : null;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("Escáner de la puerta")} subtitle={t("Lee el código QR de la reserva con la cámara o escríbelo para hacer el check-in.")}>
        <Link href="/admin/park" className="btn-ghost">{t("Volver a la agenda")}</Link>
      </PageHeader>
      <Flash ok={sp(q.ok)} error={sp(q.error)} />
      <div className="grid gap-6 md:grid-cols-2">
        <section className="card space-y-4">
          <QrScanner labels={{ start: t("Abrir cámara"), stop: t("Cerrar cámara"), unsupported: t("Este navegador no lee QR con la cámara: escribe el código."), denied: t("No se pudo abrir la cámara.") }} />
          <form action="/admin/park/escaner" className="flex gap-2">
            <input className="input font-mono uppercase" name="qr" defaultValue={code} placeholder="TLP-XXXXXXXXXXXX" aria-label={t("Código de la reserva")} autoFocus />
            <button className="btn-brand" type="submit">{t("Buscar")}</button>
          </form>
        </section>
        <section className="card">
          {!code ? <p className="text-muted">{t("Esperando un código…")}</p> : !b ? (
            <p className="text-rose">{t("No existe ninguna reserva con el código {code}.", { code })}</p>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between"><span className="chip-brand">{t(STATUS[b.status] ?? b.status)}</span><span className="font-mono text-xs text-muted">{b.qr}</span></div>
              <div className="font-display text-2xl">{t(p?.name ?? b.product)}{b.destination ? ` · ${t(b.destination)}` : ""}</div>
              <div className="text-muted">{b.slot_at.slice(0, 16)} · {b.venue}
                {b.status === "reservada" && Math.abs(hours) > 1 && <span className={hours < 0 ? " text-rose" : " text-glow"}> · {hours < 0 ? t("hace {h} h", { h: Math.round(-hours) }) : t("en {h} h", { h: Math.round(hours) })}</span>}
              </div>
              <div>{b.name}{b.partner ? ` + ${b.partner}` : b.partner_name ? ` + ${b.partner_name}` : ""}</div>
              {b.minor ? <p className="rounded-xl border border-electric/50 bg-electric/10 p-2 text-electric">{t("Menores · tutor")}: {b.minor_names}. {t("Verifica la edad al ingresar: solo de día, sin alcohol ni fotos.")}</p> : null}
              {b.voucher && <p className="text-ok">🎁 {t("Pagada con tarjeta regalo {code}", { code: b.voucher })}</p>}
              <div>{t("Pagado {paid} de {total}", { paid: clp(b.paid), total: clp(b.total) })}{b.total > b.paid && <b className="text-glow"> · {t("Saldo por cobrar: {v}", { v: clp(b.total - b.paid) })}</b>}</div>
              <div className="text-muted">{p?.stamps.map((s) => `${stampById(s)?.icon} ${t(stampById(s)?.label ?? s)}`).join(" · ")}</div>
              {b.notes && <p className="rounded-xl bg-ink-3 p-2">📝 {b.notes}</p>}
              <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                {b.status === "reservada" && (
                  <>
                    <form action={parkCheckIn} className="flex items-center gap-1">{back}{hidden}
                      <select name="method" className="input w-auto py-1 text-xs" aria-label={t("Cobro del saldo")}>
                        <option value="wallet">{t("Saldo desde billetera")}</option>
                        <option value="local">{t("Pagado en el local")}</option>
                      </select>
                      <button className="btn-brand px-4 py-1.5" type="submit">{t("Check-in")}</button>
                    </form>
                    <form action={parkNoShow}>{back}{hidden}<button className="btn-ghost px-4 py-1.5" type="submit">{t("No vino")}</button></form>
                    <form action={parkCancelAdmin}>{back}{hidden}<button className="btn-danger px-4 py-1.5" type="submit">{t("Cancelar")}</button></form>
                  </>
                )}
                {b.status === "en_curso" && <form action={parkComplete}>{back}{hidden}<button className="btn-brand px-4 py-1.5" type="submit">{t("Completar y sellar")}</button></form>}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
