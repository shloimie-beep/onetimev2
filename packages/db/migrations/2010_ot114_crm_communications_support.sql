UPDATE onetime.support_submissions
   SET category = CASE category
     WHEN 'bug' THEN 'technical_bug'
     WHEN 'complaint' THEN 'other'
     ELSE category
   END
 WHERE category IN ('bug', 'complaint');

ALTER TABLE onetime.support_submissions
  DROP CONSTRAINT IF EXISTS support_submissions_category_check;

ALTER TABLE onetime.support_submissions
  DROP CONSTRAINT IF EXISTS support_submissions_constraint_5;

ALTER TABLE onetime.support_submissions
  ADD CONSTRAINT support_submissions_category_check
  CHECK (
    category IN (
      'access_login',
      'class_zoom',
      'billing',
      'content',
      'technical_bug',
      'account_family',
      'other'
    )
  );

CREATE TABLE onetime.crm_reply_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_key text NOT NULL UNIQUE,
  account_key text NOT NULL,
  product_key text NOT NULL,
  contact_key text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  destination_masked text NOT NULL,
  body_revision text NOT NULL,
  body_text text NOT NULL CHECK (body_text <> ''),
  preview_fingerprint text NOT NULL CHECK (preview_fingerprint = lower(preview_fingerprint)),
  idempotency_key text NOT NULL,
  actor_user_key text NOT NULL,
  provider_mode text NOT NULL DEFAULT 'provider_off_draft'
    CHECK (provider_mode = 'provider_off_draft'),
  external_send_attempted boolean NOT NULL DEFAULT false,
  outbox_delivery_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, product_key, actor_user_key, idempotency_key),
  FOREIGN KEY (account_key, product_key, contact_key)
    REFERENCES onetime.contacts(account_key, product_key, contact_key)
);

CREATE INDEX crm_reply_drafts_contact_idx
  ON onetime.crm_reply_drafts(account_key, product_key, contact_key, created_at DESC);
