import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { currentUser } from "@/lib/auth";
import { walletBalance } from "@/lib/users";
import { money } from "@/lib/money";
import { TierBadge } from "@/components/ui";
import { logout } from "./actions/auth";

export const metadata: Metadata = {
  title: "TWO LOVE — Citas de alto perfil",
  description: "Ecosistema global de citas verificadas para personas de alto perfil: citas reales, acompañamiento social, Salas TWO LOVE y concierge.",
};

const MEMBER_NAV = [
  ["/descubrir", "Descubrir"],
  ["/acompanantes", "Acompañamiento"],
  ["/salas", "Salas TWO LOVE"],
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
  ["/admin/seguridad", "Seguridad"],
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const nav = user?.role === "admin" ? ADMIN_NAV : MEMBER_NAV;
  const wallet = user && user.role !== "admin" ? walletBalance(user.id) : null;

  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Playfair+Display:wght@500;600&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen">
        <header className="sticky top-0 z-30 border-b border-line bg-ink/90 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
            <Link href={user ? (user.role === "admin" ? "/admin" : "/descubrir") : "/"} className="whitespace-nowrap font-display text-xl tracking-[0.15em] md:text-2xl md:tracking-[0.2em]">
              <span className="gold-text">TWO LOVE</span>
            </Link>
            {user ? (
              <div className="flex items-center gap-3 text-sm">
                {wallet && (
                  <Link href="/billetera" className="chip-gold hidden sm:inline-flex" title="Saldo de billetera">
                    ◈ {money(wallet.balance)}
                  </Link>
                )}
                <TierBadge tier={user.tier} />
                {user.role !== "admin" && (
                  <Link href="/perfil/editar" className="text-muted hover:text-gold-2">{user.name.split(" ")[0]}</Link>
                )}
                <form action={logout}>
                  <button className="text-muted hover:text-rose" type="submit">Salir</button>
                </form>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/entrar" className="btn-ghost px-3 md:px-5">Entrar</Link>
                <Link href="/registro" className="btn-gold whitespace-nowrap px-3 md:px-5">Unirme</Link>
              </div>
            )}
          </div>
          {user && (
            <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2 text-sm">
              {nav.map(([href, label]) => (
                <Link key={href} href={href} className="whitespace-nowrap rounded-full px-3 py-1.5 text-muted hover:bg-ink-3 hover:text-gold-2">
                  {label}
                </Link>
              ))}
              {user.role !== "admin" && (
                <Link href="/verificacion" className="whitespace-nowrap rounded-full px-3 py-1.5 text-muted hover:bg-ink-3 hover:text-gold-2">Verificación</Link>
              )}
            </nav>
          )}
        </header>
        <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
        <footer className="mt-16 border-t border-line">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 text-sm text-muted md:grid-cols-4">
            <div>
              <div className="font-display text-lg tracking-[0.2em] text-gold">TWO LOVE</div>
              <p className="mt-2">Citas verificadas para personas de alto perfil. Dubái · Abu Dabi · Doha · Riad · Mónaco · Londres.</p>
            </div>
            <div>
              <div className="mb-2 text-ivory">Seguridad</div>
              <p>Verificación de identidad, foto, perfil psicológico, médico y seguro de vida. Pagos en custodia.</p>
            </div>
            <div>
              <div className="mb-2 text-ivory">Código de conducta</div>
              <p>El acompañamiento social es estrictamente platónico. Tolerancia cero con servicios sexuales, acoso o fraude.</p>
            </div>
            <div>
              <div className="mb-2 text-ivory">Legal</div>
              <p>Solo mayores de 21 años. Datos sensibles cifrados y tratados conforme a la PDPL de EAU y el RGPD.</p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
