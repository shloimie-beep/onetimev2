import { APPLICATION_ORIGIN, TRANSITION_ORIGIN } from '../domain-transition/links.js';

export type FamilySignupRequestPath = '/api/v1/signup/family/bootstrap' | '/api/v1/signup/family';

export type FamilySignupRequestTarget = {
  url: FamilySignupRequestPath | `${typeof APPLICATION_ORIGIN}${FamilySignupRequestPath}`;
  credentials: 'include' | 'same-origin';
};

export type FamilySignupReceiptState =
  'session_pending' | 'sign_in' | 'identity_review' | 'checkout_queued' | 'support' | 'received';

export type FamilySignupSuccessResponse = {
  code?: string;
  session_established?: boolean;
  continue_to?: string;
  provider_projection_state?: string;
};

export type FamilySignupPostSuccessDestination =
  | { kind: 'application'; path: '/app/parent' }
  | { kind: 'public'; path: `/signup/received?${string}` };

export function familySignupRequestTarget(
  path: FamilySignupRequestPath,
  currentOrigin: string,
): FamilySignupRequestTarget {
  if (currentOrigin === TRANSITION_ORIGIN) {
    return {
      url: `${APPLICATION_ORIGIN}${path}`,
      credentials: 'include',
    };
  }
  return { url: path, credentials: 'same-origin' };
}

export function familySignupPostSuccessDestination(
  response: FamilySignupSuccessResponse,
  _requestedContinueTo?: string | null,
): FamilySignupPostSuccessDestination {
  if (response.session_established === true) {
    return { kind: 'application', path: '/app/parent' };
  }
  const search = new URLSearchParams({
    state: familySignupReceiptState(response),
    email: response.provider_projection_state === 'ready' ? 'sent' : 'pending',
  });
  return { kind: 'public', path: `/signup/received?${search.toString()}` };
}

function familySignupReceiptState(response: FamilySignupSuccessResponse): FamilySignupReceiptState {
  if (response.code === 'SIGN_IN_OR_RESET') return 'sign_in';
  if (response.code === 'SIGNUP_COMMITTED_IDENTITY_REVIEW') return 'identity_review';
  if (response.code === 'SIGNUP_COMMITTED_CHECKOUT_HANDOFF_QUEUED') return 'checkout_queued';
  if (response.code === 'SIGNUP_COMMITTED_SUPPORT_REQUIRED') return 'support';
  if (response.code === 'SIGNUP_COMMITTED_SESSION_UNAVAILABLE') return 'session_pending';
  return 'received';
}
