import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { all } from "@/lib/db";
import { getT } from "@/lib/i18n";
import { clp } from "@/lib/money";
import { PARK_PRODUCTS, productById, venueNow } from "@/lib/park-catalog";
import type { Campaign } from "@/lib/park";
import { saveCampaign, toggleCampaign } from "../../../actions/park";
import { Flash, PageHeader, sp, type SP } from "@/components/ui";

// Campañas de temporada del Park: códigos promocionales con ventana de fechas, experiencias y tope de usos
export default async function Campaigns({ searchParams }: { searchParams: SP }) {
  const t = await getT();
  await requireAdmin();
  const q = await searchParams;
  const today = venueNow().date;
  const rows = all<Campaign & { uses: number; revenue: number; given: number }>(
    `SELECT c.*, COUNT(b.id) AS uses, COALESCE(SUM(b.total), 0) AS revenue, COALESCE(SUM(b.discount), 0) AS given
     FROM park_campaigns c LEFT JOIN park_bookings b ON b.campaign_id = c.id AND b.status != 'cancelada'
     GROUP BY c.id ORDER BY c.starts_on DESC`,
  );
  const state = (c: Campaign) =>
    !c.active ? ["Pausada", "chip"] : today < c.starts_on ? ["Próxima", "chip border-electric/50 text-electric"] : today > c.ends_on ? ["Finalizada", "chip"] : ["Vigente", "chip-brand"];

  return (
    <div>
      <PageHeader title={t("Campañas de temporada")} subtitle={t("Códigos promocionales del Park para fechas como el 520, San Valentín o Qixi. Se aplica el mayor entre la campaña y el descuento de la membresía; no se combinan con tarjetas regalo.")}>
        <Link href="/admin/park" className="btn-ghost">{t("Volver a la agenda")}</Link>
      </PageHeader>
      <Flash ok={sp(q.ok)} error={sp(q.error)} />
      <section className="card overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>{t("Código")}</th><th>{t("Campaña")}</th><th>{t("Fechas")}</th><th>{t("Descuento")}</th><th>{t("Experiencias")}</th><th>{t("Usos")}</th><th>{t("Ventas")}</th><th>{t("Estado")}</th><th /></tr></thead>
          <tbody>
            {rows.map((c) => {
              const [label, cls] = state(c);
              const products = c.products.split(",").filter(Boolean);
              return (
                <tr key={c.id}>
                  <td className="font-mono">{c.code}</td>
                  <td>{t(c.name)}{c.description && <div className="text-xs text-muted">{t(c.description)}</div>}</td>
                  <td className="whitespace-nowrap text-muted">{c.starts_on} → {c.ends_on}</td>
                  <td>{Math.round(c.discount * 100)} %</td>
                  <td className="text-xs">{products.length ? products.map((p) => t(productById(p)?.name ?? p)).join(", ") : t("Todas")}</td>
                  <td>{c.uses}{c.max_uses != null ? ` / ${c.max_uses}` : ""}</td>
                  <td className="whitespace-nowrap">{clp(c.revenue)}<div className="text-xs text-muted">{t("descuento {v}", { v: clp(c.given) })}</div></td>
                  <td><span className={cls}>{t(label)}</span></td>
                  <td><form action={toggleCampaign}><input type="hidden" name="campaign" value={c.id} /><button className="text-xs text-glow underline" type="submit">{c.active ? t("Pausar") : t("Activar")}</button></form></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="card mt-6">
        <h2 className="h2">{t("Nueva campaña")}</h2>
        <form action={saveCampaign} className="mt-4 grid gap-4 md:grid-cols-3">
          <div><label className="label" htmlFor="code">{t("Código")}</label><input className="input font-mono uppercase" id="code" name="code" maxLength={20} required placeholder="TL520" /></div>
          <div className="md:col-span-2"><label className="label" htmlFor="name">{t("Nombre")}</label><input className="input" id="name" name="name" maxLength={80} required /></div>
          <div className="md:col-span-3"><label className="label" htmlFor="description">{t("Descripción")}</label><input className="input" id="description" name="description" maxLength={200} /></div>
          <div><label className="label" htmlFor="discount">{t("Descuento (%)")}</label><input className="input" id="discount" name="discount" type="number" min={1} max={50} required /></div>
          <div><label className="label" htmlFor="starts_on">{t("Desde")}</label><input className="input" id="starts_on" name="starts_on" type="date" defaultValue={today} required /></div>
          <div><label className="label" htmlFor="ends_on">{t("Hasta")}</label><input className="input" id="ends_on" name="ends_on" type="date" required /></div>
          <div><label className="label" htmlFor="max_uses">{t("Tope de usos (opcional)")}</label><input className="input" id="max_uses" name="max_uses" type="number" min={1} /></div>
          <fieldset className="md:col-span-3">
            <legend className="label">{t("Experiencias (sin marcar = todas)")}</legend>
            <div className="flex flex-wrap gap-2">
              {PARK_PRODUCTS.map((p) => (
                <label key={p.id} className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-sm has-checked:border-brand"><input className="check" type="checkbox" name="products" value={p.id} /> {t(p.name)}</label>
              ))}
            </div>
          </fieldset>
          <div className="md:col-span-3"><button className="btn-brand" type="submit">{t("Crear campaña")}</button></div>
        </form>
      </section>
    </div>
  );
}
