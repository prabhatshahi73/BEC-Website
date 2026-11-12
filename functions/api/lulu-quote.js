import { books, cleanAddress, quote, json, fail } from "../../lib/shared.js";
export async function onRequestPost({ request, env }) {
  try {
    const b = await request.json(), book = books(env)[b.bookId], qty = parseInt(b.quantity, 10);
    if (!book || !(qty >= 1 && qty <= 5)) return fail("Unknown book or quantity.");
    const a = cleanAddress({ ...b.address, street1: b.address && b.address.street1, postcode: b.address && b.address.postcode });
    const q = await quote(env, book, qty, a);
    return json({ delivery: q.delivery, eta: q.eta, quoteId: "server-recalculated" });
  } catch (e) { return fail(e.message, 400); }
}
