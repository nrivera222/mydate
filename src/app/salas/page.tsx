import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { tierById } from "@/lib/catalog";
import { money } from "@/lib/money";
import { KIND_ICON, type Lounge } from "@/lib/lounges";
import { Flash, PageHeader, sp, TierBadge, type SP } from "@/components/ui";
import { getT } from "@/lib/i18n";

export default async function Lounges({ searchParams }: { searchParams: SP }) {
  const t = await getT();
  const user = await requireUser();
  const q = await searchParams;
  const city = sp(q.city);
  const lounges = all<Lounge>("SELECT l.*, pa.name AS partner FROM lounges l LEFT JOIN partners pa ON pa.id = l.partner_id ORDER BY l.city = 'Dubái' DESC, l.price_hour");
  const cities = [...new Set(lounges.map((l) => l.city))];
  const rank = tierById(user.tier).rank;

  return (
    <div>
      <PageHeader title={t("Salas TWO LOVE")} subtitle={t("Recintos de la marca para citas: privacidad, protocolo de seguridad, anfitrión dedicado y experiencias de lujo en las ciudades más exclusivas del mundo.")} />
      <Flash ok={sp(q.ok)} error={sp(q.error)} />
      <div className="mb-6 flex flex-wrap gap-2">
        <Link href="/salas" className={!city ? "chip-brand" : "chip"}>{t("Todas")}</Link>
        {cities.map((c) => <Link key={c} href={`/salas?city=${encodeURIComponent(c)}`} className={city === c ? "chip-brand" : "chip"}>{c}</Link>)}
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {lounges.filter((l) => !city || l.city === city).map((l) => {
          const locked = rank < tierById(l.min_tier).rank;
          return (
            <Link key={l.id} href={`/salas/${l.id}`} className={`card flex flex-col gap-3 transition hover:border-brand/60 ${locked ? "opacity-70" : ""}`}>
              <div className="flex items-start justify-between">
                <span className="text-4xl">{KIND_ICON[l.kind] ?? "✨"}</span>
                <TierBadge tier={l.min_tier} />
              </div>
              <div>
                <div className="font-display text-xl">{l.name}</div>
                <div className="text-sm text-muted">{t(l.city)}, {t(l.country)} · {t("hasta {n} personas", { n: l.capacity })}</div>
              </div>
              <p className="text-sm text-muted">{t(l.description)}</p>
              <div className="mt-auto flex items-center justify-between pt-2">
                <span className="text-glow">{t("{price}/hora", { price: money(l.price_hour) })}</span>
                {locked ? <span className="chip">🔒 Requiere {tierById(l.min_tier).name}</span> : <span className="chip-brand">{t("Disponible")}</span>}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
