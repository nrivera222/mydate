export type Lounge = { id: number; name: string; city: string; country: string; kind: string; description: string; capacity: number; price_hour: number; min_tier: string; amenities: string; partner: string | null };

export const KIND_ICON: Record<string, string> = { rooftop: "🌆", yate: "🛥️", desierto: "🏜️", cena_privada: "🍽️", suite: "🛎️", cafe: "☕", club: "🥃", palacio: "🏛️", spa: "🧖" };
