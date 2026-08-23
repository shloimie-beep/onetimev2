-- Bind the existing single-use lifecycle delivery system to canonical v2.1
-- HumanAccounts without weakening the legacy account-user foreign keys.
ALTER TABLE onetime.account_lifecycle_tokens
  ADD COLUMN subject_human_account_id text
    REFERENCES onetime.v21_human_accounts(human_account_id) ON DELETE RESTRICT;

ALTER TABLE onetime.account_lifecycle_tokens
  ADD CONSTRAINT account_lifecycle_tokens_subject_kind_check
    CHECK (NOT (
      subject_user_key IS NOT NULL
      AND subject_human_account_id IS NOT NULL
    ));

CREATE INDEX account_lifecycle_tokens_human_account_idx
  ON onetime.account_lifecycle_tokens(
    account_key,
    product_key,
    subject_human_account_id,
    created_at DESC
  )
  WHERE subject_human_account_id IS NOT NULL;

SELECT 1;
