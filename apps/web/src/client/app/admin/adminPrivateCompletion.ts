export type AdminClientAuthorization = {
  state: 'admin' | 'signed_out' | 'revoked';
  credentialVersion: number;
};

export type AdminPrivateCompletion = {
  generation: number;
  credentialVersion: number;
};

export type AdminCredentialBoundSnapshot<T> = Readonly<{
  credentialVersion: number;
  value: T;
}>;

export function bindAdminCredentialSnapshot<T>(
  value: T,
  credentialVersion: number,
): AdminCredentialBoundSnapshot<T> {
  return { credentialVersion, value };
}

export function isAdminCredentialSnapshotCurrent<T>(
  snapshot: AdminCredentialBoundSnapshot<T> | null | undefined,
  authorization: AdminClientAuthorization,
): snapshot is AdminCredentialBoundSnapshot<T> {
  return (
    snapshot !== null &&
    snapshot !== undefined &&
    authorization.state === 'admin' &&
    snapshot.credentialVersion === authorization.credentialVersion
  );
}

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
