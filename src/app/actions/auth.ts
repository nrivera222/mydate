"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { createSession, destroySession } from "@/lib/auth";
import { one, transaction } from "@/lib/db";
import { flash, str } from "@/lib/flash";
import { post } from "@/lib/ledger";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function register(fd: FormData) {
  const name = str(fd, "name", 80);
  const email = str(fd, "email", 160).toLowerCase();
  const password = str(fd, "password", 200);
  const accepted = fd.get("terms") === "on";

  if (name.length < 2) flash("/registro", "Indica tu nombre.", "error");
  if (!EMAIL_RE.test(email)) flash("/registro", "Email no válido.", "error");
  if (password.length < 8) flash("/registro", "La contraseña debe tener al menos 8 caracteres.", "error");
  if (!accepted) flash("/registro", "Debes aceptar los términos, la política de privacidad y el código de conducta.", "error");
  if (one("SELECT 1 FROM users WHERE email = ?", email)) flash("/registro", "Ya existe una cuenta con ese email.", "error");

  const hash = await bcrypt.hash(password, 10);
  const id = transaction((conn) => {
    const r = conn.prepare("INSERT INTO users (email, password_hash, name, source) VALUES (?, ?, ?, ?)").run(email, hash, name, str(fd, "source", 40) || "organico");
    const uid = Number(r.lastInsertRowid);
    conn.prepare("INSERT INTO profiles (user_id, hue) VALUES (?, ?)").run(uid, Math.floor(Math.random() * 360));
    post(conn, uid, "bono", 25_00, "Bono de bienvenida TWO LOVE", "welcome");
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
