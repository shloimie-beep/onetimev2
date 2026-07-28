import type {
  GhlAdultClassification,
  GhlAdultSegmentFacts,
} from '../../../../contracts/src/communications/ghl-identity/index.ts';
import type { AdultGhlIdentityLink } from '../../../../contracts/src/providers/v21-provider-core.ts';

export function classifyGhlAdult(
  link: AdultGhlIdentityLink,
  facts: GhlAdultSegmentFacts,
): GhlAdultClassification {
  if (link.state === 'identity_review') return 'review';
  if (link.suppression.marketing_suppressed || link.suppression.service_suppressed) {
    return 'suppressed';
  }
  if (facts.approved_active_legacy_segment && facts.has_active_membership) {
    return 'active_legacy';
  }
  if (facts.former_or_canceled && !facts.has_active_membership) {
    return 'former_canceled';
  }
  if (facts.explicit_marketing_opt_in && !facts.has_active_membership) {
    return 'opted_in_lead';
  }
  return 'review';
}
