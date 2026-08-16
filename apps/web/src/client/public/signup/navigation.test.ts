import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { familySignupPostSuccessDestination, familySignupRequestTarget } from './navigation.ts';

const familySignupPaths = ['/api/v1/signup/family/bootstrap', '/api/v1/signup/family'] as const;

describe('Parent-first Family signup navigation', () => {
  it('keeps the essential form controls while removing the repetitive signup exposition', async () => {
    const publicPages = await readFile('scripts/build-public-pages.ts', 'utf8');
    expect(publicPages).toContain('<h1>Create Family Account</h1>');
    expect(publicPages).toContain('minlength="6" maxlength="128" required');
    expect(publicPages).not.toContain('minlength="12"');
    expect(publicPages).toContain('data-family-fields aria-label="Family account details"');
    expect(publicPages).toContain('<label for="first_name">First name</label>');
    expect(publicPages).toContain('<fieldset class="required-acceptances">');
    expect(publicPages).toContain('type="submit"');
    for (const removedCopy of [
      'Create one adult-managed Family account, then add up to three Students',
      'Free access ends Friday, September 11, 2026',
      'Create the adult Family account',
      'One adult account can manage up to three separate learner seats',
      'No credit card required. Free access ends September 11, 2026',
      '$67/month after account creation through secure hosted checkout',
    ]) {
      expect(publicPages).not.toContain(removedCopy);
    }
  });

  it('uses the canonical app origin with included credentials for both Family requests on join', () => {
    for (const path of familySignupPaths) {
      expect(familySignupRequestTarget(path, 'https://join.onetimeonetime.com')).toEqual({
        url: `https://app.onetimeonetime.com${path}`,
        credentials: 'include',
      });
    }
  });

  it('keeps both Family requests same-origin outside the exact canonical join origin', () => {
    for (const origin of [
      'http://127.0.0.1:3100',
      'https://staging.onetimeonetime.com',
      'https://join.onetimeonetime.com.evil.test',
    ]) {
      for (const path of familySignupPaths) {
        expect(familySignupRequestTarget(path, origin)).toEqual({
          url: path,
          credentials: 'same-origin',
        });
      }
    }
  });

  it('opens authenticated Parent Today immediately and ignores a stale deep-link override', () => {
    expect(
      familySignupPostSuccessDestination(
        {
          code: 'FAMILY_SIGNUP_COMPLETE',
          session_established: true,
          continue_to: '/app/parent/account',
          provider_projection_state: 'ready',
        },
        '/app/parent/students/new',
      ),
    ).toEqual({ kind: 'application', path: '/app/parent' });
  });

  it('keeps the safe receipt path when an authenticated session was not established', () => {
    expect(
      familySignupPostSuccessDestination({
        code: 'SIGNUP_COMMITTED_SESSION_UNAVAILABLE',
        session_established: false,
        provider_projection_state: 'readback_required',
      }),
    ).toEqual({
      kind: 'public',
      path: '/signup/received?state=session_pending&email=pending',
    });
  });
});
