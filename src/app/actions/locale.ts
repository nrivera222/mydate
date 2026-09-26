"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { isLocale, LOCALE_COOKIE } from "@/lib/i18n";

export async function setLocale(fd: FormData) {
  const lang = fd.get("lang");
  if (typeof lang === "string" && isLocale(lang)) {
    (await cookies()).set(LOCALE_COOKIE, lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }
  // Volver a la misma página (solo rutas internas)
  const referer = (await headers()).get("referer");
  let back = "/";
  try {
    if (referer) {
      const u = new URL(referer);
      back = u.pathname + u.search.replace(/([?&])(ok|error)=[^&]*/g, "$1").replace(/[?&]+$/, "");
    }
  } catch {}
  redirect(back.startsWith("/") && !back.startsWith("//") ? back : "/");
}
