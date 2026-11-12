// Lulu calls this when a print job changes status. Confirm the signature header name in Lulu's Webhooks docs.
import { hmacHex, safeEq, json, fail } from "../../lib/shared.js";
export async function onRequestPost({ request, env }) {
  const raw = await request.text();
  const got = request.headers.get("Lulu-HMAC-SHA256") || "";
  if (!safeEq(await hmacHex(env.LULU_CLIENT_SECRET, raw), got)) return fail("Bad signature", 401);
  const d = (JSON.parse(raw).data) || {};
  const li = (d.line_items && d.line_items[0]) || {};
  const tracking = (li.tracking_urls && li.tracking_urls[0]) || li.tracking_id || null;
  await env.DB.prepare("UPDATE orders SET lulu_status=?, tracking=COALESCE(?,tracking) WHERE lulu_job_id=?")
    .bind(d.status && d.status.name || null, tracking, String(d.id)).run();
  return json({ ok: true });
}
