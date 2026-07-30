export function consumeAuthTokenFromLocation(input: {
  location: Pick<Location, 'hash' | 'pathname' | 'search'>;
  history: Pick<History, 'replaceState'>;
  parameter?: string;
}): string | null {
  const parameter = input.parameter ?? 'token';
  const fragment = new URLSearchParams(input.location.hash.replace(/^#/u, ''));
  const token = fragment.get(parameter);
  if (!token) return null;
  fragment.delete(parameter);
  const nextFragment = fragment.toString();
  input.history.replaceState(
    null,
    '',
    `${input.location.pathname}${input.location.search}${nextFragment ? `#${nextFragment}` : ''}`,
  );
  return token;
}
