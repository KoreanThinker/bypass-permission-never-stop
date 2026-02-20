# bypass-permission-never-stop

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
