export function canonicalTextForHash(value: string) {
  return `${value.replaceAll('\r\n', '\n').replaceAll('\r', '\n').trimEnd()}\n`;
}
