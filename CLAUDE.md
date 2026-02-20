# CLAUDE.md

## Project: bypass-permission-never-stop

Unofficial Claude Code "God Mode" injector that monkey-patches the installed
Claude Code binary to add a "neverStop" mode to the Shift+Tab permission cycle.

## Tech Stack
- TypeScript (Node16 module resolution)
- Vitest for testing
- chalk for terminal output

## Architecture
- `src/finder/` - Phase 1: Locate Claude Code binary on disk
- `src/patcher/` - Phase 2 & 3: UI mode injection + never-stop hook (message re-injection)
- `src/backup/` - Phase 4: Backup/restore mechanism (latest 1 only)
- `src/version/` - Phase 5: Version detection + signature matching
- `src/utils/` - Shared utilities (logger, circuit breaker, session logger)
- `signatures/` - Version-specific patch pattern signatures (manually maintained)

## Commands
- `npm run build` - Compile TypeScript
- `npm run dev` - Run CLI in dev mode via ts-node
- `npm test` - Run vitest
- `npm run lint` - Run eslint

## Key Conventions
- All imports use `.js` extensions (Node16 module resolution)
- Backups stored in `~/.claude-never-stop/backups/` (latest 1 only)
- Session logs in `~/.claude-never-stop/logs/` (plain text .log)
- Never fork Claude Code - always monkey-patch the installed binary
- Patch target is a Bun-compiled Mach-O binary (~183MB) with embedded JS
- Binary patching: all string replacements MUST be same byte length
- CLI has no subcommand for install (default action), `uninstall` for rollback
- Logger style: hacker log `[*] Scanning... [+] Done.`
- Circuit breaker: exact string match, 5 consecutive identical errors
- Mode internal name: "neverStop" (camelCase, matches existing mode naming)

## RE Findings (v2.1.39)
- Binary: Bun-compiled Mach-O arm64, ~183MB
- Install path: `~/.local/share/claude/versions/<version>`
- Symlink: `~/.local/bin/claude` -> versions/<version>
- Mode cycle function: VNT (switch-case, returns next mode string)
- Mode array: GAT = ["acceptEdits","bypassPermissions","default","delegate","dontAsk","plan"]
- Display name function: Qu (switch-case)
- Main loop: async function*Pf (generator, yields messages)
- Version string: VERSION:"2.1.39" embedded in binary
