"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { one, run } from "@/lib/db";
import { int } from "@/lib/flash";

export async function markAllRead() {
  const user = await requireUser();
  run("UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL", user.id);
  revalidatePath("/", "layout");
  redirect("/notificaciones");
}

/** Marca como leída y navega a su destino. */
export async function openNotification(fd: FormData) {
  const user = await requireUser();
  const n = one<{ href: string }>("SELECT href FROM notifications WHERE id = ? AND user_id = ?", int(fd, "id"), user.id);
  run("UPDATE notifications SET read_at = COALESCE(read_at, datetime('now')) WHERE id = ? AND user_id = ?", int(fd, "id"), user.id);
  revalidatePath("/", "layout");
  // Solo rutas internas
  redirect(n?.href && n.href.startsWith("/") && !n.href.startsWith("//") ? n.href : "/notificaciones");
}
