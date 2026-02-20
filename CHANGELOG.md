# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Fixed

- Blocked native executable (Mach-O/ELF/PE) patch attempts to prevent `claude` startup failures (`killed`/SIGKILL).
- Added CLI early-exit safety path for binary targets with recovery guidance.
- Added regression tests for binary-target refusal and binary-corruption prevention.

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
