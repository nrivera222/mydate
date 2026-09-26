import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "@fontsource/montserrat/400.css";
import "@fontsource/montserrat/500.css";
import "@fontsource/montserrat/600.css";
import "@fontsource/montserrat/700.css";
import "@fontsource/syncopate/700.css";
import "./globals.css";
import { currentUser } from "@/lib/auth";
import { walletBalance } from "@/lib/users";
import { one } from "@/lib/db";
import { money } from "@/lib/money";
import { TierBadge } from "@/components/ui";
import { logout } from "./actions/auth";
import { getT, LOCALES, LOCALE_NAMES } from "@/lib/i18n";
import { setLocale } from "./actions/locale";
import { LogoMark } from "@/components/Logo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    // URLs absolutas de la tarjeta social (opengraph-image.jpg) en producción
    metadataBase: process.env.APP_URL ? new URL(process.env.APP_URL) : undefined,
    title: t("TWO LOVE — Citas de alto perfil"),
    description: t("Ecosistema global de citas verificadas para personas de alto perfil: citas reales, acompañamiento social, Salas TWO LOVE y concierge."),
  };
}

export const viewport: Viewport = { themeColor: "#05040F", colorScheme: "dark" };

function LanguageSwitcher({ current }: { current: string }) {
  return (
    <form action={setLocale} className="flex items-center gap-1 text-xs">
      {LOCALES.map((l) => (
        <button key={l} name="lang" value={l} type="submit" aria-pressed={l === current} title={LOCALE_NAMES[l]}
          className={`rounded-full px-2 py-1 ${l === current ? "bg-brand/15 text-glow" : "text-muted hover:text-glow"}`}>
          {l === "ar" ? "ع" : l.toUpperCase()}
        </button>
      ))}
    </form>
  );
}

const MEMBER_NAV = [
  ["/descubrir", "Descubrir"],
  ["/acompanantes", "Acompañamiento"],
  ["/salas", "Salas TWO LOVE"],
  ["/eventos", "Eventos"],
  ["/regalos", "Regalos"],
  ["/mensajes", "Mensajes"],
  ["/reservas", "Reservas"],
  ["/billetera", "Billetera"],
  ["/membresias", "Membresías"],
  ["/aliados", "Aliados"],
  ["/concierge", "Concierge"],
];

const ADMIN_NAV = [
  ["/admin", "Resumen"],
  ["/admin/verificaciones", "Verificaciones"],
  ["/admin/crm", "CRM"],
  ["/admin/erp", "ERP"],
  ["/admin/eventos", "Eventos"],
  ["/admin/seguridad", "Seguridad"],
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const t = await getT();
  const user = await currentUser();
  const nav = user?.role === "admin" ? ADMIN_NAV : MEMBER_NAV;
  const wallet = user && user.role !== "admin" ? walletBalance(user.id) : null;
  const unread = user ? one<{ n: number }>("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL", user.id)!.n : 0;

  return (
    <html lang={t.locale} dir={t.dir}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Kufi+Arabic:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen">
        <header className="sticky top-0 z-30 border-b border-line bg-ink/90 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
            <Link href={user ? (user.role === "admin" ? "/admin" : "/descubrir") : "/"} className="brand whitespace-nowrap font-display text-xl tracking-[0.15em] md:text-2xl md:tracking-[0.2em]">
              <span className="inline-flex items-center gap-2.5" dir="ltr"><LogoMark size={36} />{/* eslint-disable-next-line @next/next/no-img-element */}<img src="/brand/logo/two-love-wordmark.svg" alt="TWO LOVE" className="h-4 w-auto md:h-5" /></span>
            </Link>
            {user ? (
              <div className="flex items-center gap-3 text-sm">
                <span className="hidden md:block"><LanguageSwitcher current={t.locale} /></span>
                {wallet && (
                  <Link href="/billetera" className="chip-brand hidden sm:inline-flex" title={t("Saldo de billetera")}>
                    ◈ {money(wallet.balance)}
                  </Link>
                )}
                <Link href="/notificaciones" className="relative text-lg text-muted hover:text-glow" aria-label={t("Notificaciones ({n} sin leer)", { n: unread })}>
                  🔔
                  {unread > 0 && (
                    <span className="absolute -end-2 -top-1 min-w-4 rounded-full bg-rose px-1 text-center text-[10px] font-semibold leading-4 text-ink">{unread > 9 ? "9+" : unread}</span>
                  )}
                </Link>
                <TierBadge tier={user.tier} />
                {user.role !== "admin" && (
                  <Link href="/perfil/editar" className="text-muted hover:text-glow">{user.name.split(" ")[0]}</Link>
                )}
                <form action={logout}>
                  <button className="text-muted hover:text-rose" type="submit">{t("Salir")}</button>
                </form>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="hidden sm:block"><LanguageSwitcher current={t.locale} /></span>
                <Link href="/entrar" className="btn-ghost px-3 md:px-5">{t("Entrar")}</Link>
                <Link href="/registro" className="btn-brand whitespace-nowrap px-3 md:px-5">{t("Unirme")}</Link>
              </div>
            )}
          </div>
          {user && (
            <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2 text-sm">
              {nav.map(([href, label]) => (
                <Link key={href} href={href} className="whitespace-nowrap rounded-full px-3 py-1.5 text-muted hover:bg-ink-3 hover:text-glow">
                  {t(label)}
                </Link>
              ))}
              {user.role !== "admin" && (
                <Link href="/verificacion" className="whitespace-nowrap rounded-full px-3 py-1.5 text-muted hover:bg-ink-3 hover:text-glow">{t("Verificación")}</Link>
              )}
            </nav>
          )}
        </header>
        <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
        <footer className="mt-16 border-t border-line">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 text-sm text-muted md:grid-cols-4">
            <div>
              <div className="brand flex items-center gap-2.5" dir="ltr"><LogoMark size={28} />{/* eslint-disable-next-line @next/next/no-img-element */}<img src="/brand/logo/two-love-wordmark.svg" alt="TWO LOVE" className="h-4 w-auto" /></div>
              <div className="mt-3"><LanguageSwitcher current={t.locale} /></div>
              <p className="mt-2">{t("Citas verificadas para personas de alto perfil. Dubái · Abu Dabi · Doha · Riad · Mónaco · Londres.")}</p>
            </div>
            <div>
              <div className="mb-2 text-ivory">{t("Seguridad")}</div>
              <p>{t("Verificación de identidad, foto, perfil psicológico, médico y seguro de vida. Pagos en custodia.")}</p>
            </div>
            <div>
              <div className="mb-2 text-ivory">{t("Código de conducta")}</div>
              <p>{t("El acompañamiento social es estrictamente platónico. Tolerancia cero con servicios sexuales, acoso o fraude.")}</p>
            </div>
            <div>
              <div className="mb-2 text-ivory">{t("Legal")}</div>
              <p>{t("Solo mayores de 21 años. Datos sensibles cifrados y tratados conforme a la PDPL de EAU y el RGPD.")}</p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
