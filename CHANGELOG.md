# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

## [0.1.20] - 2026-02-23

### Added

- Added `doctor` command for runtime diagnosis and guided auto-fix flow.
- Added doctor diagnostics modules (`src/doctor/doctor.ts`, `src/doctor/report.ts`, `src/doctor/fixes.ts`) with 10 checks:
  - target discovery/type
  - version/signature validation
  - patch/hook compatibility
  - backup integrity
  - state consistency
  - installability simulation
  - environment hints
- Added `scripts/qa-doctor.sh` and `npm run qa:doctor`.

### Changed

- Updated README and troubleshooting docs with `doctor` usage guidance.
- Prevented `doctor` from proposing reinstall on clean unmanaged runtimes.
- Hardened backup cleanup logic to avoid deleting files outside backup directory.
- Limited automatic reinstall to valid-backup inconsistency cases to avoid over-eager patch reapplication.

## [0.1.19] - 2026-02-23

### Changed

- Rolled back the status-line uppercase patch and kept Claude Code's default lowercase footer rendering.
- Removed the `mode-status-uppercase-v2150` signature patch to reduce maintenance surface.
- Unified repository wording to `bypass permission never stop` across signatures, CLI messages, docs, and tests.

### QA

- `npm test`
- `bash scripts/qa-pnpm-v2149.sh`
- `bash scripts/qa-pnpm-v2150.sh`
- `bash scripts/qa-pnpm-mixed-target.sh`

## [0.1.18] - 2026-02-23

### Fixed

- Fixed lowercase status-line rendering by patching mode footer label transform from `toLowerCase()` to `toUpperCase()` in supported JS signatures (`2.1.49`, `2.1.50`).

### QA

- `npm test`
- `bash scripts/qa-pnpm-v2149.sh`
- `bash scripts/qa-pnpm-v2150.sh`
- `bash scripts/qa-pnpm-mixed-target.sh`

## [0.1.17] - 2026-02-23

### Changed

- Updated bypass permission never stop symbol from `∞` to `⟪∞⟫` for stronger mode visibility in demos.
- Strengthened install UX messaging:
  - banner line now emphasizes `DEMO MODE: bypass permission never stop`
  - success line now uses `PATCH/UPGRADE COMPLETE: bypass permission never stop READY`

### QA

- `npm test`
- `bash scripts/qa-pnpm-v2149.sh`
- `bash scripts/qa-pnpm-v2150.sh`
- `bash scripts/qa-pnpm-mixed-target.sh`

## [0.1.16] - 2026-02-23

### Changed

- Changed bypass permission never stop display color from `error` to `warning` for higher visibility while keeping clear distinction from bypass mode.
- Unified repository terminology to consistently use `bypass permission never stop` for user-facing mode naming across README/spec/docs/CLI/test messaging.
- Set both mode `title` and `shortTitle` to `bypass permission never stop`.

### QA

- `npm test`
- `bash scripts/qa-pnpm-v2149.sh`
- `bash scripts/qa-pnpm-v2150.sh`
- `bash scripts/qa-pnpm-mixed-target.sh`

## [0.1.15] - 2026-02-23

### Changed

- Switched bypass permission never stop symbol from `✶✶` to Unicode infinity `∞` (non-emoji glyph) for clearer mode identity.
- Changed bypass permission never stop display color from `autoAccept` to `error` (red) for stronger visual emphasis.

### QA

- `npm test`
- `bash scripts/qa-pnpm-v2149.sh`
- `bash scripts/qa-pnpm-v2150.sh`
- `bash scripts/qa-pnpm-mixed-target.sh`

## [0.1.14] - 2026-02-23

### Changed

- Removed rainbow-style bypass permission never stop symbol and switched to a stronger high-contrast mode style:
  - `title: "bypass permission never stop"`
  - `shortTitle: "bypass permission never stop"`
  - `symbol: "✶✶"`
  - `color: "autoAccept"`

### Added

- New `upgrade` command (alias: `update`) to re-apply patch without manual uninstall/install steps.

### QA

- `npm run build`
- `npm test`
- `bash scripts/qa-pnpm-v2149.sh`
- `bash scripts/qa-pnpm-v2150.sh`
- `bash scripts/qa-pnpm-mixed-target.sh`

## [0.1.13] - 2026-02-23

### Fixed

- Target discovery now resolves pnpm shim launchers from `which claude` (for example `/Users/<user>/Library/pnpm/claude`) to the real runtime `cli.js` path, so patching applies to the actual `claude` executable being run.
- Prevented false target selection where npm global install was patched while the active runtime was pnpm global.

### Added

- Finder regression test for `which claude` pnpm shim resolution with npm-global fallback present.

### QA

- `npm test`
- `bash scripts/qa-pnpm-v2149.sh`
- `bash scripts/qa-pnpm-v2150.sh`
- `bash scripts/qa-pnpm-mixed-target.sh`
- tmux install validation: confirmed installer resolves and patches pnpm runtime target path.

## [0.1.12] - 2026-02-23

### Fixed

- Added explicit `2.1.50` signature support (`XV6` mode cycle + `o76` mode array + `Rq1` mode display map) to prevent install-time pattern validation failure on Claude Code `2.1.50`.
- Added explicit `2.1.50` interactive hook injector pattern to restore bypass permission never stop submit-loop behavior on current `2.1.50` UI callback shape.

### Added

- New regression QA scenario for `2.1.50`: `scripts/qa-pnpm-v2150.sh` (`npm run qa:pnpm2150`).

### Changed

- `scripts/smoke-published.sh` now uses `--yes` to make published-package smoke checks work in non-interactive shells.

### QA

- `npm run build`
- `npm test`
- `bash scripts/qa-pnpm-v2149.sh`
- `bash scripts/qa-pnpm-v2150.sh`
- `bash scripts/qa-pnpm-mixed-target.sh`
- Real `2.1.50` `cli.js` copy verification via `Orchestrator.install(..., \"2.1.50\")` and uninstall restore check.

## [0.1.11] - 2026-02-23

### Changed

- Updated bypass permission never stop mode display label to `bypass permission never stop` across patch signatures.
- Updated 2.1.49 mode metadata to increase visual distinction from bypass mode:
  - `color: "planMode"`
  - `symbol: "🌈♾️"`
  - full-wording `title`/`shortTitle`
- Updated CLI and docs/demo copy to use the same full-wording mode label.

### Fixed

- Stabilized `tests/finder-strategies.test.ts` by isolating shell command resolution in the local-share precedence test so local developer global installs do not leak into test expectations.
- Updated QA scripts to pass `--yes` for non-interactive install flow.

### QA

- `npm run build`
- `npm test`
- `npm run test:ci`
- `bash scripts/qa-pnpm-v2149.sh`
- `bash scripts/qa-pnpm-mixed-target.sh`

## [0.1.10] - 2026-02-20

### Changed

- Removed the previous legacy labeling across user-facing surfaces.
- Updated CLI description/banner copy to neutral wording.
- Updated README, docs landing page, social templates, and project metadata wording for consistent tone.

### QA

- Verified the previous legacy label string no longer appears in repository search.
- Verified CLI/test surfaces remain green after wording changes.

## [0.1.9] - 2026-02-20

### Changed

- Simplified README for end users (quick start, rollback, expected result, CI install, and links only).
- Replaced long sample prompt with a single concise mission prompt.
- Updated CLI banner style and removed red danger-style warning tone.

### Added

- Install confirmation prompt: `ARE YOU SURE INSTALL bypass permission never stop mode? (yes/no)`.
- `--yes` option to skip prompt for CI/non-interactive automation.
- Non-interactive safety exit when install is launched without `--yes`.

### QA

- Added/updated CLI tests for:
  - confirmation prompt (`yes`/invalid input loop/non-interactive)
  - install cancellation flow
  - non-interactive shell protection
- `npm run test:ci` passes with coverage above 90%.

## [0.1.8] - 2026-02-20

### Fixed

- Switched `2.1.49` bypass permission never stop hook from SDK result-path injection (non-interactive path) to interactive `chat:submit` callback patching.
- Added loop patch at submit boundary so `neverStop` mode now re-submits prompts continuously in real interactive sessions.
- Added dependency-array patch for submit callback to keep mode-aware loop logic fresh across mode changes.

### QA

- Reproduced and verified in real `tmux` interactive session:
  - Launch `claude --dangerously-skip-permissions`
  - Cycle to `bypass permission never stop on` with `Shift+Tab`
  - Submit `hi` and observe repeated outputs/token growth over time
- `npm run test:ci` still passes with coverage `> 90%`.

## [0.1.7] - 2026-02-20

### Fixed

- Removed invalid `continue` injection from the `2.1.49` bypass permission never stop hook patch (it caused `SyntaxError: Illegal continue statement` on `claude` startup).
- Kept `2.1.49` hook compatibility while preventing runtime crash after patch.

### QA

- Verified in real `tmux` interactive session:
  - `npx` patch install
  - `claude --dangerously-skip-permissions` launch
  - `Shift+Tab` cycle shows `bypass permission never stop on` in the footer (`2.1.49`).

## [0.1.6] - 2026-02-20

### Fixed

- Added an exact `2.1.49` signature set for current pnpm-installed Claude CLI layout (`U76`, `eT6`, `zq1` mode structures).
- Added `2.1.49` bypass permission never stop hook injection pattern (`j6`/`Z6`/`w1`) so patch install no longer silently succeeds without behavior changes.
- Updated signature selection to prefer the most specific matching range when signatures overlap (for example `2.1.49` over `2.1.x`).
- Hardened install behavior to fail fast when no compatible bypass permission never stop hook exists, preventing partial patch state.

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

- Runtime patcher for Claude Code mode flow and bypass permission never stop hook injection
- Backup/restore manager with SHA-256 manifest
- Version signature compatibility layer
- Coverage-gated CI workflow
- Release workflow with npm publish path
- Security scanning workflow
- Published package smoke test workflow
- Troubleshooting and trusted publishing documentation
