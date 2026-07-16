#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"

if command -v sha256sum >/dev/null 2>&1; then
  sha256sum -c SHA256SUMS
elif command -v shasum >/dev/null 2>&1; then
  shasum -a 256 -c SHA256SUMS
else
  echo "No SHA-256 verification command found (sha256sum or shasum)." >&2
  exit 127
fi
