// Shared helpers for the book store (Cloudflare Pages Functions). Secrets come from env, never from code.
export const STATE = {"Andaman and Nicobar Islands":"AN","Andhra Pradesh":"AP","Arunachal Pradesh":"AR","Assam":"AS","Bihar":"BR","Chandigarh":"CH","Chhattisgarh":"CG","Dadra and Nagar Haveli and Daman and Diu":"DH","Delhi":"DL","Goa":"GA","Gujarat":"GJ","Haryana":"HR","Himachal Pradesh":"HP","Jammu and Kashmir":"JK","Jharkhand":"JH","Karnataka":"KA","Kerala":"KL","Ladakh":"LA","Lakshadweep":"LD","Madhya Pradesh":"MP","Maharashtra":"MH","Manipur":"MN","Meghalaya":"ML","Mizoram":"MZ","Nagaland":"NL","Odisha":"OD","Puducherry":"PY","Punjab":"PB","Rajasthan":"RJ","Sikkim":"SK","Tamil Nadu":"TN","Telangana":"TS","Tripura":"TR","Uttar Pradesh":"UP","Uttarakhand":"UK","West Bengal":"WB"};

export const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
export const fail = (msg, status = 400) => json({ error: msg }, status);

export function books(env) {
  return { "book-1": {
    title: "The Awakened Mind",
    price: Number(env.BOOK_PRICE || 499),            // rupees; keep equal to the price shown on books.html
    pages: Number(env.BOOK_PAGES || 164),
    pod: env.POD_PACKAGE_ID || "0600X0900.BW.STD.PB.060UW444.MXX", // confirm with Lulu's calculator
    interior: env.INTERIOR_URL, cover: env.COVER_URL   // public https links to the two PDFs
  }};
}

export function cleanAddress(a = {}) {
  const x = { name: String(a.name || "").trim(), email: String(a.email || "").trim(), phone: String(a.phone || "").trim(),
    street1: String(a.street1 || "").trim(), city: String(a.city || "").trim(), state: String(a.state || ""), postcode: String(a.postcode || "").trim() };
  if (x.name.length < 2 || !/^[6-9]\d{9}$/.test(x.phone) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x.email) ||
      x.street1.length < 5 || x.city.length < 2 || !STATE[x.state] || !/^[1-9]\d{5}$/.test(x.postcode))
    throw new Error("Please check your delivery details.");
  return x;
}

export async function hmacHex(secret, msg) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const s = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg));
  return [...new Uint8Array(s)].map(b => b.toString(16).padStart(2, "0")).join("");
}
export function safeEq(a, b) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }

/* ---------- Lulu ---------- */
const luluBase = env => env.LULU_ENV === "live" ? "https://api.lulu.com" : "https://api.sandbox.lulu.com";
async function luluToken(env) {
  const r = await fetch(luluBase(env) + "/auth/realms/glasstree/protocol/openid-connect/token", { method: "POST",
    headers: { Authorization: "Basic " + btoa(env.LULU_CLIENT_KEY + ":" + env.LULU_CLIENT_SECRET), "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials" });
  if (!r.ok) throw new Error("Lulu sign-in failed (" + r.status + "). Check the Lulu keys and LULU_ENV.");
  return (await r.json()).access_token;
}
const luluAddr = a => ({ name: a.name, street1: a.street1, city: a.city, state_code: STATE[a.state], postcode: a.postcode, country_code: "IN", phone_number: "+91" + a.phone, email: a.email });

/** Delivery charge in rupees for this order (Lulu shipping converted, +5% cushion). Printing cost stays inside your book price. */
export async function quote(env, book, qty, a) {
  const t = await luluToken(env);
  const r = await fetch(luluBase(env) + "/print-job-cost-calculations/", { method: "POST",
    headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" },
    body: JSON.stringify({ line_items: [{ page_count: book.pages, pod_package_id: book.pod, quantity: qty }],
      shipping_address: luluAddr(a), shipping_option: env.LULU_SHIPPING || "MAIL" }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("Lulu could not price this order: " + JSON.stringify(d).slice(0, 240));
  const ship = Number(d.shipping_cost && d.shipping_cost.total_cost_incl_tax);
  const rate = d.currency === "INR" ? 1 : Number(env.LULU_TO_INR);
  if (!ship || !rate) throw new Error("Missing Lulu shipping cost or LULU_TO_INR exchange rate.");
  return { delivery: Math.ceil(ship * rate * 1.05), eta: env.ETA_TEXT || "about 2 to 3 weeks", raw: d };
}

async function createPrintJob(env, row, book) {
  const t = await luluToken(env);
  const r = await fetch(luluBase(env) + "/print-jobs/", { method: "POST",
    headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" },
    body: JSON.stringify({ contact_email: row.email, external_id: row.id, production_delay: 120,
      line_items: [{ external_id: row.id + "-1", title: book.title, quantity: row.qty,
        printable_normalization: { pod_package_id: book.pod, cover: { source_url: book.cover }, interior: { source_url: book.interior } } }],
      shipping_address: luluAddr(row), shipping_level: env.LULU_SHIPPING || "MAIL" }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("Lulu rejected the print job: " + JSON.stringify(d).slice(0, 300));
  return d.id;
}

/** Runs once per paid order, whether called from the browser or from the Razorpay webhook. */
export async function fulfil(env, rzpOrderId, paymentId) {
  const row = await env.DB.prepare("SELECT * FROM orders WHERE rzp_order_id=?").bind(rzpOrderId).first();
  if (!row) throw new Error("Unknown order");
  const claim = await env.DB.prepare("UPDATE orders SET status='paid', rzp_payment_id=? WHERE rzp_order_id=? AND status='created'").bind(paymentId, rzpOrderId).run();
  if (!claim.meta.changes) return row.id;            // already handled
  try {
    const jobId = await createPrintJob(env, row, books(env)[row.book_id]);
    await env.DB.prepare("UPDATE orders SET status='submitted', lulu_job_id=? WHERE id=?").bind(String(jobId), row.id).run();
  } catch (e) {
    await env.DB.prepare("UPDATE orders SET status='print_failed', error=? WHERE id=?").bind(String(e.message).slice(0, 500), row.id).run();
  }
  return row.id;
}
