# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

## [0.1.6] - 2026-02-20

### Fixed

- Added an exact `2.1.49` signature set for current pnpm-installed Claude CLI layout (`U76`, `eT6`, `zq1` mode structures).
- Added `2.1.49` never-stop hook injection pattern (`j6`/`Z6`/`w1`) so patch install no longer silently succeeds without behavior changes.
- Updated signature selection to prefer the most specific matching range when signatures overlap (for example `2.1.49` over `2.1.x`).
- Hardened install behavior to fail fast when no compatible never-stop hook exists, preventing partial patch state.

### QA

- Added regression tests for hook-variant selection and specific-version signature precedence.
- Verified `qa:mixed`, full `test:ci` (coverage > 90%), and Docker Ubuntu (`node:24-bookworm`) test pass.

## [0.1.5] - 2026-02-20

### Fixed

- Improved pnpm detection when running from shells where `pnpm` is not on `PATH` (for example `bash`-only sessions).
- Added fallback scanning for pnpm global store layout (`.../global/<version>/.pnpm/@anthropic-ai+claude-code@...`).
- Added regression test for mixed environments where `which claude` resolves to native binary but pnpm JS package exists.

## [0.1.4] - 2026-02-20

### Fixed

- Prefer JavaScript Claude targets over native binary candidates when both are present (for pnpm/global mixed installs).
- Added regression test coverage for `local binary + pnpm JS` coexistence target selection.

### Added

- New manual QA script: `scripts/qa-pnpm-mixed-target.sh` (`npm run qa:mixed`).
- Updated QA documentation in `CLAUDE.md` and `docs/QA_REPORT.md`.

## [0.1.3] - 2026-02-20

### Fixed

- Corrected CLI version reporting to read from `package.json` instead of a hardcoded string.
- Added regression tests to keep `--version` aligned with published package version.

## [0.1.2] - 2026-02-20

### Changed

- Switched release workflow runtime to Node.js 24 for npm Trusted Publishing compatibility.
- Removed token dependency (`NPM_TOKEN`) and standardized OIDC-based publish path.
- Added `package.json` repository/bugs/homepage metadata required for npm provenance verification.

## [0.1.1] - 2026-02-20

### Fixed

- Blocked native executable (Mach-O/ELF/PE) patch attempts to prevent `claude` startup failures (`killed`/SIGKILL).
- Added CLI early-exit safety path for binary targets with recovery guidance.
- Added regression tests for binary-target refusal and binary-corruption prevention.

### Changed

- Added ESLint v9 flat config and restored `npm run lint` execution.

## [0.1.0] - 2026-02-20

### Added

- Runtime patcher for Claude Code mode flow and never-stop hook injection
- Backup/restore manager with SHA-256 manifest
- Version signature compatibility layer
- Coverage-gated CI workflow
- Release workflow with npm publish path
- Security scanning workflow
- Published package smoke test workflow
- Troubleshooting and trusted publishing documentation
