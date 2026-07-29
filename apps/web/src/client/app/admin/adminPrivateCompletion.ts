export type AdminClientAuthorization = {
  state: 'admin' | 'signed_out' | 'revoked';
  credentialVersion: number;
};

export type AdminPrivateCompletion = {
  generation: number;
  credentialVersion: number;
};

export function captureAdminPrivateCompletion(
  generation: number,
  authorization: AdminClientAuthorization,
): AdminPrivateCompletion | null {
  return authorization.state === 'admin'
    ? { generation, credentialVersion: authorization.credentialVersion }
    : null;
}

export function isAdminPrivateCompletionCurrent(
  completion: AdminPrivateCompletion,
  generation: number,
  authorization: AdminClientAuthorization,
) {
  return (
    authorization.state === 'admin' &&
    authorization.credentialVersion === completion.credentialVersion &&
    generation === completion.generation
  );
}
