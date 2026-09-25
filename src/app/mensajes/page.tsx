import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { Avatar, Empty, Flash, PageHeader, sp, type SP } from "@/components/ui";

type Conversation = { id: number; name: string; hue: number; photo_path: string | null; last_body: string | null; last_at: string | null; via: string };

export default async function Inbox({ searchParams }: { searchParams: SP }) {
  const user = await requireUser();
  const q = await searchParams;
  const rows = all<Conversation>(
    `WITH contacts AS (
       SELECT l.to_id AS id, 'match' AS via FROM likes l JOIN likes r ON r.from_id = l.to_id AND r.to_id = l.from_id
        WHERE l.from_id = ? AND l.kind != 'pass' AND r.kind != 'pass'
       UNION
       SELECT CASE WHEN client_id = ? THEN provider_id ELSE client_id END, 'reserva' FROM bookings
        WHERE kind = 'companion' AND (client_id = ? OR provider_id = ?) AND status IN ('requested','accepted','completed')
     )
     SELECT u.id, u.name, p.hue, p.photo_path, MIN(c.via) AS via,
       (SELECT body FROM messages m WHERE (m.from_id = u.id AND m.to_id = ?) OR (m.from_id = ? AND m.to_id = u.id) ORDER BY m.id DESC LIMIT 1) AS last_body,
       (SELECT created_at FROM messages m WHERE (m.from_id = u.id AND m.to_id = ?) OR (m.from_id = ? AND m.to_id = u.id) ORDER BY m.id DESC LIMIT 1) AS last_at
     FROM contacts c JOIN users u ON u.id = c.id JOIN profiles p ON p.user_id = u.id
     WHERE u.id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = ?) AND u.id NOT IN (SELECT blocker_id FROM blocks WHERE blocked_id = ?)
     GROUP BY u.id ORDER BY last_at IS NULL, last_at DESC`,
    user.id, user.id, user.id, user.id, user.id, user.id, user.id, user.id, user.id, user.id,
  );

  return (
    <div>
      <PageHeader title="Mensajes" subtitle="Conversaciones con tus matches y con las personas con las que tienes reservas." />
      <Flash ok={sp(q.ok)} error={sp(q.error)} />
      {rows.length === 0 ? (
        <Empty href="/descubrir" cta="Descubrir perfiles">Aún no tienes matches. ¡Da tu primer like!</Empty>
      ) : (
        <ul className="card divide-y divide-line p-0">
          {rows.map((c) => (
            <li key={c.id}>
              <Link href={`/mensajes/${c.id}`} className="flex items-center gap-4 p-4 hover:bg-ink-3">
                <Avatar name={c.name} hue={c.hue} photo={c.photo_path} size={48} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{c.name}</span>
                    <span className={c.via === "match" ? "chip-gold" : "chip"}>{c.via === "match" ? "Match" : "Reserva"}</span>
                  </div>
                  <p className="truncate text-sm text-muted">{c.last_body ?? "Nuevo match — ¡saluda!"}</p>
                </div>
                {c.last_at && <span className="text-xs text-muted">{c.last_at.slice(0, 16)}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
