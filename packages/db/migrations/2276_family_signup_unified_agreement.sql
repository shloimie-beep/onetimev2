ALTER TABLE onetime.family_signup_consents
  DROP CONSTRAINT IF EXISTS family_signup_consents_consent_scope_check;

ALTER TABLE onetime.family_signup_consents
  ADD CONSTRAINT family_signup_consents_consent_scope_check CHECK (consent_scope IN (
    'terms',
    'privacy',
    'student_data_child_safety',
    'cancellation_refund',
    'general_marketing',
    'parent_newsletter'
  ));

ALTER TABLE onetime.family_signup_consents
  ADD COLUMN policy_version text;
