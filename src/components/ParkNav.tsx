import Link from "next/link";
import { getT } from "@/lib/i18n";

const TABS = [
  ["/park", "TWO LOVE Park"],
  ["/park/reservar", "Reservar"],
  ["/park/mis-citas", "Mis citas"],
  ["/park/pasaporte", "Pasaporte y pareja"],
];

/** Pestañas del parque de citas. */
export async function ParkNav({ active }: { active: string }) {
  const t = await getT();
  return (
    <nav className="mb-8 flex gap-1 overflow-x-auto rounded-full border border-line bg-ink-2 p-1 text-sm" aria-label="TWO LOVE Park">
      {TABS.map(([href, label]) => (
        <Link key={href} href={href} aria-current={href === active ? "page" : undefined}
          className={`whitespace-nowrap rounded-full px-4 py-1.5 ${href === active ? "bg-brand/20 text-glow" : "text-muted hover:text-glow"}`}>
          {t(label)}
        </Link>
      ))}
    </nav>
  );
}
