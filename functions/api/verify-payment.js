import { hmacHex, safeEq, fulfil, json, fail } from "../../lib/shared.js";
export async function onRequestPost({ request, env }) {
  try {
    const b = await request.json();
    const sig = await hmacHex(env.RAZORPAY_KEY_SECRET, b.razorpay_order_id + "|" + b.razorpay_payment_id);
    if (!safeEq(sig, String(b.razorpay_signature || ""))) return fail("Payment could not be verified.", 400);
    return json({ ok: true, orderRef: await fulfil(env, b.razorpay_order_id, b.razorpay_payment_id) });
  } catch (e) { return fail(e.message, 500); }
}
