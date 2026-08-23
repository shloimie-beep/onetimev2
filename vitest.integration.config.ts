import { defineConfig } from 'vitest/config';

// These suites certify superseded preregistration, MFA, preview/test-lab,
// WhatsApp-assistant, Buffer/social, July-class, or provider-off contracts.
// Keep them as historical evidence, but do not let them reactivate retired
// production surfaces or override the complete-launch acceptance contract.
const supersededCompleteLaunchSuites = [
  'tests/integration/auth-crm.test.ts',
  'tests/integration/experience-preview.test.ts',
  'tests/integration/lead-capture.test.ts',
  'tests/integration/ops05-provider-control-center.test.ts',
  'tests/integration/ot46-billing-services.test.ts',
  'tests/integration/public-metadata-runtime.test.ts',
  'tests/integration/runtime-version-proof.test.ts',
  'tests/integration/tisha-bav-event-funnel.test.ts',
  'tests/integration/accounts/account-lifecycle.test.ts',
  'tests/integration/accounts/w12-100-identity-provisioning.test.ts',
  'tests/integration/classes/class-fulfillment.test.ts',
  'tests/integration/classroom/zoom-admin-test-resource.test.ts',
  'tests/integration/content/content-factory.test.ts',
  'tests/integration/content/content-library.test.ts',
  'tests/integration/content/learning-delivery-demo-route.test.ts',
  'tests/integration/content/ot110a-admin-content-workspace.test.ts',
  'tests/integration/dashboard/owner-dashboard.test.ts',
  'tests/integration/delivery/web-app-independence.test.ts',
  'tests/integration/highlevel/app-contracts.test.ts',
  'tests/integration/portals/portal-test-lab.test.ts',
  'tests/integration/security/provider-boundaries.test.ts',
  'tests/integration/social/ot86b-social-publishing.test.ts',
  'tests/integration/whatsapp/ot85-assistant.test.ts',
  'tests/integration/whatsapp/ot85-webhook-route.test.ts',
] as const;

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts', 'tests/ot-52/portal-services.test.ts'],
    exclude: [...supersededCompleteLaunchSuites],
    hookTimeout: 15_000,
    testTimeout: 20_000,
  },
});
