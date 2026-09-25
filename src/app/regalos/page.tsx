import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { getProfile } from "@/lib/users";
import { tierById, VAT_RATE } from "@/lib/catalog";
import { money, pct } from "@/lib/money";
import { sendGift } from "../actions/commerce";
import { Flash, PageHeader, sp, type SP } from "@/components/ui";

const CATEGORIES: Record<string, string> = { virtual: "Regalos virtuales", flores: "Flores", experiencia: "Experiencias", joyeria: "Joyería", lujo: "Lujo" };

type Gift = { id: number; name: string; category: string; emoji: string; description: string; price: number; stock: number | null; partner: string | null };
type Order = { id: number; name: string; emoji: string; other: string; total: number; status: string; message: string; created_at: string; recipient_credit: number };

export default async function Gifts({ searchParams }: { searchParams: SP }) {
  const user = await requireUser();
  const q = await searchParams;
  const tier = tierById(user.tier);
  const preset = Number(sp(q.to)) || 0;
  const presetProfile = preset ? getProfile(preset) : undefined;
  const gifts = all<Gift>("SELECT g.*, p.name AS partner FROM gifts g LEFT JOIN partners p ON p.id = g.partner_id WHERE g.active = 1 ORDER BY g.price");
  const recipients = all<{ id: number; name: string }>(
    `SELECT DISTINCT u.id, u.name FROM likes a JOIN likes b ON b.from_id = a.to_id AND b.to_id = a.from_id JOIN users u ON u.id = a.to_id
     WHERE a.from_id = ? AND a.kind != 'pass' AND b.kind != 'pass' ORDER BY u.name`, user.id,
  );
  if (presetProfile && !recipients.some((r) => r.id === preset) && preset !== user.id) recipients.unshift({ id: preset, name: presetProfile.name });
  const sent = all<Order>(
    `SELECT o.id, g.name, g.emoji, u.name AS other, o.total, o.status, o.message, o.created_at, o.recipient_credit FROM gift_orders o JOIN gifts g ON g.id = o.gift_id JOIN users u ON u.id = o.recipient_id
     WHERE o.sender_id = ? ORDER BY o.id DESC LIMIT 10`, user.id,
  );
  const received = all<Order>(
    `SELECT o.id, g.name, g.emoji, u.name AS other, o.total, o.status, o.message, o.created_at, o.recipient_credit FROM gift_orders o JOIN gifts g ON g.id = o.gift_id JOIN users u ON u.id = o.sender_id
     WHERE o.recipient_id = ? ORDER BY o.id DESC LIMIT 10`, user.id,
  );

  return (
    <div>
      <PageHeader title="Regalos" subtitle={`Sorprende con regalos virtuales o de nuestras marcas aliadas, entregados en mano. Tu nivel ${tier.name} tiene ${pct(tier.giftDiscount)} de descuento.`} />
      <Flash ok={sp(q.ok)} error={sp(q.error)} />

      <form action={sendGift} className="space-y-8">
        <div className="card grid gap-3 md:grid-cols-3">
          <div>
            <label className="label" htmlFor="to">Para</label>
            <select className="input" id="to" name="to" defaultValue={preset || ""} required>
              <option value="">Elige un match…</option>
              {recipients.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="label" htmlFor="message">Mensaje</label>
            <input className="input" id="message" name="message" maxLength={280} placeholder="Unas palabras que acompañen tu regalo" />
          </div>
        </div>

        {Object.entries(CATEGORIES).map(([cat, label]) => {
          const items = gifts.filter((g) => g.category === cat);
          if (!items.length) return null;
          return (
            <section key={cat}>
              <h2 className="h2 mb-4">{label}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {items.map((g) => {
                  const out = g.stock !== null && g.stock <= 0;
                  const net = Math.round(g.price * (1 - tier.giftDiscount));
                  return (
                    <label key={g.id} className={`card flex cursor-pointer flex-col gap-2 has-[:checked]:border-gold ${out ? "opacity-40" : ""}`}>
                      <input type="radio" name="gift" value={g.id} className="sr-only" disabled={out} required />
                      <div className="text-4xl">{g.emoji}</div>
                      <div className="font-medium">{g.name}</div>
                      <p className="text-xs text-muted">{g.description}</p>
                      {g.partner && <div className="text-xs text-muted">por {g.partner}</div>}
                      <div className="mt-auto flex items-baseline justify-between pt-2">
                        <span className="text-gold-2">{money(net)}</span>
                        {tier.giftDiscount > 0 && <span className="text-xs text-muted line-through">{money(g.price)}</span>}
                      </div>
                      <div className="text-[10px] text-muted">+ IVA {VAT_RATE * 100}%{g.stock !== null && ` · ${out ? "Agotado" : `${g.stock} disponibles`}`}</div>
                    </label>
                  );
                })}
              </div>
            </section>
          );
        })}
        <div className="sticky bottom-4 flex justify-end">
          <button className="btn-gold shadow-lg shadow-black/50" type="submit">Enviar regalo seleccionado</button>
        </div>
      </form>

      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        {[["Enviados", sent], ["Recibidos", received]].map(([title, rows]) => (
          <section key={title as string} className="card">
            <h2 className="h2 mb-3">{title as string}</h2>
            {(rows as Order[]).length === 0 ? <p className="text-sm text-muted">Nada por aquí todavía.</p> : (
              <ul className="space-y-2 text-sm">
                {(rows as Order[]).map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-3 border-b border-line/60 pb-2 last:border-0">
                    <span>{o.emoji} {o.name} · <span className="text-muted">{title === "Enviados" ? "para" : "de"} {o.other}</span></span>
                    <span className="flex items-center gap-2">
                      {title === "Recibidos" && o.recipient_credit > 0 && <span className="chip-gold">+{money(o.recipient_credit)}</span>}
                      <span className="chip">{o.status}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
