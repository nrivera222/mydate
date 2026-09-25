import { transaction } from "@/lib/db";
import { post } from "@/lib/ledger";
import { money } from "@/lib/money";
import { notify } from "@/lib/notify";
import { verifyStripeSignature } from "@/lib/payments";

// Webhook de Stripe: abona la recarga cuando el pago se confirma (idempotente).
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response("Webhook no configurado", { status: 503 });
  const payload = await req.text();
  if (!verifyStripeSignature(payload, req.headers.get("stripe-signature"), secret)) return new Response("Firma no válida", { status: 400 });

  const event = JSON.parse(payload) as { type: string; data: { object: { id: string; payment_status?: string } } };
  const session = event.data.object;
  if (event.type === "checkout.session.completed" && session.payment_status === "paid") {
    transaction((conn) => {
      const payment = conn.prepare("SELECT id, user_id, amount FROM payments WHERE external_id = ? AND status = 'pendiente'").get(session.id) as
        | { id: number; user_id: number; amount: number }
        | undefined;
      if (!payment) return; // ya procesado o desconocido
      conn.prepare("UPDATE payments SET status = 'pagado' WHERE id = ?").run(payment.id);
      post(conn, payment.user_id, "recarga", payment.amount, "Recarga con tarjeta (Stripe)", `stripe:${session.id}`);
      notify(conn, payment.user_id, "sistema", `Recarga de ${money(payment.amount)} completada`, "", "/billetera");
    });
  } else if (event.type === "checkout.session.expired") {
    transaction((conn) => conn.prepare("UPDATE payments SET status = 'fallido' WHERE external_id = ? AND status = 'pendiente'").run(session.id));
  }
  return Response.json({ received: true });
}
