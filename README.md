# bypass-permission-never-stop

[![npm version](https://img.shields.io/npm/v/bypass-permission-never-stop)](https://www.npmjs.com/package/bypass-permission-never-stop)
[![GitHub stars](https://img.shields.io/github/stars/KoreanThinker/bypass-permission-never-stop?style=social)](https://github.com/KoreanThinker/bypass-permission-never-stop/stargazers)
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

## Command Examples

Patch installed Claude Code:

```bash
npx bypass-permission-never-stop
```

Rollback to original binary:

```bash
npx bypass-permission-never-stop uninstall
```

Run local build directly:

```bash
npm run build
node dist/cli.js
node dist/cli.js uninstall
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
scripts/smoke-published.sh
```

## CI / CD

- `CI`: runs build + coverage checks on push/PR
- `Release`: runs build/test and publishes to npm when a GitHub Release is published
- `Security Scan`: runs secret scanning on push/PR
- `Dependabot`: monthly npm dependency update PRs (non-major only)
- `Smoke Published Package`: weekly + manual smoke test against npm package
- `Growth Metrics`: weekly star/fork/watcher snapshot in workflow summary
- `Pages`: deploys `docs/` to GitHub Pages on `main`

### Required GitHub Secret

- `NPM_TOKEN`: npm token with publish permission and 2FA bypass enabled

### Recommended: npm Trusted Publishing

If you configure npm Trusted Publishing for this repository, you can remove long-lived publish tokens and rely on GitHub OIDC.
The `Release` workflow supports both modes automatically:

- If `NPM_TOKEN` exists, it uses token publish mode.
- If `NPM_TOKEN` is empty, it uses trusted publishing mode.

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

## Growth Plan

See `docs/GROWTH_PLAYBOOK.md`.

## Landing Page

See `docs/index.html` (GitHub Pages-ready static entry).
Published URL: `https://koreanthinker.github.io/bypass-permission-never-stop/`

## Troubleshooting

See `docs/TROUBLESHOOTING.md`.

## Trusted Publishing

See `docs/TRUSTED_PUBLISHING.md`.

## Release Notes Template

See `.github/RELEASE_TEMPLATE.md`.

## Changelog

See `CHANGELOG.md`.

## Architecture

See `docs/ARCHITECTURE.md`.

## Social Templates

See `docs/SOCIAL_POST_TEMPLATES.md`.

## Community Posting Checklist

See `docs/COMMUNITY_POSTING_CHECKLIST.md`.

## FAQ

### Is this an official Anthropic tool?

No. This is an unofficial runtime patcher.

### Why does publish fail with npm E403 + 2FA message?

Your publish token likely does not have 2FA bypass permission.
See `docs/TROUBLESHOOTING.md`.

### How do I safely rollback?

Run:

```bash
npx bypass-permission-never-stop uninstall
```
