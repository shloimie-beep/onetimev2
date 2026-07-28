import type {
  CommunicationsReview,
  CommunicationsWorkflowReadback,
  GovernedWorkflowAction,
  GovernedWorkflowRequest,
} from '../../../../contracts/src/communications/foundation/index.ts';
import { CommunicationFoundationError } from './errors.ts';

export function buildCommunicationsReview(
  actor_role: 'admin' | 'parent' | 'student',
  load: () => CommunicationsWorkflowReadback,
): CommunicationsReview {
  if (actor_role !== 'admin') {
    throw new CommunicationFoundationError('non_admin_forbidden');
  }
  const readback = load();
  assertSafeGhlUrl(readback.safe_ghl_url);
  return {
    visible_to: 'admin',
    readback,
    controls: ['start', 'pause'],
    campaign_authoring_location: 'GHL',
    exposes_campaign_editor: false,
    exposes_test_send: false,
    exposes_seed_send: false,
    exposes_provider_canary: false,
  };
}

export function planGovernedWorkflowRequest(input: {
  actor_role: 'admin' | 'parent' | 'student';
  admin_id: string;
  request_id: string;
  requested_at: string;
  action: GovernedWorkflowAction;
  readback: CommunicationsWorkflowReadback;
}): GovernedWorkflowRequest {
  if (input.actor_role !== 'admin') {
    throw new CommunicationFoundationError('non_admin_forbidden');
  }
  if (
    input.readback.delivery.status === 'unavailable' ||
    input.readback.delivery.provider_read_at === null
  ) {
    throw new CommunicationFoundationError('provider_readback_required');
  }
  assertSafeGhlUrl(input.readback.safe_ghl_url);
  return {
    request_id: input.request_id,
    workflow_key: input.readback.workflow_key,
    requested_by_admin_id: input.admin_id,
    action: input.action,
    requested_at: input.requested_at,
    provider_readback_ref: input.readback.delivery.safe_evidence_ref,
    audited: true,
    direct_provider_mutation: false,
  };
}

function assertSafeGhlUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new CommunicationFoundationError('unsafe_ghl_url');
  }
  const allowed =
    url.protocol === 'https:' &&
    (url.hostname === 'app.gohighlevel.com' || url.hostname.endsWith('.gohighlevel.com')) &&
    url.search === '' &&
    url.hash === '';
  if (!allowed || url.username || url.password) {
    throw new CommunicationFoundationError('unsafe_ghl_url');
  }
}
