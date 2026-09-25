import { requireAdmin } from "@/lib/auth";
import { all, one } from "@/lib/db";
import { STREAM_LABEL, TIERS } from "@/lib/catalog";
import { compact, money, pct } from "@/lib/money";
import { invoicePartner, markPayablePaid, restock, savePartner, updateGiftOrder } from "../../actions/admin";
import { Bars, Flash, PageHeader, sp, Stat, type SP } from "@/components/ui";

export default async function Erp({ searchParams }: { searchParams: SP }) {
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
      <PageHeader title="ERP" subtitle="Finanzas, pedidos de regalos, inventario, cuentas por pagar, alianzas, Salas y suscripciones.">
        <div className="flex gap-1">{[30, 90, 365].map((d) => <a key={d} href={`/admin/erp?days=${d}`} className={d === days ? "chip-gold" : "chip"}>{d} días</a>)}</div>
      </PageHeader>
      <Flash ok={sp(q.ok)} error={sp(q.error)} />

      <div className="grid gap-4 md:grid-cols-5">
        <Stat label="Ingresos netos" value={compact(totalRev)} hint={`${days} días`} />
        <Stat label="IVA repercutido" value={compact(totalVat)} hint="A liquidar con la FTA" />
        <Stat label="Cuentas por pagar" value={compact(payablesOpen)} hint="Aliados y acompañantes" />
        <Stat label="Fondos en custodia" value={compact(custody)} hint="Reservas abiertas" />
        <Stat label="Saldos de clientes" value={compact(liabilities)} hint="Pasivo de billeteras" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="card overflow-x-auto">
          <h2 className="h2 mb-3">Cuenta de resultados por línea</h2>
          <table className="tbl">
            <thead><tr><th>Línea</th><th className="text-right">Operaciones</th><th className="text-right">Ingreso neto</th><th className="text-right">IVA</th><th className="text-right">% total</th></tr></thead>
            <tbody>
              {pnl.map((r) => (
                <tr key={r.stream}><td>{STREAM_LABEL[r.stream] ?? r.stream}</td><td className="text-right">{r.n}</td><td className="text-right tabular-nums text-gold-2">{money(r.amount)}</td><td className="text-right tabular-nums text-muted">{money(r.vat)}</td><td className="text-right">{pct(r.amount / Math.max(1, totalRev))}</td></tr>
              ))}
              <tr className="font-medium"><td>Total</td><td /><td className="text-right text-gold-2">{money(totalRev)}</td><td className="text-right">{money(totalVat)}</td><td className="text-right">100%</td></tr>
            </tbody>
          </table>
        </section>
        <section className="card space-y-6">
          <div>
            <h2 className="h2 mb-3">Regalos más vendidos</h2>
            <Bars rows={topGifts.map((g) => ({ label: `${g.emoji} ${g.name} (${g.n})`, value: g.v }))} format={compact} />
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div><div className="label">Reservas acompañamiento</div><div className="text-xl">{companion.n}</div></div>
            <div><div className="label">GMV acompañamiento</div><div className="text-xl">{compact(companion.gmv)}</div></div>
            <div><div className="label">Take rate</div><div className="text-xl text-gold-2">{pct(companion.fee / Math.max(1, companion.gmv))}</div></div>
          </div>
        </section>
      </div>

      <section id="pedidos" className="card mt-8 overflow-x-auto">
        <h2 className="h2 mb-3">Pedidos de regalos físicos (logística)</h2>
        <table className="tbl">
          <thead><tr><th>#</th><th>Regalo</th><th>De → Para</th><th>Aliado</th><th className="text-right">Total</th><th>Fecha</th><th>Estado</th></tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td className="text-muted">{o.id}</td><td>{o.emoji} {o.gift}</td><td className="text-muted">{o.sender} → {o.recipient}</td><td className="text-muted">{o.partner}</td>
                <td className="text-right tabular-nums">{money(o.total)}</td><td className="text-muted">{o.created_at.slice(0, 10)}</td>
                <td>
                  <form action={updateGiftOrder} className="flex gap-1">
                    <input type="hidden" name="id" value={o.id} />
                    <select name="status" defaultValue={o.status} className="input w-32 py-1"><option value="pagado">Pagado</option><option value="preparando">Preparando</option><option value="entregado">Entregado</option></select>
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
          <h2 className="h2 mb-3">Inventario</h2>
          <table className="tbl">
            <thead><tr><th>Artículo</th><th className="text-right">Stock</th><th className="text-right">Vendidos</th><th className="text-right">Margen</th><th>Reponer</th></tr></thead>
            <tbody>
              {inventory.map((g) => (
                <tr key={g.id}>
                  <td>{g.emoji} {g.name}<div className="text-xs text-muted">{g.partner}</div></td>
                  <td className={`text-right ${g.stock <= 3 ? "text-rose" : ""}`}>{g.stock}</td>
                  <td className="text-right">{g.sold}</td>
                  <td className="text-right">{pct((g.price - g.cost) / g.price)}</td>
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
          <h2 className="h2 mb-3">Cuentas por pagar</h2>
          {payables.length === 0 ? <p className="text-sm text-muted">Todo al día.</p> : (
            <table className="tbl">
              <thead><tr><th>Beneficiario</th><th>Tipo</th><th>Ref.</th><th className="text-right">Importe</th><th /></tr></thead>
              <tbody>
                {payables.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td><td className="text-muted">{p.party === "partner" ? "Aliado" : "Miembro"}</td><td className="text-xs text-muted">{p.ref}</td>
                    <td className="text-right tabular-nums">{money(p.amount)}</td>
                    <td><form action={markPayablePaid}><input type="hidden" name="id" value={p.id} /><button className="btn-ghost px-3 py-1">Pagar</button></form></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="card overflow-x-auto">
          <h2 className="h2 mb-3">Salas TWO LOVE ({days} días)</h2>
          <table className="tbl">
            <thead><tr><th>Sala</th><th className="text-right">Reservas</th><th className="text-right">Horas</th><th className="text-right">Ingresos</th></tr></thead>
            <tbody>{lounges.map((l) => <tr key={l.id}><td>{l.name}<div className="text-xs text-muted">{l.city}</div></td><td className="text-right">{l.bookings}</td><td className="text-right">{l.hours}</td><td className="text-right tabular-nums text-gold-2">{money(l.revenue)}</td></tr>)}</tbody>
          </table>
        </section>
        <section className="card overflow-x-auto">
          <h2 className="h2 mb-3">Suscripciones activas</h2>
          <table className="tbl">
            <thead><tr><th>Plan</th><th className="text-right">Miembros</th><th className="text-right">MRR</th></tr></thead>
            <tbody>
              {TIERS.filter((t) => t.monthly).map((t) => {
                const s = subs.find((x) => x.tier === t.id);
                return <tr key={t.id}><td>{t.name}</td><td className="text-right">{s?.n ?? 0}</td><td className="text-right tabular-nums text-gold-2">{money(s?.mrr ?? 0)}</td></tr>;
              })}
            </tbody>
          </table>
        </section>
      </div>

      <section id="aliados" className="card mt-8 overflow-x-auto">
        <h2 className="h2 mb-3">Alianzas comerciales</h2>
        <table className="tbl">
          <thead><tr><th>Aliado</th><th>Categoría</th><th className="text-right">Comisión TL</th><th className="text-right">Dto. miembros</th><th className="text-right">Ventas regalos</th><th className="text-right">Liquidado/por liquidar</th><th>Facturar</th></tr></thead>
          <tbody>
            {partners.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td><td className="text-muted">{p.category}</td><td className="text-right">{pct(p.commission)}</td><td className="text-right">{pct(p.discount)}</td>
                <td className="text-right tabular-nums">{money(p.gift_sales)}</td><td className="text-right tabular-nums text-muted">{money(p.payable)}</td>
                <td>
                  <form action={invoicePartner} className="flex gap-1">
                    <input type="hidden" name="partner" value={p.id} />
                    <input name="amount" type="number" min={1} placeholder="AED" className="input w-24 py-1" required />
                    <button className="btn-ghost px-3 py-1">+</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <form action={savePartner} className="mt-6 grid gap-3 md:grid-cols-4">
          <input className="input" name="name" placeholder="Nombre del aliado" required />
          <input className="input" name="category" placeholder="Categoría (hotel, joyeria…)" required />
          <input className="input" name="city" placeholder="Ciudad" />
          <input className="input" name="contact" placeholder="Contacto" />
          <input className="input md:col-span-2" name="benefit" placeholder="Beneficio para miembros" required />
          <input className="input" name="discount" type="number" min={0} max={90} placeholder="% descuento" />
          <input className="input" name="commission" type="number" min={0} max={90} placeholder="% comisión TL" />
          <select className="input" name="min_tier">{TIERS.map((t) => <option key={t.id} value={t.id}>{t.name}+</option>)}</select>
          <button className="btn-gold md:col-span-3">Añadir aliado</button>
        </form>
      </section>
    </div>
  );
}
