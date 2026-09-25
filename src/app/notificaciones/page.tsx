import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { NOTIFICATION_ICON } from "@/lib/notify";
import { markAllRead, openNotification } from "../actions/notifications";
import { Empty, PageHeader } from "@/components/ui";

export default async function Notifications() {
  const user = await requireUser();
  const rows = all<{ id: number; kind: string; title: string; body: string; href: string; read_at: string | null; created_at: string }>(
    "SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 100", user.id,
  );
  const unread = rows.filter((r) => !r.read_at).length;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Notificaciones" subtitle={unread ? `${unread} sin leer` : "Estás al día."}>
        {unread > 0 && (
          <form action={markAllRead}>
            <button className="btn-ghost" type="submit">Marcar todas como leídas</button>
          </form>
        )}
      </PageHeader>
      {rows.length === 0 ? (
        <Empty href="/descubrir" cta="Descubrir perfiles">Aquí verás tus matches, mensajes, reservas y regalos.</Empty>
      ) : (
        <ul className="card divide-y divide-line p-0">
          {rows.map((n) => (
            <li key={n.id}>
              <form action={openNotification}>
                <input type="hidden" name="id" value={n.id} />
                <button type="submit" className={`flex w-full items-start gap-4 p-4 text-left hover:bg-ink-3 ${n.read_at ? "opacity-60" : ""}`}>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold/40 text-gold-2">{NOTIFICATION_ICON[n.kind] ?? "✦"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="font-medium">{n.title}</span>
                      {!n.read_at && <span className="h-2 w-2 rounded-full bg-gold" aria-label="sin leer" />}
                    </span>
                    {n.body && <span className="block truncate text-sm text-muted">{n.body}</span>}
                  </span>
                  <span className="whitespace-nowrap text-xs text-muted">{n.created_at.slice(0, 16)}</span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
