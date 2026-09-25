export type EventRow = {
  id: number; title: string; city: string; venue: string; starts_at: string; description: string; capacity: number; price: number;
  min_tier: string; emoji: string; status: string; partner: string | null; sold: number;
};

export const EVENT_SELECT = `SELECT e.*, p.name AS partner,
  (SELECT COUNT(*) FROM event_tickets t WHERE t.event_id = e.id AND t.status = 'confirmada') AS sold
  FROM events e LEFT JOIN partners p ON p.id = e.partner_id`;
