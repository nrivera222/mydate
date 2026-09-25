"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { run, transaction } from "@/lib/db";
import { flash, int, list, str } from "@/lib/flash";
import { ARCHETYPES, CITIES, COMPANION_ACTIVITIES, GENDERS, INTENTS, INTERESTS, LANGUAGES, NET_WORTH, RATE_UNITS, tierById } from "@/lib/catalog";
import { saveUpload, UploadError } from "@/lib/uploads";
import { toFils } from "@/lib/money";

const ids = <T extends { id: string }>(arr: readonly T[]) => arr.map((x) => x.id);

export async function saveProfile(fd: FormData) {
  const user = await requireUser();
  const gender = str(fd, "gender");
  const seeking = list(fd, "seeking", ids(GENDERS));
  const cityName = str(fd, "city");
  const city = CITIES.find((c) => c.city === cityName);
  const birthYear = int(fd, "birth_year");
  const year = new Date().getFullYear();

  if (!ids(GENDERS).includes(gender)) flash("/perfil/editar", "Selecciona tu género.", "error");
  if (!seeking.length) flash("/perfil/editar", "Indica qué géneros te interesan.", "error");
  if (!city) flash("/perfil/editar", "Selecciona una ciudad.", "error");
  if (birthYear < year - 90 || birthYear > year - 21) flash("/perfil/editar", "TWO LOVE es solo para mayores de 21 años.", "error");

  const archetype = str(fd, "archetype");
  const interests = list(fd, "interests", INTERESTS).slice(0, 10);
  const languages = list(fd, "languages", LANGUAGES);
  const ageMin = Math.max(21, int(fd, "age_min") || 21);
  const ageMax = Math.max(ageMin, Math.min(90, int(fd, "age_max") || 60));

  run(
    `UPDATE profiles SET gender = ?, seeking = ?, birth_year = ?, city = ?, country = ?, nationality = ?, languages = ?, archetype = ?, occupation = ?,
     net_worth = ?, intent = ?, interests = ?, bio = ?, age_min = ?, age_max = ?, real_dating = ?, incognito = ? WHERE user_id = ?`,
    gender, seeking.join(","), birthYear, city.city, city.country, str(fd, "nationality", 60), languages.join(","),
    ids(ARCHETYPES).includes(archetype) ? archetype : "", str(fd, "occupation", 120),
    ids(NET_WORTH).includes(str(fd, "net_worth")) ? str(fd, "net_worth") : "na",
    ids(INTENTS).includes(str(fd, "intent")) ? str(fd, "intent") : "noviazgo",
    interests.join(","), str(fd, "bio", 800), ageMin, ageMax,
    fd.get("real_dating") === "on" ? 1 : 0,
    fd.get("incognito") === "on" && tierById(user.tier).incognito ? 1 : 0,
    user.id,
  );
  revalidatePath("/", "layout");
  flash("/perfil/editar", "Perfil guardado.");
}

export async function saveCompanionOffer(fd: FormData) {
  const user = await requireUser();
  const enabled = fd.get("enabled") === "on";
  const rates = Object.fromEntries(RATE_UNITS.map((u) => {
    const v = Number(fd.get(`rate_${u.id}`));
    return [u.id, Number.isFinite(v) && v > 0 ? toFils(v) : null];
  })) as Record<string, number | null>;
  const headline = str(fd, "headline", 120);
  const activities = list(fd, "activities", COMPANION_ACTIVITIES);
  const agreed = fd.get("rules") === "on";

  if (enabled) {
    if (!agreed) flash("/perfil/editar#acompanamiento", "Debes aceptar el código de acompañamiento social.", "error");
    if (headline.length < 5) flash("/perfil/editar#acompanamiento", "Escribe un titular para tu oferta.", "error");
    if (!Object.values(rates).some(Boolean)) flash("/perfil/editar#acompanamiento", "Define al menos una tarifa.", "error");
  }

  transaction((conn) => {
    conn.prepare(
      `INSERT INTO companion_offers (user_id, headline, activities, rate_hour, rate_day, rate_week, rate_month, rate_year, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET headline = excluded.headline, activities = excluded.activities, rate_hour = excluded.rate_hour, rate_day = excluded.rate_day,
       rate_week = excluded.rate_week, rate_month = excluded.rate_month, rate_year = excluded.rate_year, active = excluded.active`,
    ).run(user.id, headline || "Acompañante social", activities.join(","), rates.hour, rates.day, rates.week, rates.month, rates.year, enabled ? 1 : 0);
    conn.prepare("UPDATE profiles SET companion_provider = ? WHERE user_id = ?").run(enabled ? 1 : 0, user.id);
  });
  revalidatePath("/acompanantes");
  flash("/perfil/editar#acompanamiento", enabled ? "Oferta de acompañamiento publicada." : "Oferta de acompañamiento desactivada.");
}

export async function uploadPhoto(fd: FormData) {
  const user = await requireUser();
  let rel: string | null = null;
  let err = "";
  try {
    rel = await saveUpload(fd.get("photo") as File | null, "photos");
  } catch (e) {
    err = e instanceof UploadError ? e.message : "No se pudo subir la foto.";
  }
  if (err) flash("/verificacion", err, "error");
  if (!rel) flash("/verificacion", "Selecciona una foto.", "error");
  transaction((conn) => {
    conn.prepare("UPDATE profiles SET photo_path = ? WHERE user_id = ?").run(rel, user.id);
    // Una foto nueva requiere revisión de nuevo
    conn.prepare("INSERT INTO verifications (user_id, type, status, data, file_path) VALUES (?, 'photo', 'pending', '{}', ?)").run(user.id, rel);
  });
  revalidatePath("/", "layout");
  flash("/verificacion", "Foto enviada a revisión.");
}
