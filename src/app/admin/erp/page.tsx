import { requireAdmin } from "@/lib/auth";
import { all, one } from "@/lib/db";
import { STREAM_LABEL, TIERS } from "@/lib/catalog";
import { compact, money, pct } from "@/lib/money";
import { invoicePartner, markPayablePaid, restock, savePartner, updateGiftOrder } from "../../actions/admin";
import { Bars, Flash, PageHeader, sp, Stat, type SP } from "@/components/ui";
import { getT } from "@/lib/i18n";

export default async function Erp({ searchParams }: { searchParams: SP }) {
  const t = await getT();
  await requireAdmin();
  const q = await searchParams;
  const days = [30, 90, 365].includes(Number(sp(q.days))) ? Number(sp(q.days)) : 90;
  const since = `-${days} days`;

  const pnl = all<{ stream: string; amount: number; vat: number; n: number }>(
    "SELECT stream, SUM(amount) AS amount, SUM(vat) AS vat, COUNT(*) AS n FROM revenue WHERE created_at >= datetime('now', ?) GROUP BY stream ORDER BY amount DESC", since,
  );
  const totalRev = pnl.reduce((a, r) => a + r.amount, 0);
  const totalVat = pnl.reduce((a, r) => a + r.vat, 0);
  const payablesOpen = one<{ v: number }>("SELECT COALESCE(SUM(amount), 0) AS v FROM payables WHERE status = 'pendiente'")!.v;
  const custody = one<{ v: number }>("SELECT COALESCE(SUM(held), 0) AS v FROM wallets")!.v;
  const liabilities = one<{ v: number }>("SELECT COALESCE(SUM(balance), 0) AS v FROM wallets")!.v;

  const orders = all<{ id: number; gift: string; emoji: string; category: string; sender: string; recipient: string; total: number; status: string; created_at: string; partner: string | null }>(
    `SELECT o.id, g.name AS gift, g.emoji, g.category, s.name AS sender, r.name AS recipient, o.total, o.status, o.created_at, p.name AS partner
     FROM gift_orders o JOIN gifts g ON g.id = o.gift_id JOIN users s ON s.id = o.sender_id JOIN users r ON r.id = o.recipient_id LEFT JOIN partners p ON p.id = g.partner_id
     WHERE g.category != 'virtual' ORDER BY o.status = 'entregado', o.id DESC LIMIT 25`,
  );
  const inventory = all<{ id: number; name: string; emoji: string; stock: number; price: number; cost: number; sold: number; partner: string | null }>(
    `SELECT g.id, g.name, g.emoji, g.stock, g.price, g.cost, p.name AS partner, (SELECT COUNT(*) FROM gift_orders o WHERE o.gift_id = g.id) AS sold
     FROM gifts g LEFT JOIN partners p ON p.id = g.partner_id WHERE g.stock IS NOT NULL ORDER BY g.stock`,
  );
  const topGifts = all<{ name: string; emoji: string; n: number; v: number }>(
    "SELECT g.name, g.emoji, COUNT(*) AS n, SUM(o.total) AS v FROM gift_orders o JOIN gifts g ON g.id = o.gift_id WHERE o.created_at >= datetime('now', ?) GROUP BY g.id ORDER BY v DESC LIMIT 8", since,
  );
  const payables = all<{ id: number; party: string; name: string; amount: number; ref: string; status: string; created_at: string }>(
    `SELECT pb.id, pb.party, COALESCE(p.name, u.name) AS name, pb.amount, pb.ref, pb.status, pb.created_at FROM payables pb
     LEFT JOIN partners p ON p.id = pb.partner_id LEFT JOIN users u ON u.id = pb.user_id WHERE pb.status = 'pendiente' ORDER BY pb.id DESC LIMIT 25`,
  );
  const partners = all<{ id: number; name: string; category: string; commission: number; discount: number; gift_sales: number; payable: number }>(
    `SELECT p.id, p.name, p.category, p.commission, p.discount,
       COALESCE((SELECT SUM(o.total) FROM gift_orders o JOIN gifts g ON g.id = o.gift_id WHERE g.partner_id = p.id), 0) AS gift_sales,
       COALESCE((SELECT SUM(amount) FROM payables pb WHERE pb.partner_id = p.id), 0) AS payable
     FROM partners p ORDER BY gift_sales DESC`,
  );
  const lounges = all<{ id: number; name: string; city: string; bookings: number; hours: number; revenue: number }>(
    `SELECT l.id, l.name, l.city, COUNT(b.id) AS bookings, COALESCE(SUM(b.quantity), 0) AS hours, COALESCE(SUM(b.subtotal), 0) AS revenue
     FROM lounges l LEFT JOIN bookings b ON b.lounge_id = l.id AND b.status IN ('accepted','completed') AND b.created_at >= datetime('now', ?) GROUP BY l.id ORDER BY revenue DESC`, since,
  );
  const subs = all<{ tier: string; n: number; mrr: number }>(
    "SELECT tier, COUNT(*) AS n, SUM(CASE period WHEN 'yearly' THEN price / 12 ELSE price END) AS mrr FROM subscriptions WHERE status = 'active' AND expires_at > datetime('now') GROUP BY tier",
  );
  const companion = one<{ n: number; gmv: number; fee: number }>(
    "SELECT COUNT(*) AS n, COALESCE(SUM(subtotal), 0) AS gmv, COALESCE(SUM(service_fee + provider_commission), 0) AS fee FROM bookings WHERE kind = 'companion' AND status = 'completed' AND created_at >= datetime('now', ?)", since,
  )!;

  return (
    <div>
      <PageHeader title={t("ERP")} subtitle={t("Finanzas, pedidos de regalos, inventario, cuentas por pagar, alianzas, Salas y suscripciones.")}>
        <div className="flex gap-1">{[30, 90, 365].map((d) => <a key={d} href={`/admin/erp?days=${d}`} className={d === days ? "chip-gold" : "chip"}>{t("{n} días", { n: d })}</a>)}</div>
      </PageHeader>
      <Flash ok={sp(q.ok)} error={sp(q.error)} />

      <div className="grid gap-4 md:grid-cols-5">
        <Stat label={t("Ingresos netos")} value={compact(totalRev)} hint={t("{n} días", { n: days })} />
        <Stat label={t("IVA repercutido")} value={compact(totalVat)} hint={t("A liquidar con la FTA")} />
        <Stat label={t("Cuentas por pagar")} value={compact(payablesOpen)} hint={t("Aliados y acompañantes")} />
        <Stat label={t("Fondos en custodia")} value={compact(custody)} hint={t("Reservas abiertas")} />
        <Stat label={t("Saldos de clientes")} value={compact(liabilities)} hint={t("Pasivo de billeteras")} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="card overflow-x-auto">
          <h2 className="h2 mb-3">{t("Cuenta de resultados por línea")}</h2>
          <table className="tbl">
            <thead><tr><th>{t("Línea")}</th><th className="text-end">{t("Operaciones")}</th><th className="text-end">{t("Ingreso neto")}</th><th className="text-end">{t("IVA")}</th><th className="text-end">{t("% total")}</th></tr></thead>
            <tbody>
              {pnl.map((r) => (
                <tr key={r.stream}><td>{t(STREAM_LABEL[r.stream] ?? r.stream)}</td><td className="text-end">{r.n}</td><td className="text-end tabular-nums text-gold-2">{money(r.amount)}</td><td className="text-end tabular-nums text-muted">{money(r.vat)}</td><td className="text-end">{pct(r.amount / Math.max(1, totalRev))}</td></tr>
              ))}
              <tr className="font-medium"><td>{t("Total")}</td><td /><td className="text-end text-gold-2">{money(totalRev)}</td><td className="text-end">{money(totalVat)}</td><td className="text-end">100%</td></tr>
            </tbody>
          </table>
        </section>
        <section className="card space-y-6">
          <div>
            <h2 className="h2 mb-3">{t("Regalos más vendidos")}</h2>
            <Bars rows={topGifts.map((g) => ({ label: `${g.emoji} ${t(g.name)} (${g.n})`, value: g.v }))} format={compact} />
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div><div className="label">{t("Reservas acompañamiento")}</div><div className="text-xl">{companion.n}</div></div>
            <div><div className="label">{t("GMV acompañamiento")}</div><div className="text-xl">{compact(companion.gmv)}</div></div>
            <div><div className="label">{t("Take rate")}</div><div className="text-xl text-gold-2">{pct(companion.fee / Math.max(1, companion.gmv))}</div></div>
          </div>
        </section>
      </div>

      <section id="pedidos" className="card mt-8 overflow-x-auto">
        <h2 className="h2 mb-3">{t("Pedidos de regalos físicos (logística)")}</h2>
        <table className="tbl">
          <thead><tr><th>#</th><th>{t("Regalo")}</th><th>{t("De → Para")}</th><th>{t("Aliado")}</th><th className="text-end">{t("Total")}</th><th>{t("Fecha")}</th><th>{t("Estado")}</th></tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td className="text-muted">{o.id}</td><td>{o.emoji} {o.gift}</td><td className="text-muted">{o.sender} → {o.recipient}</td><td className="text-muted">{o.partner}</td>
                <td className="text-end tabular-nums">{money(o.total)}</td><td className="text-muted">{o.created_at.slice(0, 10)}</td>
                <td>
                  <form action={updateGiftOrder} className="flex gap-1">
                    <input type="hidden" name="id" value={o.id} />
                    <select name="status" defaultValue={o.status} className="input w-32 py-1"><option value="pagado">{t("Pagado")}</option><option value="preparando">{t("Preparando")}</option><option value="entregado">{t("Entregado")}</option></select>
                    <button className="btn-ghost px-3 py-1">✓</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section id="inventario" className="card overflow-x-auto">
          <h2 className="h2 mb-3">{t("Inventario")}</h2>
          <table className="tbl">
            <thead><tr><th>{t("Artículo")}</th><th className="text-end">{t("Stock")}</th><th className="text-end">{t("Vendidos")}</th><th className="text-end">{t("Margen")}</th><th>{t("Reponer")}</th></tr></thead>
            <tbody>
              {inventory.map((g) => (
                <tr key={g.id}>
                  <td>{g.emoji} {g.name}<div className="text-xs text-muted">{g.partner}</div></td>
                  <td className={`text-end ${g.stock <= 3 ? "text-rose" : ""}`}>{g.stock}</td>
                  <td className="text-end">{g.sold}</td>
                  <td className="text-end">{pct((g.price - g.cost) / g.price)}</td>
                  <td>
                    <form action={restock} className="flex gap-1">
                      <input type="hidden" name="id" value={g.id} />
                      <input name="qty" type="number" min={1} defaultValue={5} className="input w-16 py-1" />
                      <button className="btn-ghost px-3 py-1">+</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section id="pagos" className="card overflow-x-auto">
          <h2 className="h2 mb-3">{t("Cuentas por pagar")}</h2>
          {payables.length === 0 ? <p className="text-sm text-muted">{t("Todo al día.")}</p> : (
            <table className="tbl">
              <thead><tr><th>{t("Beneficiario")}</th><th>{t("Tipo")}</th><th>{t("Ref.")}</th><th className="text-end">{t("Importe")}</th><th /></tr></thead>
              <tbody>
                {payables.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td><td className="text-muted">{p.party === "partner" ? t("Aliado") : t("Miembro")}</td><td className="text-xs text-muted">{p.ref}</td>
                    <td className="text-end tabular-nums">{money(p.amount)}</td>
                    <td><form action={markPayablePaid}><input type="hidden" name="id" value={p.id} /><button className="btn-ghost px-3 py-1">{t("Pagar")}</button></form></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="card overflow-x-auto">
          <h2 className="h2 mb-3">{t("Salas TWO LOVE ({n} días)", { n: days })}</h2>
          <table className="tbl">
            <thead><tr><th>{t("Sala")}</th><th className="text-end">{t("Reservas")}</th><th className="text-end">{t("Horas")}</th><th className="text-end">{t("Ingresos")}</th></tr></thead>
            <tbody>{lounges.map((l) => <tr key={l.id}><td>{l.name}<div className="text-xs text-muted">{t(l.city)}</div></td><td className="text-end">{l.bookings}</td><td className="text-end">{l.hours}</td><td className="text-end tabular-nums text-gold-2">{money(l.revenue)}</td></tr>)}</tbody>
          </table>
        </section>
        <section className="card overflow-x-auto">
          <h2 className="h2 mb-3">{t("Suscripciones activas")}</h2>
          <table className="tbl">
            <thead><tr><th>{t("Plan")}</th><th className="text-end">{t("Miembros")}</th><th className="text-end">{t("MRR")}</th></tr></thead>
            <tbody>
              {TIERS.filter((x) => x.monthly).map((x) => {
                const s = subs.find((y) => y.tier === x.id);
                return <tr key={x.id}><td>{x.name}</td><td className="text-end">{s?.n ?? 0}</td><td className="text-end tabular-nums text-gold-2">{money(s?.mrr ?? 0)}</td></tr>;
              })}
            </tbody>
          </table>
        </section>
      </div>

      <section id="aliados" className="card mt-8 overflow-x-auto">
        <h2 className="h2 mb-3">{t("Alianzas comerciales")}</h2>
        <table className="tbl">
          <thead><tr><th>{t("Aliado")}</th><th>{t("Categoría")}</th><th className="text-end">{t("Comisión TL")}</th><th className="text-end">{t("Dto. miembros")}</th><th className="text-end">{t("Ventas regalos")}</th><th className="text-end">{t("Liquidado/por liquidar")}</th><th>{t("Facturar")}</th></tr></thead>
          <tbody>
            {partners.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td><td className="text-muted">{p.category}</td><td className="text-end">{pct(p.commission)}</td><td className="text-end">{pct(p.discount)}</td>
                <td className="text-end tabular-nums">{money(p.gift_sales)}</td><td className="text-end tabular-nums text-muted">{money(p.payable)}</td>
                <td>
                  <form action={invoicePartner} className="flex gap-1">
                    <input type="hidden" name="partner" value={p.id} />
                    <input name="amount" type="number" min={1} placeholder={t("AED")} className="input w-24 py-1" required />
                    <button className="btn-ghost px-3 py-1">+</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <form action={savePartner} className="mt-6 grid gap-3 md:grid-cols-4">
          <input className="input" name="name" placeholder={t("Nombre del aliado")} required />
          <input className="input" name="category" placeholder={t("Categoría (hotel, joyeria…)")} required />
          <input className="input" name="city" placeholder={t("Ciudad")} />
          <input className="input" name="contact" placeholder={t("Contacto")} />
          <input className="input md:col-span-2" name="benefit" placeholder={t("Beneficio para miembros")} required />
          <input className="input" name="discount" type="number" min={0} max={90} placeholder={t("% descuento")} />
          <input className="input" name="commission" type="number" min={0} max={90} placeholder={t("% comisión TL")} />
          <select className="input" name="min_tier">{TIERS.map((x) => <option key={x.id} value={x.id}>{x.name}+</option>)}</select>
          <button className="btn-gold md:col-span-3">{t("Añadir aliado")}</button>
        </form>
      </section>
    </div>
  );
}
