# CLAUDE.md

## Project: bypass-permission-never-stop (claude-never-stop)

Unofficial Claude Code "God Mode" injector that monkey-patches the installed
Claude Code binary to add a "bypass permission never stop" mode to the
Shift+Tab permission cycle.

## Tech Stack
- TypeScript (Node16 module resolution)
- Vitest for testing
- chalk/ora/boxen for terminal UI

## Architecture
- `src/finder/` - Phase 1: Locate Claude Code installation on disk
- `src/patcher/` - Phase 2 & 3: UI mode injection + never-stop hook
- `src/backup/` - Phase 4: Backup/restore mechanism
- `src/utils/` - Shared utilities (logger, circuit breaker, file scanner)

## Commands
- `npm run build` - Compile TypeScript
- `npm run dev` - Run CLI in dev mode via ts-node
- `npm test` - Run vitest
- `npm run lint` - Run eslint

## Key Conventions
- All imports use `.js` extensions (Node16 module resolution)
- Backups stored in `~/.claude-never-stop/backups/`
- Never fork Claude Code - always monkey-patch the installed version
