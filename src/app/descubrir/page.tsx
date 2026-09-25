import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { discover } from "@/lib/discovery";
import { age, csv, getProfile, isFullyVerified } from "@/lib/users";
import { ARCHETYPES, CITIES, INTENTS, NET_WORTH, archetypeLabel, tierById } from "@/lib/catalog";
import { react } from "../actions/social";
import { Avatar, Empty, Flash, PageHeader, Portrait, sp, TierBadge, type SP } from "@/components/ui";

export default async function Discover({ searchParams }: { searchParams: SP }) {
  const user = await requireUser();
  const q = await searchParams;
  const me = getProfile(user.id)!;
  const tier = tierById(user.tier);
  const verified = isFullyVerified(user.id);
  const profileReady = me.gender && me.seeking && me.city;

  const filters = {
    archetype: sp(q.archetype) || undefined,
    city: sp(q.city) || undefined,
    intent: sp(q.intent) || undefined,
    netWorth: tier.rank >= 1 ? sp(q.net_worth) || undefined : undefined,
    minScore: Number(sp(q.min)) || 0,
  };
  const candidates = profileReady ? discover(me, filters).slice(0, 24) : [];
  const likers = all<{ id: number; name: string; hue: number; photo_path: string | null; kind: string }>(
    `SELECT u.id, u.name, p.hue, p.photo_path, l.kind FROM likes l JOIN users u ON u.id = l.from_id JOIN profiles p ON p.user_id = u.id
     WHERE l.to_id = ? AND l.kind != 'pass' AND NOT EXISTS (SELECT 1 FROM likes m WHERE m.from_id = ? AND m.to_id = l.from_id) ORDER BY l.created_at DESC LIMIT 12`,
    user.id, user.id,
  );

  return (
    <div>
      <PageHeader title="Descubrir" subtitle="Citas reales: perfiles verificados compatibles con tus preferencias de género, prototipo, intereses y personalidad." />
      <Flash ok={sp(q.ok)} error={sp(q.error)} />

      {!profileReady && <div className="mb-6"><Empty href="/perfil/editar" cta="Completar perfil">Completa tu género, preferencias y ciudad para ver perfiles compatibles.</Empty></div>}
      {profileReady && !verified && (
        <div className="card mb-6 border-gold/40 text-sm">Puedes explorar, pero necesitas las 5 verificaciones para dar like, enviar regalos o reservar. <Link href="/verificacion" className="text-gold-2 underline">Verificarme →</Link></div>
      )}

      {likers.length > 0 && (
        <section className="card mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="h2">Les gustas ({likers.length})</h2>
            {!tier.seeLikes && <Link href="/membresias" className="chip-gold">Desbloquear con Gold</Link>}
          </div>
          <div className="flex gap-4 overflow-x-auto pb-1">
            {likers.map((l) => (
              <Link key={l.id} href={tier.seeLikes ? `/perfil/${l.id}` : "/membresias"} className="flex w-20 shrink-0 flex-col items-center gap-1 text-center text-xs">
                <Avatar name={l.name} hue={l.hue} photo={l.photo_path} size={60} blur={!tier.seeLikes} />
                <span className={tier.seeLikes ? "" : "blur-sm"}>{l.name.split(" ")[0]}</span>
                {l.kind === "super" && <span className="text-gold-2">★ Super</span>}
              </Link>
            ))}
          </div>
        </section>
      )}

      <form className="card mb-8 grid gap-3 md:grid-cols-6" method="get">
        <select name="archetype" defaultValue={filters.archetype ?? ""} className="input">
          <option value="">Todos los prototipos</option>
          {ARCHETYPES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
        <select name="city" defaultValue={filters.city ?? ""} className="input">
          <option value="">Todas las ciudades</option>
          {CITIES.map((c) => <option key={c.city} value={c.city}>{c.city}</option>)}
        </select>
        <select name="intent" defaultValue={filters.intent ?? ""} className="input">
          <option value="">Cualquier intención</option>
          {INTENTS.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
        </select>
        <select name="net_worth" defaultValue={filters.netWorth ?? ""} className="input" disabled={tier.rank < 1} title={tier.rank < 1 ? "Disponible desde Gold" : ""}>
          <option value="">Patrimonio {tier.rank < 1 ? "(Gold+)" : ""}</option>
          {NET_WORTH.filter((n) => n.id !== "na").map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
        </select>
        <select name="min" defaultValue={String(filters.minScore || "")} className="input">
          <option value="">Compatibilidad mínima</option>
          {[50, 60, 70, 80].map((n) => <option key={n} value={n}>{n}%+</option>)}
        </select>
        <button className="btn-gold" type="submit">Filtrar</button>
      </form>

      {profileReady && candidates.length === 0 && <Empty>No hay más perfiles con estos filtros. Amplía tu rango o vuelve pronto.</Empty>}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {candidates.map((c) => (
          <article key={c.user_id} className="card overflow-hidden p-0">
            <Link href={`/perfil/${c.user_id}`} className="relative block aspect-[4/3]">
              <Portrait name={c.name} hue={c.hue} photo={c.photo_path} />
              <div className="absolute left-3 top-3 flex gap-2">
                <span className="chip-gold bg-ink/80">{c.score}% compatible</span>
              </div>
              <div className="absolute right-3 top-3"><TierBadge tier={c.tier} /></div>
            </Link>
            <div className="space-y-3 p-5">
              <div>
                <Link href={`/perfil/${c.user_id}`} className="font-display text-xl hover:text-gold-2">{c.name.split(" ")[0]}{age(c) ? `, ${age(c)}` : ""}</Link>
                <div className="text-sm text-muted">{archetypeLabel(c.archetype)} · {c.city}</div>
                <div className="text-sm text-muted">{c.occupation}</div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {csv(c.interests).slice(0, 4).map((i) => <span key={i} className={csv(me.interests).includes(i) ? "chip-gold" : "chip"}>{i}</span>)}
              </div>
              <div className="flex gap-2">
                {(["pass", "like", "super"] as const).map((kind) => (
                  <form key={kind} action={react} className="flex-1">
                    <input type="hidden" name="target" value={c.user_id} />
                    <input type="hidden" name="kind" value={kind} />
                    <button type="submit" className={`${kind === "like" ? "btn-gold" : "btn-ghost"} w-full px-2`} aria-label={kind}>
                      {kind === "pass" ? "✕ Pasar" : kind === "like" ? "♥ Like" : "★ Super"}
                    </button>
                  </form>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
