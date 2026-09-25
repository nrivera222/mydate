"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { createSession, destroySession } from "@/lib/auth";
import { one, transaction } from "@/lib/db";
import { flash, str } from "@/lib/flash";
import { post } from "@/lib/ledger";
import { notify } from "@/lib/notify";
import { REFERRAL_WELCOME } from "@/lib/catalog";
import crypto from "node:crypto";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function register(fd: FormData) {
  const name = str(fd, "name", 80);
  const email = str(fd, "email", 160).toLowerCase();
  const password = str(fd, "password", 200);
  const accepted = fd.get("terms") === "on";

  const refCode = str(fd, "ref", 20).toUpperCase().replace(/[^A-Z0-9]/g, "");
  const back = refCode ? `/registro?ref=${refCode}` : "/registro";
  if (name.length < 2) flash(back, "Indica tu nombre.", "error");
  if (!EMAIL_RE.test(email)) flash(back, "Email no válido.", "error");
  if (password.length < 8) flash(back, "La contraseña debe tener al menos 8 caracteres.", "error");
  if (!accepted) flash(back, "Debes aceptar los términos, la política de privacidad y el código de conducta.", "error");
  if (one("SELECT 1 FROM users WHERE email = ?", email)) flash(back, "Ya existe una cuenta con ese email.", "error");

  const hash = await bcrypt.hash(password, 10);
  const id = transaction((conn) => {
    const referrer = refCode ? (conn.prepare("SELECT id FROM users WHERE referral_code = ? AND status = 'active'").get(refCode) as { id: number } | undefined) : undefined;
    const code = "TL" + crypto.randomBytes(3).toString("hex").toUpperCase();
    const r = conn.prepare("INSERT INTO users (email, password_hash, name, source, referral_code, referred_by) VALUES (?, ?, ?, ?, ?, ?)")
      .run(email, hash, name, referrer ? "referido" : str(fd, "source", 40) || "organico", code, referrer?.id ?? null);
    const uid = Number(r.lastInsertRowid);
    conn.prepare("INSERT INTO profiles (user_id, hue) VALUES (?, ?)").run(uid, Math.floor(Math.random() * 360));
    post(conn, uid, "bono", 25_00, "Bono de bienvenida TWO LOVE", "welcome");
    if (referrer) {
      post(conn, uid, "bono", REFERRAL_WELCOME, "Bono por invitación de un miembro", `referral:${referrer.id}`);
      notify(conn, referrer.id, "referido", `${name.split(" ")[0]} se ha unido con tu invitación`, "Ganarás tu recompensa cuando contrate su primera membresía.", "/billetera#invitar");
    }
    notify(conn, uid, "sistema", "Bienvenido/a a TWO LOVE", "Completa tu perfil y tus 5 verificaciones para empezar a conectar.", "/verificacion");
    return uid;
  });
  await createSession(id);
  redirect("/perfil/editar?ok=" + encodeURIComponent("¡Bienvenido/a a TWO LOVE! Completa tu perfil para empezar."));
}

export async function login(fd: FormData) {
  const email = str(fd, "email", 160).toLowerCase();
  const password = str(fd, "password", 200);
  const user = one<{ id: number; password_hash: string; status: string; role: string }>("SELECT id, password_hash, status, role FROM users WHERE email = ?", email);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) flash("/entrar", "Email o contraseña incorrectos.", "error");
  if (user.status !== "active") flash("/entrar", "Tu cuenta está suspendida. Contacta con soporte.", "error");
  await createSession(user.id);
  redirect(user.role === "admin" ? "/admin" : "/descubrir");
}

export async function logout() {
  await destroySession();
  redirect("/");
}
