-- NONCHALANT FC - Squad Rating : initial schema

CREATE TABLE users (
  telegram_id   BIGINT PRIMARY KEY,
  username      TEXT,
  first_name    TEXT,
  last_name     TEXT,
  language_code TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pricing plans. Prices are editable from the admin dashboard.
CREATE TABLE plans (
  code               TEXT PRIMARY KEY CHECK (code IN ('free','standard','express')),
  name               TEXT NOT NULL,
  price              NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  priority           SMALLINT NOT NULL,             -- 1 = highest
  guaranteed_feature BOOLEAN NOT NULL,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO plans (code, name, price, priority, guaranteed_feature) VALUES
  ('free',     'Бесплатный', 0,     3, false),
  ('standard', 'Стандарт', 5.00,  2, true),
  ('express',  'Экспресс', 15.00, 1, true);

-- Key/value admin settings (currency, payment instructions)
CREATE TABLE settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO settings (key, value) VALUES
  ('currency', 'USD'),
  ('payment_instructions', E'Реквизиты для оплаты пока настраиваются. Свяжитесь с нами, прежде чем отправлять деньги.');

CREATE TABLE squad_submissions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
  nickname   TEXT NOT NULL,
  fc_uid     TEXT NOT NULL,
  image_key  TEXT NOT NULL,
  image_mime TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX squad_submissions_user_idx ON squad_submissions(user_id);

CREATE TABLE orders (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code           TEXT NOT NULL UNIQUE,
  user_id              BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
  submission_id        UUID NOT NULL REFERENCES squad_submissions(id) ON DELETE CASCADE,
  plan_code            TEXT NOT NULL REFERENCES plans(code),
  price                NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency             TEXT NOT NULL DEFAULT 'USD',
  payment_status       TEXT NOT NULL DEFAULT 'not_required'
                         CHECK (payment_status IN ('not_required','pending','confirmed','rejected')),
  eval_status          TEXT NOT NULL DEFAULT 'submitted'
                         CHECK (eval_status IN ('submitted','in_queue','being_evaluated','evaluated','rejected')),
  publish_status       TEXT NOT NULL DEFAULT 'not_published'
                         CHECK (publish_status IN ('not_published','published')),
  video_url            TEXT,
  rating_score         NUMERIC(5,1),
  rating_note          TEXT,
  admin_note           TEXT,
  queue_rank           DOUBLE PRECISION,           -- lower = earlier; NULL = not in queue
  idempotency_key      TEXT,
  payment_confirmed_at TIMESTAMPTZ,
  evaluated_at         TIMESTAMPTZ,
  published_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key)
);
CREATE INDEX orders_user_idx   ON orders(user_id, created_at DESC);
CREATE INDEX orders_queue_idx  ON orders(queue_rank) WHERE queue_rank IS NOT NULL;
CREATE INDEX orders_plan_idx   ON orders(plan_code);

CREATE TABLE payments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id          BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
  amount           NUMERIC(12,2) NOT NULL,
  currency         TEXT NOT NULL,
  method           TEXT NOT NULL DEFAULT 'manual',
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','rejected')),
  reference        TEXT,
  user_reported_at TIMESTAMPTZ,
  reviewed_by      BIGINT,
  reviewed_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX payments_order_idx ON payments(order_id);
CREATE INDEX payments_status_idx ON payments(status);

CREATE TABLE notifications (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL,
  order_id   UUID REFERENCES orders(id) ON DELETE SET NULL,
  type       TEXT NOT NULL,
  message    TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','failed')),
  reply_markup JSONB,
  attempts   INT NOT NULL DEFAULT 0,
  error      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at    TIMESTAMPTZ
);
CREATE INDEX notifications_order_idx ON notifications(order_id);

CREATE INDEX notifications_status_idx ON notifications(status, created_at);
