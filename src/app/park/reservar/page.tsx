import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { getT } from "@/lib/i18n";
import { clp, money } from "@/lib/money";
import { walletBalance } from "@/lib/users";
import { CANCEL_FREE_HOURS, DEPOSIT_RATE, DESTINATIONS, PARK_PRODUCTS, PRODUCT_KIND_LABEL, clpToFils, productById, stampById, type ParkProductKind } from "@/lib/park-catalog";
import { coupleOf, parkDiscount, partnerOf, pilotVenue, slotsFor } from "@/lib/park";
import { bookPark } from "../../actions/park";
import { Empty, Flash, PageHeader, sp, type SP } from "@/components/ui";
import { ParkNav } from "@/components/ParkNav";

export default async function ParkBook({ searchParams }: { searchParams: SP }) {
  const t = await getT();
  const user = await requireUser();
  const q = await searchParams;
  const venue = pilotVenue();
  const product = productById(sp(q.p) ?? "") ?? PARK_PRODUCTS[1];
  const minor = sp(q.minor) === "1" && product.minors;
  const today = new Date().toISOString().slice(0, 10);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp(q.d) ?? "") && sp(q.d)! >= today ? sp(q.d)! : today;
  const now = new Date();
  const slots = venue ? slotsFor(venue.id, product, date, minor).filter((s) => date > today || s.hour > now.getHours() + 1) : [];
  const { rate, source } = parkDiscount(user.id, user.tier);
  const discount = Math.round(product.price * rate);
  const total = product.price - discount;
  const deposit = Math.round(total * DEPOSIT_RATE);
  const couple = coupleOf(user.id);
  const partnerId = partnerOf(couple, user.id);
  const matches = all<{ id: number; name: string }>(
    `SELECT u.id, u.name FROM likes a JOIN likes b ON b.from_id = a.to_id AND b.to_id = a.from_id JOIN users u ON u.id = a.to_id
     WHERE a.from_id = ? AND a.kind != 'pass' AND b.kind != 'pass' ORDER BY u.name`, user.id,
  ).filter((m) => m.id !== partnerId);
  const preselect = Number(sp(q.partner)) || partnerId || "";
  const kinds: ParkProductKind[] = ["cita", "paquete", "taller"];

  return (
    <div>
      <ParkNav active="/park/reservar" />
      <PageHeader title={t("Reservar en TWO LOVE Park")} subtitle={venue ? `${venue.name} · ${t(venue.city)}` : undefined} />
      <Flash ok={sp(q.ok)} error={sp(q.error)} />
      {!venue ? <Empty>{t("No hay locales abiertos.")}</Empty> : (
        <div className="grid gap-8 lg:grid-cols-5">
          <div className="space-y-6 lg:col-span-3">
            {kinds.map((k) => (
              <div key={k}>
                <div className="label">{t(PRODUCT_KIND_LABEL[k])}</div>
                <div className="flex flex-wrap gap-2">
                  {PARK_PRODUCTS.filter((p) => p.kind === k).map((p) => (
                    <Link key={p.id} href={`/park/reservar?${new URLSearchParams({ p: p.id, d: date, ...(sp(q.partner) ? { partner: sp(q.partner)! } : {}) })}`}
                      className={p.id === product.id ? "chip-brand px-3 py-1 text-sm" : "chip px-3 py-1 text-sm hover:text-glow"}>
                      {t(p.name)} · {clp(p.price)}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
            <div className="card">
              <div className="font-display text-2xl">{t(product.name)}</div>
              <p className="text-sm text-muted">{t("{min} minutos", { min: product.minutes })} · {product.stamps.map((s) => `${stampById(s)?.icon} ${t(stampById(s)?.label ?? s)}`).join(" · ")}</p>
              <ul className="mt-3 space-y-1 text-sm text-muted">{product.includes.map((i) => <li key={i}>✦ {t(i)}</li>)}</ul>
              {!product.minors && <p className="mt-3 text-xs text-rose">{t("Solo mayores de 18 años.")}</p>}
            </div>
            <form className="card flex flex-wrap items-end gap-3" action="/park/reservar">
              <input type="hidden" name="p" value={product.id} />
              {sp(q.partner) && <input type="hidden" name="partner" value={sp(q.partner)} />}
              <div>
                <label className="label" htmlFor="d">{t("Fecha")}</label>
                <input className="input" id="d" name="d" type="date" min={today} defaultValue={date} />
              </div>
              {product.minors && (
                <label className="flex items-center gap-2 pb-2 text-sm">
                  <input className="check" type="checkbox" name="minor" value="1" defaultChecked={minor} /> {t("Reserva de tutor (pareja de 14 a 17 años)")}
                </label>
              )}
              <button className="btn-ghost" type="submit">{t("Ver horarios")}</button>
            </form>
          </div>

          <aside className="lg:col-span-2">
            <form action={bookPark} className="card sticky top-32 space-y-4">
              <input type="hidden" name="product" value={product.id} />
              <input type="hidden" name="date" value={date} />
              {minor && <input type="hidden" name="minor" value="on" />}
              <div>
                <div className="label">{t("Horario · {date}", { date })}</div>
                {slots.length === 0 ? <p className="text-sm text-muted">{t("No quedan horarios este día.")}</p> : (
                  <div className="grid grid-cols-4 gap-2">
                    {slots.map((s, i) => (
                      <label key={s.hour} className={`flex cursor-pointer flex-col items-center rounded-xl border px-2 py-2 text-sm has-checked:border-brand has-checked:bg-brand/15 ${s.left <= 0 ? "pointer-events-none opacity-35" : "border-line"}`}>
                        <input className="sr-only" type="radio" name="hour" value={s.hour} disabled={s.left <= 0} defaultChecked={i === slots.findIndex((x) => x.left > 0)} required />
                        <span>{String(s.hour).padStart(2, "0")}:00</span>
                        <span className="text-[10px] text-muted">{s.left > 1 ? t("{n} libres", { n: s.left }) : s.left === 1 ? t("Libre") : t("Completo")}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              {product.id === "viaje" && (
                <div>
                  <label className="label" htmlFor="destination">{t("Destino")}</label>
                  <select className="input" id="destination" name="destination">{DESTINATIONS.map((x) => <option key={x} value={x}>{t(x)}</option>)}</select>
                </div>
              )}
              {minor ? (
                <div className="space-y-3 rounded-xl border border-electric/40 bg-electric/5 p-3 text-sm">
                  <p className="text-muted">{t("Reservas como tutor: la pareja menor de edad disfruta de la experiencia de día, sin alcohol y en zonas visibles. Sin fotos ni álbum.")}</p>
                  <div>
                    <label className="label" htmlFor="minor_names">{t("Nombres y edades")}</label>
                    <input className="input" id="minor_names" name="minor_names" maxLength={120} placeholder={t("Ej.: Martina (16) y Agustín (17)")} required />
                  </div>
                  <label className="flex items-start gap-2"><input className="check mt-1" type="checkbox" name="guardian" required /> <span>{t("Soy su madre, padre o tutor legal, autorizo la visita y estaré localizable durante la cita.")}</span></label>
                </div>
              ) : (
                <>
                  <div>
                    <label className="label" htmlFor="partner">{t("Con quién")}</label>
                    <select className="input" id="partner" name="partner" defaultValue={String(preselect)}>
                      <option value="">{t("Otra persona (sin cuenta TWO LOVE)")}</option>
                      {partnerId && couple?.partner && <option value={partnerId}>💞 {couple.partner}</option>}
                      {matches.map((m) => <option key={m.id} value={m.id}>♥ {m.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="partner_name">{t("Nombre de tu pareja (opcional)")}</label>
                    <input className="input" id="partner_name" name="partner_name" maxLength={60} defaultValue={couple && !partnerId ? couple.partner_name : ""} />
                  </div>
                  <label className="flex items-start gap-2 text-sm"><input className="check mt-1" type="checkbox" name="photos" defaultChecked /> <span>{t("Consentimos fotos en cabina y un álbum privado por QR durante 30 días.")}</span></label>
                </>
              )}
              <div>
                <label className="label" htmlFor="notes">{t("Peticiones especiales")}</label>
                <textarea className="input" id="notes" name="notes" maxLength={400} placeholder={t("Alergias, sorpresa, música…")} />
              </div>
              <div className="space-y-1 border-t border-line pt-3 text-sm">
                <div className="flex justify-between"><span className="text-muted">{t("Precio")}</span><span>{clp(product.price)}</span></div>
                {discount > 0 && <div className="flex justify-between text-ok"><span>{source === "club" ? t("Descuento Two Love Club") : t("Descuento de tu membresía")} ({Math.round(rate * 100)} %)</span><span>−{clp(discount)}</span></div>}
                <div className="flex justify-between font-semibold"><span>{t("Total")}</span><span>{clp(total)}</span></div>
                <div className="flex justify-between text-glow"><span>{t("Anticipo hoy (30 %)")}</span><span>{clp(deposit)} ≈ {money(clpToFils(deposit))}</span></div>
              </div>
              <p className="text-xs text-muted">{t("Saldo: {amount}. Cancelación gratuita hasta {h} h antes.", { amount: money(walletBalance(user.id).balance), h: CANCEL_FREE_HOURS })}</p>
              <button className="btn-brand w-full" type="submit" disabled={slots.every((s) => s.left <= 0)}>{t("Reservar y pagar anticipo")}</button>
            </form>
          </aside>
        </div>
      )}
    </div>
  );
}
