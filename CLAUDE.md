# CLAUDE.md

## Project: bypass-permission-never-stop

Claude Code runtime patcher that injects a "neverStop" mode into
Claude Code mode flow.

## Tech Stack
- TypeScript (Node16 module resolution)
- Vitest for testing
- chalk for terminal output

## Architecture
- `src/finder/` - Phase 1: Locate Claude Code target on disk (JS preferred, binary fallback)
- `src/patcher/` - Phase 2 & 3: UI mode injection + never-stop hook (interactive submit-loop injection)
- `src/backup/` - Phase 4: Backup/restore mechanism (latest 1 only)
- `src/version/` - Phase 5: Version detection + signature matching
- `src/utils/` - Shared utilities (logger, circuit breaker, session logger)
- `signatures/` - Version-specific patch pattern signatures (manually maintained)

## Commands
- `npm run build` - Compile TypeScript
- `npm run dev` - Run CLI in dev mode via ts-node
- `npm test` - Run vitest
- `npm run lint` - Run eslint
- `npm run qa:mixed` - Manual-style QA for mixed `local binary + pnpm JS` target selection
- `npm run qa:pnpm2149` - Manual-style QA for `@anthropic-ai/claude-code@2.1.49` patch/unpatch

## Key Conventions
- All imports use `.js` extensions (Node16 module resolution)
- Backups stored in `~/.claude-never-stop/backups/` (latest 1 only)
- Session logs in `~/.claude-never-stop/logs/` (plain text .log)
- Native executable targets (Mach-O/ELF/PE) are blocked for safety
- Target finder prefers JavaScript targets when both JS and native candidates exist
- CLI has no subcommand for install (default action), `uninstall` for rollback
- Logger style: hacker log `[*] Scanning... [+] Done.`
- Circuit breaker: exact string match, 5 consecutive identical errors
- Mode internal name: "neverStop" (camelCase, matches existing mode naming)

## QA Status
- Automated suite: `npm run test:ci` passes with 90%+ coverage gate
- Mixed target regression: `npm run qa:mixed` verifies JS preference over local binary fallback
- pnpm 2.1.49 regression: `npm run qa:pnpm2149` verifies 2.1.49 signature + hook patch + uninstall restore
- tmux QA: `send-keys -l` + `Enter` path validated for real prompt submit in vim insert mode
- tmux interactive never-stop QA: `Shift+Tab` to `never stop on` then repeated submit loop verified by token growth
- Docker QA: `node:24-bookworm` container runs `npm run test:ci` successfully
