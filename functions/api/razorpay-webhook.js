// Backup path: if the customer closes the tab after paying, Razorpay still tells us. Event: payment.captured
import { hmacHex, safeEq, fulfil, json, fail } from "../../lib/shared.js";
export async function onRequestPost({ request, env }) {
  const raw = await request.text();
  const sig = await hmacHex(env.RAZORPAY_WEBHOOK_SECRET, raw);
  if (!safeEq(sig, request.headers.get("x-razorpay-signature") || "")) return fail("Bad signature", 401);
  const ev = JSON.parse(raw);
  if (ev.event === "payment.captured") {
    const p = ev.payload.payment.entity;
    try { await fulfil(env, p.order_id, p.id); } catch (e) { return fail(e.message, 500); }
  }
  return json({ ok: true });
}
