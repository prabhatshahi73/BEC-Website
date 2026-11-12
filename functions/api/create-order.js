import { books, cleanAddress, quote, json, fail } from "../../lib/shared.js";
export async function onRequestPost({ request, env }) {
  try {
    const b = await request.json(), book = books(env)[b.bookId], qty = parseInt(b.quantity, 10);
    if (!book || !(qty >= 1 && qty <= 5)) return fail("Unknown book or quantity.");
    const a = cleanAddress(b.address);
    const q = await quote(env, book, qty, a);                       // price is always worked out here, never trusted from the browser
    const amount = Math.round((book.price * qty + q.delivery) * 100);
    const ref = "AM-" + crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
    const r = await fetch("https://api.razorpay.com/v1/orders", { method: "POST",
      headers: { Authorization: "Basic " + btoa(env.RAZORPAY_KEY_ID + ":" + env.RAZORPAY_KEY_SECRET), "Content-Type": "application/json" },
      body: JSON.stringify({ amount, currency: "INR", receipt: ref, notes: { book: b.bookId, qty: String(qty) } }) });
    const o = await r.json();
    if (!r.ok) return fail("Could not start the payment. Please try again.", 502);
    await env.DB.prepare("INSERT INTO orders (id,rzp_order_id,status,book_id,qty,amount_paise,delivery_inr,name,email,phone,street1,city,state,postcode,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(ref, o.id, "created", b.bookId, qty, amount, q.delivery, a.name, a.email, a.phone, a.street1, a.city, a.state, a.postcode, new Date().toISOString()).run();
    return json({ key: env.RAZORPAY_KEY_ID, orderId: o.id, amount, currency: "INR" });
  } catch (e) { return fail(e.message, 400); }
}
