# bypass-permission-never-stop

[![CI](https://github.com/KoreanThinker/bypass-permission-never-stop/actions/workflows/ci.yml/badge.svg)](https://github.com/KoreanThinker/bypass-permission-never-stop/actions/workflows/ci.yml)
[![Security Scan](https://github.com/KoreanThinker/bypass-permission-never-stop/actions/workflows/security.yml/badge.svg)](https://github.com/KoreanThinker/bypass-permission-never-stop/actions/workflows/security.yml)

Unofficial Claude Code runtime patcher that injects a `neverStop` mode into the Shift+Tab mode cycle.

## Disclaimer

This project is **not** affiliated with Anthropic.
It patches installed Claude Code binaries/runtime files and may violate product terms.
Use at your own risk.

## Quick Start

```bash
npx bypass-permission-never-stop
```

Restore original binary:

```bash
npx bypass-permission-never-stop uninstall
```

## Features

- One-command install patch flow
- `neverStop` mode added to mode cycle / mode label paths
- Hook injection that replays the last user message in never-stop mode
- Circuit-breaker guard for repeated error loops
- Backup + restore (`uninstall`) with SHA-256 manifest
- Session log files in plain text

## Example Output

```text
[*] Scanning for Claude Code installation...
[+] Found: ~/.local/share/claude/versions/2.1.39
[*] Backing up original binary...
[*] Patching mode cycle array...
[*] Injecting never-stop hook...
[+] Patch applied successfully.
```

## Development

```bash
npm install
npm run build
npm test -- --coverage
npm pack --dry-run
```

## CI / CD

- `CI`: runs build + coverage checks on push/PR
- `Release`: runs build/test and publishes to npm when a GitHub Release is published
- `Security Scan`: runs secret scanning on push/PR
- `Dependabot`: monthly npm dependency update PRs (non-major only)

### Required GitHub Secret

- `NPM_TOKEN`: npm token with publish permission and 2FA bypass enabled

### Release Flow

1. Push changes to `main`
2. Create/publish a GitHub Release (for example `v0.1.1`)
3. `Release` workflow publishes package to npm automatically

## QA Baseline

- Test framework: Vitest
- Coverage target: 90%+
- Current baseline: `91%+` statement coverage

## Project Layout

```text
docs/PRD.md
signatures/
src/
tests/
```

## License

MIT

## Contributing

See `CONTRIBUTING.md`.

## Security

See `SECURITY.md`.
