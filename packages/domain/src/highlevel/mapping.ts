import type { HighLevelContact } from './client.ts';
import {
  decideHighLevelContactMatch,
  normalizeHighLevelEmail,
  normalizeHighLevelPhone,
} from './normalization.ts';

export type LocalParentCandidate = {
  parentUserKey: string;
  householdKey: string;
  email: string | null;
  phone: string | null;
};

export type MappingDecision =
  | { disposition: 'link'; parentUserKey: string; householdKey: string; ghlContactId: string }
  | {
      disposition: 'sync_conflict';
      parentUserKey: string;
      emailContactId: string;
      phoneContactId: string;
    }
  | { disposition: 'not_found'; parentUserKey: string };

export function planManualUploadMapping(input: {
  localParents: readonly LocalParentCandidate[];
  highLevelContacts: readonly HighLevelContact[];
}) {
  const decisions: MappingDecision[] = [];
  for (const parent of input.localParents) {
    const byEmail = input.highLevelContacts.find(
      (contact) => contact.email && contact.email === normalizeHighLevelEmail(parent.email),
    );
    const byPhone = input.highLevelContacts.find(
      (contact) => contact.phone && contact.phone === normalizeHighLevelPhone(parent.phone),
    );
    const match = decideHighLevelContactMatch({ identity: parent, byEmail, byPhone });
    if (match.disposition === 'match_email' || match.disposition === 'match_phone') {
      decisions.push({
        disposition: 'link',
        parentUserKey: parent.parentUserKey,
        householdKey: parent.householdKey,
        ghlContactId: match.contactId,
      });
    } else if (match.disposition === 'sync_conflict') {
      decisions.push({
        disposition: 'sync_conflict',
        parentUserKey: parent.parentUserKey,
        emailContactId: match.emailContactId,
        phoneContactId: match.phoneContactId,
      });
    } else {
      decisions.push({ disposition: 'not_found', parentUserKey: parent.parentUserKey });
    }
  }
  return {
    mode: 'counts_only' as const,
    createsContacts: false,
    updatesHighLevel: false,
    counts: {
      link: decisions.filter((decision) => decision.disposition === 'link').length,
      sync_conflict: decisions.filter((decision) => decision.disposition === 'sync_conflict')
        .length,
      not_found: decisions.filter((decision) => decision.disposition === 'not_found').length,
    },
    decisions,
  };
}
