CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY, rzp_order_id TEXT UNIQUE, rzp_payment_id TEXT, status TEXT NOT NULL,
  book_id TEXT, qty INTEGER, amount_paise INTEGER, delivery_inr INTEGER,
  name TEXT, email TEXT, phone TEXT, street1 TEXT, city TEXT, state TEXT, postcode TEXT,
  lulu_job_id TEXT, lulu_status TEXT, tracking TEXT, error TEXT, created_at TEXT
);
