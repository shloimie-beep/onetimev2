import { describe, expect, it } from 'vitest';
import { ot42CrmCapabilities } from '../../packages/contracts/src/crm/capabilities.ts';
import { capabilitiesForCrmRole } from '../../packages/domain/src/crm/ot42-capabilities.ts';
import {
  canonicalRequestHash,
  makeStrongEtag,
} from '../../packages/domain/src/crm/ot42-protocol.ts';

describe('OT-42 CRM capability model', () => {
  it('issues the full bounded CRM capability set to owner and admin only', () => {
    expect([...capabilitiesForCrmRole('owner')].sort()).toEqual([...ot42CrmCapabilities].sort());
    expect([...capabilitiesForCrmRole('admin')].sort()).toEqual([...ot42CrmCapabilities].sort());
  });

  it('keeps narrower roles deny-by-default except base-supported contact capabilities', () => {
    expect([...capabilitiesForCrmRole('crm_agent')].sort()).toEqual([
      'crm.contacts.create',
      'crm.contacts.edit',
      'crm.contacts.read',
    ]);
    expect(capabilitiesForCrmRole('viewer')).toEqual(['crm.contacts.read']);
    expect(capabilitiesForCrmRole('unexpected')).toEqual([]);
  });

  it('derives ETags from opaque identity and version only', () => {
    const first = makeStrongEtag('contact', 'contact_opaque', 7);
    const second = makeStrongEtag('contact', 'contact_opaque', 8);
    expect(first).toMatch(/^"[^"]+"$/);
    expect(first).not.toEqual(second);
    expect(first).not.toContain('person@example.test');
    expect(first).not.toContain('050');
  });

  it('canonicalizes semantic request hashes independent of object key order', () => {
    const left = canonicalRequestHash({ b: 2, a: { d: 4, c: 3 } });
    const right = canonicalRequestHash({ a: { c: 3, d: 4 }, b: 2 });
    expect(left).toEqual(right);
  });
});
