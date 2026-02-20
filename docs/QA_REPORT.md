# QA Report (2026-02-20)

## Scope

- Verify mixed installation environments where native Claude binary and pnpm JS install coexist.
- Verify regression safety for install/uninstall and target selection.
- Verify tmux execution path.
- Verify Linux container test baseline.

## Environment

- Host: macOS (arm64)
- `pnpm`: `10.23.0`
- `tmux`: `3.6a`
- `docker`: `24.0.2`

## Executed QA

1. Automated suite:

```bash
npm run test:ci
```

Result: PASS (`142 tests`, coverage `92.52%` at run time).

2. Mixed target QA (local binary + pnpm JS):

```bash
npm run qa:mixed
```

Result: PASS.

Validated:

- Finder selects pnpm JS target.
- JS target patched (`neverStop` markers present).
- Local native binary remains untouched.
- `uninstall` restores JS target.

3. tmux manual QA (same mixed scenario, separate tmux session):

Result: PASS.

Validated:

- Install succeeds in tmux execution context.
- JS target patched, local binary unchanged.
- Uninstall restores patched JS target.

4. Docker Linux QA:

```bash
docker run --rm -v "$PWD:/work" -w /work node:24-bookworm bash -lc "npm ci --silent && npm run test:ci"
```

Result: PASS.

## Notes

- Native executable patching remains blocked by design for safety.
- Version `0.1.4` includes mixed-target preference logic (`pnpm JS` preferred over local native binary fallback).
- Version `0.1.3` fixed CLI `--version` output mismatch.
