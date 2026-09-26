import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { getProfile, isBlockedBetween } from "@/lib/users";
import { sendMessage } from "../../actions/social";
import { Avatar, Flash, sp, type SP } from "@/components/ui";
import { getT } from "@/lib/i18n";

export default async function Thread({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const t = await getT();
  const user = await requireUser();
  const { id } = await params;
  const q = await searchParams;
  const other = getProfile(Number(id));
  if (!other || other.user_id === user.id || isBlockedBetween(user.id, other.user_id)) notFound();
  const msgs = all<{ id: number; from_id: number; body: string; created_at: string }>(
    "SELECT id, from_id, body, created_at FROM messages WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?) ORDER BY id",
    user.id, other.user_id, other.user_id, user.id,
  );

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-4">
        <Avatar name={other.name} hue={other.hue} photo={other.photo_path} size={56} />
        <div className="flex-1">
          <Link href={`/perfil/${other.user_id}`} className="font-display text-2xl hover:text-gold-2">{other.name}</Link>
          <div className="text-sm text-muted">{t(other.city)} · {other.occupation}</div>
        </div>
        <Link href={`/regalos?to=${other.user_id}`} className="btn-ghost">{t("🎁 Regalo")}</Link>
        <Link href="/salas" className="btn-ghost hidden sm:inline-flex">{t("Proponer Sala")}</Link>
      </div>
      <Flash ok={sp(q.ok)} error={sp(q.error)} />
      <div className="card min-h-[320px] space-y-3">
        {msgs.length === 0 && <p className="py-10 text-center text-muted">{t("Sé original: menciona un interés en común o propón una Sala TWO LOVE.")}</p>}
        {msgs.map((m) => (
          <div key={m.id} className={`flex ${m.from_id === user.id ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${m.from_id === user.id ? "bg-gold text-ink" : "bg-ink-3"}`}>
              <p className="whitespace-pre-wrap">{m.body}</p>
              <div className={`mt-1 text-[10px] ${m.from_id === user.id ? "text-ink/60" : "text-muted"}`}>{m.created_at.slice(0, 16)}</div>
            </div>
          </div>
        ))}
      </div>
      <form action={sendMessage} className="mt-4 flex gap-2">
        <input type="hidden" name="to" value={other.user_id} />
        <input className="input flex-1" name="body" placeholder={t("Escribe un mensaje…")} maxLength={1000} autoComplete="off" required />
        <button className="btn-gold" type="submit">{t("Enviar")}</button>
      </form>
      <p className="mt-2 text-xs text-muted">{t("🔒 Por tu seguridad, no compartas teléfonos ni datos bancarios. Todos los pagos se hacen dentro de TWO LOVE.")}</p>
    </div>
  );
}
