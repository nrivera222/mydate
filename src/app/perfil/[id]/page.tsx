import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { all, one } from "@/lib/db";
import { age, csv, getProfile, isBlockedBetween, isMatch, ratingSummary, verificationStatus } from "@/lib/users";
import { compatibility } from "@/lib/matching";
import { archetypeLabel, GENDERS, INTENTS, NET_WORTH, REPORT_REASONS, TRAIT_LABELS, VERIFICATION_TYPES } from "@/lib/catalog";
import { money } from "@/lib/money";
import { react, report } from "../../actions/social";
import { sendGift } from "../../actions/commerce";
import { Flash, Portrait, sp, Stars, TierBadge, VerifiedBadge, type SP } from "@/components/ui";

const BREAKDOWN_LABELS: Record<string, string> = {
  interests: "Intereses", personality: "Personalidad", archetype: "Prototipo", languages: "Idiomas", location: "Ubicación", intent: "Intención",
};

export default async function ProfilePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const user = await requireUser();
  const { id } = await params;
  const q = await searchParams;
  const p = getProfile(Number(id));
  if (!p || p.user_id === 1) notFound();
  const self = p.user_id === user.id;
  if (!self && isBlockedBetween(user.id, p.user_id)) notFound();
  if (!self && p.incognito && !one("SELECT 1 FROM likes WHERE from_id = ? AND to_id = ? AND kind != 'pass'", p.user_id, user.id)) notFound();

  const me = getProfile(user.id)!;
  const compat = compatibility(me, p);
  const v = verificationStatus(p.user_id);
  const rating = ratingSummary(p.user_id);
  const reviews = all<{ stars: number; tags: string; comment: string; created_at: string }>(
    "SELECT stars, tags, comment, created_at FROM ratings WHERE ratee_id = ? ORDER BY created_at DESC LIMIT 5", p.user_id,
  );
  const offer = p.companion_provider ? one<{ headline: string; rate_hour: number | null }>("SELECT headline, rate_hour FROM companion_offers WHERE user_id = ? AND active = 1", p.user_id) : undefined;
  const matched = !self && isMatch(user.id, p.user_id);
  const gifts = all<{ id: number; name: string; emoji: string; price: number }>("SELECT id, name, emoji, price FROM gifts WHERE active = 1 AND (stock IS NULL OR stock > 0) ORDER BY price");
  const traits = JSON.parse(p.traits || "{}") as Record<string, number>;
  const received = one<{ n: number }>("SELECT COUNT(*) AS n FROM gift_orders WHERE recipient_id = ?", p.user_id)?.n ?? 0;

  return (
    <div>
      <Flash ok={sp(q.ok)} error={sp(q.error)} />
      <div className="grid gap-8 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <div className="card aspect-[3/4] overflow-hidden p-0"><Portrait name={p.name} hue={p.hue} photo={p.photo_path} /></div>
          {!self && (
            <div className="mt-4 grid grid-cols-3 gap-2">
              {(["pass", "like", "super"] as const).map((kind) => (
                <form key={kind} action={react}>
                  <input type="hidden" name="target" value={p.user_id} />
                  <input type="hidden" name="kind" value={kind} />
                  <input type="hidden" name="back" value={`/perfil/${p.user_id}`} />
                  <button className={`${kind === "like" ? "btn-gold" : "btn-ghost"} w-full`} type="submit">{kind === "pass" ? "✕" : kind === "like" ? "♥ Like" : "★ Super"}</button>
                </form>
              ))}
            </div>
          )}
          {matched && <Link href={`/mensajes/${p.user_id}`} className="btn-gold mt-2 w-full">💬 Enviar mensaje</Link>}
        </div>

        <div className="space-y-6 lg:col-span-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <TierBadge tier={p.tier} />
              <VerifiedBadge count={v.approved} />
              {matched && <span className="chip-gold">♥ Match</span>}
              {received > 0 && <span className="chip">🎁 {received} regalos recibidos</span>}
            </div>
            <h1 className="h1 mt-3">{p.name}{age(p) ? `, ${age(p)}` : ""}</h1>
            <p className="mt-1 text-muted">{archetypeLabel(p.archetype)} · {p.occupation}</p>
            <p className="text-sm text-muted">{p.city}, {p.country} · {p.nationality} · {csv(p.languages).join(", ")}</p>
            <div className="mt-2"><Stars value={rating.avg} count={rating.n} /></div>
          </div>

          <p className="leading-relaxed">{p.bio}</p>

          <div className="grid gap-4 sm:grid-cols-3 text-sm">
            <div className="card"><div className="label">Busca</div>{INTENTS.find((i) => i.id === p.intent)?.label}</div>
            <div className="card"><div className="label">Interesado/a en</div>{csv(p.seeking).map((s) => GENDERS.find((g) => g.id === s)?.label).join(", ")}</div>
            <div className="card"><div className="label">Patrimonio</div>{NET_WORTH.find((n) => n.id === p.net_worth)?.label}</div>
          </div>

          <div className="flex flex-wrap gap-2">
            {csv(p.interests).map((i) => <span key={i} className={csv(me.interests).includes(i) ? "chip-gold" : "chip"}>{i}</span>)}
          </div>

          {!self && (
            <div className="card">
              <div className="flex items-center justify-between"><h2 className="h2">Compatibilidad</h2><span className="font-display text-3xl text-gold-2">{compat.score}%</span></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {Object.entries(compat.breakdown).map(([k, val]) => (
                  <div key={k}>
                    <div className="flex justify-between text-xs text-muted"><span>{BREAKDOWN_LABELS[k]}</span><span>{Math.round(val * 100)}%</span></div>
                    <div className="mt-1 h-1.5 rounded-full bg-ink-3"><div className="h-1.5 rounded-full bg-gold" style={{ width: `${val * 100}%` }} /></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card">
            <h2 className="h2">Verificaciones</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {VERIFICATION_TYPES.map((t) => (
                <span key={t.id} className={v.map[t.id]?.status === "approved" ? "chip-gold" : "chip"}>{v.map[t.id]?.status === "approved" ? "✓" : "○"} {t.label}</span>
              ))}
            </div>
            {Object.keys(traits).length > 0 && (
              <p className="mt-3 text-xs text-muted">Rasgo dominante: {TRAIT_LABELS[Object.entries(traits).sort((a, b) => b[1] - a[1])[0][0]]}</p>
            )}
          </div>

          {offer && (
            <div className="card flex flex-wrap items-center justify-between gap-3 border-gold/40">
              <div>
                <div className="chip-gold">Acompañamiento social</div>
                <div className="mt-2 font-display text-lg">{offer.headline}</div>
                {offer.rate_hour && <div className="text-sm text-muted">Desde {money(offer.rate_hour)}/hora</div>}
              </div>
              {!self && <Link href={`/acompanantes/${p.user_id}`} className="btn-gold">Ver tarifas y reservar</Link>}
            </div>
          )}

          {!self && (
            <form action={sendGift} className="card space-y-3">
              <h2 className="h2">Enviar un regalo</h2>
              <input type="hidden" name="to" value={p.user_id} />
              <input type="hidden" name="back" value={`/perfil/${p.user_id}`} />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {gifts.slice(0, 8).map((g) => (
                  <label key={g.id} className="cursor-pointer rounded-xl border border-line p-3 text-center text-sm has-[:checked]:border-gold">
                    <input type="radio" name="gift" value={g.id} className="sr-only" required />
                    <div className="text-2xl">{g.emoji}</div>
                    <div className="mt-1 line-clamp-1">{g.name}</div>
                    <div className="text-xs text-gold-2">{money(g.price)}</div>
                  </label>
                ))}
              </div>
              <input className="input" name="message" placeholder="Mensaje (opcional)" maxLength={280} />
              <div className="flex items-center justify-between">
                <Link href={`/regalos?to=${p.user_id}`} className="text-sm text-gold-2">Ver catálogo completo →</Link>
                <button className="btn-gold" type="submit">Enviar regalo</button>
              </div>
            </form>
          )}

          {reviews.length > 0 && (
            <div className="card">
              <h2 className="h2">Valoraciones</h2>
              <ul className="mt-3 space-y-3">
                {reviews.map((r, i) => (
                  <li key={i} className="border-b border-line/60 pb-3 text-sm last:border-0">
                    <Stars value={r.stars} />
                    <p className="mt-1">{r.comment}</p>
                    <div className="mt-1 flex flex-wrap gap-1">{csv(r.tags).map((t) => <span key={t} className="chip">{t}</span>)}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!self && (
            <details className="card text-sm">
              <summary className="cursor-pointer text-muted">Denunciar o bloquear</summary>
              <form action={report} className="mt-3 space-y-3">
                <input type="hidden" name="target" value={p.user_id} />
                <select name="reason" className="input" required>
                  {REPORT_REASONS.map((r) => <option key={r}>{r}</option>)}
                </select>
                <textarea name="details" className="input" placeholder="Detalles" maxLength={1000} />
                <label className="flex items-center gap-2"><input type="checkbox" className="check" name="block" /> Bloquear también a este perfil</label>
                <button className="btn-danger" type="submit">Enviar denuncia</button>
              </form>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
