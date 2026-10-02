import type { Metadata } from "next";
import Link from "next/link";
import crypto from "node:crypto";
import { run } from "@/lib/db";
import { optoutToken } from "@/lib/email";
import { getT } from "@/lib/i18n";
import { sp, type SP } from "@/components/ui";

export const metadata: Metadata = { robots: { index: false, follow: false } };

// Baja de comunicaciones comerciales desde el enlace firmado del correo
export default async function Unsubscribe({ searchParams }: { searchParams: SP }) {
  const t = await getT();
  const q = await searchParams;
  const email = (sp(q.e) ?? "").trim().toLowerCase();
  const token = sp(q.t) ?? "";
  const expected = email ? optoutToken(email) : "";
  const valid = !!email && token.length === expected.length && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  if (valid) run("INSERT OR IGNORE INTO email_optout (email) VALUES (?)", email);
  return (
    <div className="mx-auto max-w-md text-center">
      <h1 className="h1">{valid ? t("Te has dado de baja") : t("Enlace no válido")}</h1>
      <p className="mt-3 text-muted">
        {valid ? t("No volverás a recibir comunicaciones comerciales de TWO LOVE en {email}. Seguirás recibiendo los correos de tus reservas y pagos.", { email })
          : t("Usa el enlace completo que aparece al final del correo.")}
      </p>
      <Link href="/" className="btn-ghost mt-8">{t("Volver a TWO LOVE")}</Link>
    </div>
  );
}
